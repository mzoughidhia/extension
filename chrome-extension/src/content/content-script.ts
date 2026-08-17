import { AutomationRun, AutomationRunStepInfo } from '../models/automation-run.model';
import { CanonicalQuoteRequest } from '../models/canonical-data.model';
import { CANONICAL_PATHS } from '../models/canonical-paths';
import { DetectedField } from '../models/detected-field.model';
import { FieldMapping, MappingStatus } from '../models/field-mapping.model';
import { FORM_MEMORY_VERSION, FormMemory, FormMemoryFieldMapping } from '../models/form-memory.model';
import { QuoteSession, QuoteSessionStep } from '../models/quote-session.model';
import {
  GeminiAnalysisResponseMessage,
  FormMemoryResponseMessage,
  QuoteSessionResponseMessage,
  ExtensionMessage,
} from '../shared/messages';
import { GeminiMappingRequest } from '../models/gemini-schema.model';
import { buildSessionKey, identifySessionContext, SessionContext } from '../shared/session-context';
import { ConfidenceScorer } from './confidence-scorer';
import { DOMAnalyzer } from './dom-analyzer';
import { FieldDetector } from './field-detector';
import { buildFieldStructure, buildFormMemoryKey, computeFieldKey, computeFormFingerprint } from './form-fingerprint';
import { FormFiller } from './form-filler';
import { GeminiResponseValidator } from './gemini-response-validator';
import { MappingValidator } from './mapping-validator';
import { StepDetector } from './step-detector';

let currentRun: AutomationRun | null = null;
let dynamicObserver: MutationObserver | null = null;

