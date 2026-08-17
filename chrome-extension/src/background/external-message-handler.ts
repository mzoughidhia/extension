import { GeminiService } from './gemini.service';
import { AutomationRun, FieldFillResult } from '../models/automation-run.model';
import { CANONICAL_PATHS } from '../models/canonical-paths';
import { DetectedField } from '../models/detected-field.model';
import { FieldMapping, MappingStatus } from '../models/field-mapping.model';
import { toAngularCanonicalPath, toExtensionCanonicalQuoteRequest } from '../shared/canonical-path-bridge';
import {
  AnalyzeDocumentMessage,
  ExternalFieldAnswerType,
  ExternalOcrConfidence,
  ExternalOcrField,
  ExternalRequiredField,
  FillExtranetQuoteMessage,
  FillExtranetStatus,
  PrepareExtranetQuoteMessage,
} from '../shared/external-messages';

/** Score Gemini à partir duquel une information lue est considérée fiable (voir `GeminiService`). */
const OCR_HIGH_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Déduit un type de réponse simple à partir du champ détecté — jamais de
 * détail technique (pas de type HTML brut, pas de sélecteur).
 */
export function inferQuestionType(field: DetectedField): ExternalFieldAnswerType {
  if (field.options && field.options.length > 0) return 'choice';
  if (field.type === 'checkbox') return 'boolean';
  if (field.type === 'number') return 'number';
  if (field.type === 'date') return 'date';
  return 'text';
}

/**
 * Convertit les mappings d'une analyse Form Agent en la liste des champs
 * réellement demandés par l'extranet, prête à être envoyée à Angular.
 *
 * Ne transmet QUE les champs reconnus dans le catalogue canonique fermé
 * (`mapping.canonicalPath` non nul) — un champ non reconnu par Gemini/le
 * fallback local n'est jamais transmis. Aucune confiance, aucun fingerprint,
 * aucun détail Gemini n'est inclus.
 */
export function toExternalRequiredFields(mappings: FieldMapping[]): ExternalRequiredField[] {
  const byCanonicalPath = new Map<string, ExternalRequiredField>();

  for (const mapping of mappings) {
    if (!mapping.canonicalPath) continue;

    const angularPath = toAngularCanonicalPath(mapping.canonicalPath);
    if (!angularPath) continue; // pas encore modélisé côté Angular : jamais transmis
    if (byCanonicalPath.has(angularPath)) continue; // dédoublonnage (ex : plusieurs radios pour un même champ)

    const field = mapping.field;
    const label = field.label || field.placeholder || field.ariaLabel || field.name || angularPath;

    byCanonicalPath.set(angularPath, {
      canonicalPath: angularPath,
      label,
      type: inferQuestionType(field),
      choices: field.options?.map((o) => ({ value: o.value, label: o.text || o.value })),
      required: true,
      reason: mapping.status === MappingStatus.NEEDS_CONFIRMATION ? 'Confirmation recommandée' : undefined,
    });
  }

  return Array.from(byCanonicalPath.values());
}

/**
 * Trouve un onglet déjà ouvert sur l'origine de l'extranet, ou en ouvre un
 * nouveau. Réutilise l'onglet existant plutôt que d'en multiplier.
 */
async function findOrOpenExtranetTab(url: string): Promise<chrome.tabs.Tab> {
  const origin = new URL(url).origin;
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url?.startsWith(origin));

  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    return existing;
  }

  return chrome.tabs.create({ url, active: true });
}

/** Attend que l'onglet ait fini de charger (nécessaire avant d'y envoyer DETECT_FIELDS). */
function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Le chargement de l'extranet a expiré."));
    }, timeoutMs);

    function listener(updatedTabId: number, info: chrome.tabs.TabChangeInfo): void {
      if (settled || updatedTabId !== tabId || info.status !== 'complete') return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    chrome.tabs.get(tabId, (tab) => {
      if (settled) return;
      if (tab.status === 'complete') {
        settled = true;
        clearTimeout(timer);
        resolve();
        return;
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

/**
 * Sollicite l'analyse réelle du formulaire sur l'onglet cible — réutilise
 * TEL QUEL le message interne `DETECT_FIELDS` déjà géré par le content
 * script (pipeline FormMemory → Gemini → fallback local, inchangé).
 */
function requestDetectFieldsFromTab(
  tabId: number,
  quoteData: ReturnType<typeof toExtensionCanonicalQuoteRequest>
): Promise<AutomationRun> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'DETECT_FIELDS', quoteData }, (response) => {
      if (chrome.runtime.lastError || !response?.success || !response.run) {
        reject(
          new Error(
            response?.error ||
              chrome.runtime.lastError?.message ||
              "Le formulaire n'a pas pu être analysé sur cette page."
          )
        );
        return;
      }
      resolve(response.run);
    });
  });
}

/**
 * Orchestration complète d'une demande `PREPARE_EXTRANET_QUOTE` :
 * ouvre/retrouve l'onglet de l'extranet, attend son chargement, déclenche le
 * pipeline d'analyse existant (FormMemory/Gemini/fallback, INCHANGÉ), et
 * traduit le résultat en champs requis pour Angular.
 */