/** Session de devis active dans CETTE page (jamais rattachée automatiquement sans action explicite). */
let activeSessionId: string | null = null;
/** Empreinte de la dernière structure réellement analysée, pour ignorer les mutations DOM insignifiantes. */
let lastAnalyzedFingerprint: string | null = null;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Écouteur des messages envoyés par le Sidepanel / Popup / Background
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'DETECT_FIELDS') {
    handleDetectFields(message.quoteData)
      .then((run) => sendResponse({ success: true, run }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Asynchrone
  }

  if (message.type === 'EXECUTE_FILL') {
    handleExecuteFill(message.mappings)
      .then((run) => sendResponse({ success: true, run }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'UPDATE_MAPPING_STATUS') {
    if (currentRun) {
      const mapping = currentRun.mappings.find((m) => m.field.elementId === message.elementId);
      if (mapping) {
        mapping.status = message.newStatus;
        if (message.newCanonicalPath) {
          mapping.canonicalPath = message.newCanonicalPath;
        }
      }
      sendResponse({ success: true, run: currentRun });
    }
    return false;
  }

  if (message.type === 'RESUME_SESSION') {
    activeSessionId = message.sessionId;
    handleDetectFields()
      .then((run) => sendResponse({ success: true, run }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'RESET_SESSION') {
    activeSessionId = null;
    lastAnalyzedFingerprint = null;
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'CLICK_NEXT_STEP') {
    const clicked = StepDetector.clickNextButton();
    sendResponse({ success: clicked });
    return false;
  }

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return false;
  }
});

/**
 * Pipeline principal de détection et de mapping :
 * 1. Détection des champs du DOM
 * 2. Empreinte du formulaire + recherche en mémoire (FormMemory / cache)
 * 3. Mapping sémantique via Gemini si nécessaire (Moteur principal), sinon fallback local
 * 4. Application des réponses déjà fournies par le courtier dans la session en cours
 * 5. Mise à jour de la progression de la session de devis (QuoteSession)
 */
async function handleDetectFields(quoteDataParam?: CanonicalQuoteRequest): Promise<AutomationRun> {
  const analysisStartedAt = new Date().toISOString();
  const totalStart = now();
  let quoteData = quoteDataParam;

  // Récupération des données locales si non fournies directement
  if (!quoteData) {
    quoteData = await new Promise<CanonicalQuoteRequest | undefined>((resolve) => {
      chrome.storage.local.get(['quoteData'], (result) => {
        resolve(result.quoteData);
      });
    });
  }

  const detected = FieldDetector.detectFields();
  console.log(`[FormAgent][DOM] ${detected.length} champs détectés dans le formulaire.`);

  // ─── Empreinte du formulaire + recherche en mémoire (cache) ─────────────
  const fingerprintStart = now();
  const formFingerprint = computeFormFingerprint(detected);
  const fingerprintDuration = now() - fingerprintStart;
  const memoryKey = buildFormMemoryKey(window.location.hostname, formFingerprint);

  const cacheLookupStart = now();
  const cachedMemory = await getFormMemory(memoryKey);
  const cacheLookupDuration = now() - cacheLookupStart;

  let mappings: FieldMapping[] = [];
  let geminiDuration = 0;
  let geminiCalled = false;
  const cacheHit = Boolean(cachedMemory);

  // Contexte de la page pour Gemini
  const pageContext = {
    title: document.title || '',
    url: window.location.href,
    hostname: window.location.hostname,
  };

  const formSchema = DOMAnalyzer.toCompactSchema(detected, pageContext);

  if (cachedMemory) {
    console.log('[Form Agent] Form memory HIT');
    mappings = applyCachedMemory(detected, cachedMemory, quoteData);
  } else if (quoteData && detected.length > 0) {
    console.log('[Form Agent] Form memory MISS → Gemini');
    try {
      console.log('[FormAgent][Gemini] Envoi du schéma compact au service worker...');

      const geminiRequest: GeminiMappingRequest = {
        formSchema,
        availableData: quoteData,
        allowedCanonicalPaths: CANONICAL_PATHS,
      };

      geminiCalled = true;
      const geminiStart = now();
      const geminiResponse = await callGeminiAnalysis(geminiRequest);
      geminiDuration = now() - geminiStart;

      if (geminiResponse.success && geminiResponse.response) {
        console.log(`[FormAgent][Gemini] Réponse reçue avec ${geminiResponse.response.mappings?.length || 0} proposition(s).`);

        // Validation stricte de la réponse Gemini
        const validated = GeminiResponseValidator.validate(geminiResponse.response, detected);
        console.log(`[FormAgent][Validator] Validation réussie : ${validated.validMappings.length} valide(s), ${validated.rejectedMappings.length} rejeté(s).`);

        // Indexer les mappings valides par elementId
        const validatedMap = new Map(validated.validMappings.map((v) => [v.fieldId, v]));

        mappings = detected.map((field) => {
          const validatedItem = validatedMap.get(field.elementId);
          if (validatedItem && validatedItem.canonicalPath) {
            // Mapping Gemini valide
            return ConfidenceScorer.buildMappingFromValidated(
              field,
              validatedItem.canonicalPath,
              validatedItem.confidence,
              validatedItem.reason,
              quoteData,
              undefined,
              'gemini'
            );
          } else if (validatedItem && !validatedItem.canonicalPath) {
            // Gemini a explicitement indiqué aucun mapping pour ce champ
            return ConfidenceScorer.buildMappingFromValidated(
              field,
              null,
              0,
              validatedItem.reason || 'Aucune correspondance identifiée par Gemini',
              quoteData,
              undefined,
              'gemini'
            );
          } else {
            // Champ non mappé par Gemini ou mapping rejeté
            return ConfidenceScorer.buildMappingFromValidated(
              field,
              null,
              0,
              'Champ non reconnu par Gemini',
              quoteData,
              undefined,
              'gemini'
            );
          }
        });

        console.log('[FormAgent][Mapping] Pipeline Gemini appliqué avec succès.');

        // Sauvegarde de la mémoire du formulaire (structure + mapping uniquement,
        // aucune donnée personnelle du client n'est stockée).
        await saveFormMemory(buildFormMemory(memoryKey, formFingerprint, detected, mappings));
      } else {
        throw new Error(geminiResponse.error || 'Réponse Gemini non concluante');
      }
    } catch (err: any) {
      console.warn('[FormAgent][Fallback] Basculement sur le moteur local déterministe :', err?.message || err);
      // Fallback local transparent
      mappings = ConfidenceScorer.scoreFields(detected, quoteData);
      console.log(`[FormAgent][Fallback] ${mappings.length} champs traités par le fallback local.`);
    }
  } else {
    // Pas de données disponibles ou aucun champ détecté : fallback direct
    console.log('[FormAgent][Fallback] Traitement via moteur local direct.');
    mappings = ConfidenceScorer.scoreFields(detected, quoteData);
  }

  // ─── Session de devis : progression + réponses déjà fournies ────────────
  const sessionContext = identifySessionContext(window.location.href);
  const sessionKey = buildSessionKey(sessionContext);
  const stepInfo = StepDetector.detect();

  const session = await loadOrCreateSession(sessionKey, sessionContext);
  mappings = applySessionAnswers(mappings, session.userAnswers);

  updateSessionProgress(session, stepInfo, formFingerprint, mappings);
  activeSessionId = session.sessionId;
  await saveQuoteSession(session);

  lastAnalyzedFingerprint = formFingerprint;

  const matched = mappings.filter((m) => m.status === MappingStatus.MATCHED).length;
  const needsConfirm = mappings.filter((m) => m.status === MappingStatus.NEEDS_CONFIRMATION).length;
  const unmatched = mappings.filter((m) => m.status === MappingStatus.UNMATCHED).length;

  const stepInfoForRun: AutomationRunStepInfo = {
    currentStep: session.currentStep,
    totalSteps: session.totalSteps,
    label: stepInfo.stepLabel,
    nextButtonFound: stepInfo.nextButtonFound,
  };

  currentRun = {
    runId: `run_${Date.now()}`,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    hostname: window.location.hostname,
    mappings,
    totalDetected: detected.length,
    totalMatched: matched,
    totalNeedsConfirmation: needsConfirm,
    totalUnmatched: unmatched,
    sessionId: session.sessionId,
    stepInfo: stepInfoForRun,
    metrics: {
      fingerprintDuration,
      cacheLookupDuration,
      geminiDuration,
      totalAnalysisDuration: now() - totalStart,
      cacheHit,
      geminiCalled,
      analysisStartedAt,
      analysisCompletedAt: new Date().toISOString(),
    },
  };

  // Activer l'observation des ajouts dynamiques au DOM (SPA)
  setupDynamicFieldsObserver();

  return currentRun;
}

/**
 * Reconstruit les mappings à partir d'une mémoire de formulaire (cache HIT) —
 * aucun appel Gemini n'est effectué. Le mapping mémorisé est structurel et
 * réutilisable pour n'importe quel client ; seule la résolution de la valeur
 * (via quoteData) est propre au client courant.
 */
function applyCachedMemory(
  detected: DetectedField[],
  memory: FormMemory,
  quoteData?: CanonicalQuoteRequest
): FieldMapping[] {
  const mappingByKey = new Map(memory.validatedMappings.map((m) => [m.fieldKey, m]));

  return detected.map((field, index) => {
    const fieldKey = computeFieldKey(field, index);
    const cachedEntry = mappingByKey.get(fieldKey);

    if (cachedEntry) {
      return ConfidenceScorer.buildMappingFromValidated(
        field,
        cachedEntry.canonicalPath as any,
        cachedEntry.confidence,
        cachedEntry.reason,
        quoteData,
        undefined,
        'form-memory'
      );
    }

    // Ne devrait pas se produire si le fingerprint correspond, mais sécurité défensive.
    return ConfidenceScorer.buildMappingFromValidated(
      field,
      null,
      0,
      'Champ absent de la mémoire du formulaire',
      quoteData,
      undefined,
      'form-memory'
    );
  });
}

/**
 * Construit l'objet FormMemory à partir des mappings validés par Gemini.
 * Ne contient que la structure du formulaire et le mapping canonique —
 * jamais de valeur ni de donnée personnelle du client.
 */
function buildFormMemory(
  memoryKey: string,
  formFingerprint: string,
  detected: DetectedField[],
  mappings: FieldMapping[]
): FormMemory {
  const timestamp = new Date().toISOString();

  const validatedMappings: FormMemoryFieldMapping[] = detected.map((field, index) => {
    const mapping = mappings[index];
    return {
      fieldKey: computeFieldKey(field, index),
      canonicalPath: mapping?.canonicalPath ?? null,
      confidence: mapping?.confidence ?? 0,
      reason: mapping?.reasons?.[0] || '',
    };
  });

  return {
    memoryKey,
    origin: window.location.hostname,
    product: null,
    formFingerprint,
    fieldStructure: buildFieldStructure(detected),
    validatedMappings,
    createdAt: timestamp,
    lastUsedAt: timestamp,
    version: FORM_MEMORY_VERSION,
  };
}

/**
 * Applique les réponses déjà données par le courtier (mémorisées dans la
 * session en cours) : évite de reposer une question déjà répondue, y
 * compris après un rechargement de page ou un changement d'étape.
 */
export function applySessionAnswers(
  mappings: FieldMapping[],
  userAnswers: Record<string, unknown>
): FieldMapping[] {
  return mappings.map((mapping) => {
    if (!mapping.canonicalPath) return mapping;
    const answer = userAnswers[mapping.canonicalPath];
    if (answer === undefined) return mapping;

    return {
      ...mapping,
      resolvedValue: answer,
      status: MappingStatus.CONFIRMED,
      epistemicBlockReason: undefined,
      userProvidedValue: answer,
      source: 'user-answer',
    };
  });
}

/**
 * Crée une nouvelle session de devis vierge pour une identité de parcours donnée.
 */
export function createNewSession(sessionKey: string, context: SessionContext): QuoteSession {
  const timestamp = new Date().toISOString();
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionKey,
    origin: context.origin,
    product: context.product,
    quoteId: null,
    quoteNumber: null,
    quoteStatus: null,
    quoteDate: null,
    currentStep: 1,
    totalSteps: null,
    steps: [],
    completedFields: {},
    userAnswers: {},
    detectedQuotes: [],
    status: 'in_progress',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastVisitedAt: timestamp,
  };
}

/**
 * Met à jour la progression de la session avec les résultats de l'étape
 * qui vient d'être analysée (étape courante, étapes déjà vues, champs complétés).
 */
export function updateSessionProgress(
  session: QuoteSession,
  stepInfo: { currentStep: number | null; totalSteps: number | null; stepLabel: string | null },
  formFingerprint: string,
  mappings: FieldMapping[]
): void {
  const stepIndex = stepInfo.currentStep ?? session.steps.length + 1;
  session.currentStep = stepIndex;
  session.totalSteps = stepInfo.totalSteps ?? session.totalSteps;

  const alreadyRecorded = session.steps.some((s) => s.formFingerprint === formFingerprint);
  if (!alreadyRecorded) {
    const completedFieldCount = mappings.filter(
      (m) => m.resolvedValue !== undefined && m.resolvedValue !== null
    ).length;

    const step: QuoteSessionStep = {
      stepIndex,
      label: stepInfo.stepLabel,
      formFingerprint,
      completedFieldCount,
      timestamp: new Date().toISOString(),
    };
    session.steps.push(step);
  }

  for (const mapping of mappings) {
    if (mapping.canonicalPath && mapping.resolvedValue !== undefined && mapping.resolvedValue !== null) {
      session.completedFields[mapping.canonicalPath] = true;
    }
  }

  const timestamp = new Date().toISOString();
  session.updatedAt = timestamp;
  session.lastVisitedAt = timestamp;
}

/**
 * Récupère la session active de cette page (si déjà connue) ou en crée une
 * nouvelle. Ne rattache JAMAIS automatiquement une session persistée d'une
 * autre visite : cela ne peut se produire qu'via une reprise explicite
 * (message RESUME_SESSION déclenché depuis le Side Panel).
 */
async function loadOrCreateSession(sessionKey: string, context: SessionContext): Promise<QuoteSession> {
  if (activeSessionId) {
    const existing = await getQuoteSession(activeSessionId);
    if (existing) return existing;
  }
  return createNewSession(sessionKey, context);
}

/**
 * Récupère une mémoire de formulaire via le Service Worker (seul responsable
 * du stockage `chrome.storage.local`).
 */
function getFormMemory(memoryKey: string): Promise<FormMemory | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GET_FORM_MEMORY', memoryKey },
      (response: FormMemoryResponseMessage) => {
        if (chrome.runtime.lastError || !response) {
          resolve(null);
          return;
        }
        resolve(response.memory || null);
      }
    );
  });
}