export async function handlePrepareExtranetQuote(message: PrepareExtranetQuoteMessage): Promise<ExternalRequiredField[]> {
  const quoteData = toExtensionCanonicalQuoteRequest(message.quoteData);

  const tab = await findOrOpenExtranetTab(message.extranetUrl);
  if (tab.id === undefined) {
    throw new Error("Impossible d'ouvrir l'extranet.");
  }

  await waitForTabComplete(tab.id);
  const run = await requestDetectFieldsFromTab(tab.id, quoteData);

  return toExternalRequiredFields(run.mappings);
}

/**
 * Sollicite le remplissage réel sur l'onglet cible — réutilise TEL QUEL le
 * message interne `EXECUTE_FILL` déjà géré par le content script
 * (`MappingValidator.getFillableMappings` + `FormFiller`, INCHANGÉS). Ne
 * déclenche jamais une action irréversible : seuls les champs sont remplis,
 * jamais un clic sur "Suivant"/"Créer le devis"/etc.
 */
function requestExecuteFillFromTab(tabId: number, mappings: FieldMapping[]): Promise<FieldFillResult[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_FILL', mappings }, (response) => {
      if (chrome.runtime.lastError || !response?.success || !response.run) {
        reject(
          new Error(
            response?.error || chrome.runtime.lastError?.message || "Le remplissage a échoué sur cette page."
          )
        );
        return;
      }
      resolve(response.run.fillResults ?? []);
    });
  });
}

export interface FillOutcome {
  status: FillExtranetStatus;
  filledFieldsCount: number;
  missingFields: ExternalRequiredField[];
}

/**
 * Détermine le statut final du remplissage à partir des résultats réels —
 * jamais de confidence/fingerprint, uniquement des faits observables :
 * combien de champs ont été remplis, et lesquels ne l'ont pas été.
 */
export function computeFillOutcome(mappings: FieldMapping[], fillResults: FieldFillResult[]): FillOutcome {
  const filledCanonicalPaths = new Set(
    fillResults.filter((result) => result.success).map((result) => result.canonicalPath)
  );
  const filledFieldsCount = filledCanonicalPaths.size;

  const stillMissingMappings = mappings.filter(
    (mapping) => mapping.canonicalPath && !filledCanonicalPaths.has(mapping.canonicalPath)
  );
  const missingFields = toExternalRequiredFields(stillMissingMappings);

  let status: FillExtranetStatus;
  if (missingFields.length === 0) {
    status = 'ready';
  } else if (filledFieldsCount > 0) {
    status = 'partially_filled';
  } else {
    status = 'blocked';
  }

  return { status, filledFieldsCount, missingFields };
}

/**
 * Orchestration complète d'une demande `FILL_EXTRANET_QUOTE` : ouvre/retrouve
 * l'onglet, réanalyse (FormMemory HIT évite tout nouvel appel Gemini si la
 * structure est déjà connue), remplit les champs résolus depuis le dossier
 * (KNOWN uniquement — UNKNOWN/DECLARED_UNKNOWN/NEEDS_CONFIRMATION jamais
 * inventés, garanti par le pipeline existant), et retourne un résultat factuel.
 */
export async function handleFillExtranetQuote(
  message: FillExtranetQuoteMessage
): Promise<FillOutcome & { lastStepReached: number | null }> {
  const quoteData = toExtensionCanonicalQuoteRequest(message.quoteData);

  const tab = await findOrOpenExtranetTab(message.extranetUrl);
  if (tab.id === undefined) {
    throw new Error("Impossible d'ouvrir l'extranet.");
  }

  await waitForTabComplete(tab.id);
  const run = await requestDetectFieldsFromTab(tab.id, quoteData);
  const fillResults = await requestExecuteFillFromTab(tab.id, run.mappings);

  return {
    ...computeFillOutcome(run.mappings, fillResults),
    lastStepReached: run.stepInfo?.currentStep ?? null,
  };
}

/**
 * Orchestration complète d'une demande `ANALYZE_DOCUMENT` : envoie le
 * document au même `GeminiService` que l'analyse de formulaire (client HTTP,
 * clé API, gestion d'erreurs — INCHANGÉS), avec un prompt et un schéma de
 * sortie propres à la lecture de document. Ne touche à aucun onglet/DOM.
 *
 * La confiance brute Gemini (0.00–1.00) n'est jamais transmise à Angular :
 * seul un niveau `high`/`low` traverse la frontière (même principe que
 * `toExternalRequiredFields`, qui ne transmet jamais de score).
 */
export async function handleAnalyzeDocument(
  message: AnalyzeDocumentMessage,
  geminiService: GeminiService
): Promise<ExternalOcrField[]> {
  const response = await geminiService.analyzeDocument({
    documentBase64: message.documentBase64,
    mimeType: message.mimeType,
    allowedCanonicalPaths: CANONICAL_PATHS,
  });

  const byCanonicalPath = new Map<string, ExternalOcrField>();

  for (const field of response.fields) {
    const angularPath = toAngularCanonicalPath(field.canonicalPath);
    if (!angularPath) continue; // pas encore modélisé côté Angular : jamais transmis
    if (byCanonicalPath.has(angularPath)) continue;

    const confidence: ExternalOcrConfidence =
      field.confidence >= OCR_HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'low';

    byCanonicalPath.set(angularPath, {
      canonicalPath: angularPath,
      value: field.value,
      confidence,
    });
  }

  return Array.from(byCanonicalPath.values());
}