/**
 * Enregistre une mémoire de formulaire via le Service Worker.
 */
function saveFormMemory(memory: FormMemory): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SAVE_FORM_MEMORY', memory }, () => resolve());
  });
}

/**
 * Récupère une session de devis via le Service Worker.
 */
function getQuoteSession(sessionId: string): Promise<QuoteSession | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GET_QUOTE_SESSION', sessionId },
      (response: QuoteSessionResponseMessage) => {
        if (chrome.runtime.lastError || !response) {
          resolve(null);
          return;
        }
        resolve(response.session || null);
      }
    );
  });
}

/**
 * Enregistre une session de devis via le Service Worker.
 */
function saveQuoteSession(session: QuoteSession): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SAVE_QUOTE_SESSION', session }, () => resolve());
  });
}

/**
 * Envoie la requête d'analyse au Service Worker via le runtime Chrome.
 */
function callGeminiAnalysis(request: GeminiMappingRequest): Promise<GeminiAnalysisResponseMessage> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'ANALYZE_WITH_GEMINI', request },
      (response: GeminiAnalysisResponseMessage) => {
        if (chrome.runtime.lastError) {
          resolve({
            type: 'GEMINI_ANALYSIS_RESPONSE',
            success: false,
            error: chrome.runtime.lastError.message,
            errorCode: 'RUNTIME_ERROR',
          });
        } else if (response) {
          resolve(response);
        } else {
          resolve({
            type: 'GEMINI_ANALYSIS_RESPONSE',
            success: false,
            error: 'Pas de réponse du Service Worker',
            errorCode: 'NO_RESPONSE',
          });
        }
      }
    );
  });
}

/**
 * Exécute le remplissage sécurisé des champs éligibles.
 */
async function handleExecuteFill(mappingsToFill?: FieldMapping[]): Promise<AutomationRun> {
  const mappings = mappingsToFill || currentRun?.mappings || [];
  const fillable = MappingValidator.getFillableMappings(mappings);
  const fillResults = FormFiller.fillFields(fillable);

  if (currentRun) {
    currentRun.fillResults = fillResults;
    currentRun.totalFilled = fillResults.filter((r) => r.success).length;
  }

  return (
    currentRun || {
      runId: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      hostname: window.location.hostname,
      mappings,
      fillResults,
      totalDetected: mappings.length,
      totalMatched: 0,
      totalNeedsConfirmation: 0,
      totalUnmatched: 0,
      totalFilled: fillResults.filter((r) => r.success).length,
    }
  );
}

/**
 * Surveille les modifications structurelles du DOM (SPA Angular/React : nouvelle
 * étape sans rechargement de page). Debounce, puis ne relance une analyse que
 * si la structure du formulaire a réellement changé (nouvelle empreinte) et
 * seulement si une session est déjà active dans cette page (jamais sur une
 * page où le courtier n'a encore rien lancé).
 */
function setupDynamicFieldsObserver(): void {
  if (dynamicObserver) {
    dynamicObserver.disconnect();
  }

  let debounceTimer: number | undefined;

  dynamicObserver = new MutationObserver((mutations) => {
    const hasFormMutation = mutations.some((m) =>
      Array.from(m.addedNodes).some((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n as HTMLElement;
          return (
            el.matches?.('input, select, textarea, mat-form-field, .form-group') ||
            el.querySelector?.('input, select, textarea')
          );
        }
        return false;
      })
    );

    if (hasFormMutation) {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        handlePotentialStepChange();
      }, 600);
    }
  });

  dynamicObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Réagit à une mutation DOM significative : ne relance une analyse complète
 * que si la structure du formulaire a réellement changé (nouvelle empreinte).
 * Sinon, ne fait rien — aucun appel Gemini inutile.
 */
async function handlePotentialStepChange(): Promise<void> {
  if (!activeSessionId) return; // aucune session active dans cette page : rien à continuer automatiquement

  const detected = FieldDetector.detectFields();
  if (detected.length === 0) return;

  const fingerprint = computeFormFingerprint(detected);
  if (fingerprint === lastAnalyzedFingerprint) return; // structure inchangée, rien à refaire

  console.log("[Form Agent] Nouvelle structure de formulaire détectée (changement d'étape SPA).");

  try {
    const run = await handleDetectFields();
    chrome.runtime.sendMessage({ type: 'AUTO_STEP_DETECTED', run }, () => {
      // Le Side Panel peut être fermé : ignorer l'absence de destinataire.
      void chrome.runtime.lastError;
    });
  } catch (err) {
    console.warn('[Form Agent] Échec de la ré-analyse automatique :', err);
  }
}
