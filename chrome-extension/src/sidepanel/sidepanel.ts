import { AutomationRun } from '../models/automation-run.model';
import { CanonicalQuoteRequest } from '../models/canonical-data.model';
import { FieldMapping, MappingStatus } from '../models/field-mapping.model';
import { QuoteSession } from '../models/quote-session.model';
import { buildSessionKey, identifySessionContext } from '../shared/session-context';
import {
  buildQuestionLine,
  computeProgressPercent,
  describeAnalysisOutcome,
  formatStepLabel,
  getScanButtonLabel,
  pickSessionPresentation,
  resolveQuestionInputType,
} from '../shared/ux-copy';

let currentQuoteData: CanonicalQuoteRequest | null = null;
let currentRun: AutomationRun | null = null;
let pendingQuestions: FieldMapping[] = [];
let answeredCount = 0;

// Éléments DOM
const conversationFeed = document.getElementById('conversation-feed') as HTMLElement;
const btnScan = document.getElementById('btn-scan') as HTMLButtonElement;
const btnFill = document.getElementById('btn-fill') as HTMLButtonElement;
const fillCount = document.getElementById('fill-count') as HTMLElement;
const statusDot = document.getElementById('status-dot') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const intelligenceStatus = document.getElementById('intelligence-status') as HTMLElement;
const geminiKeyRow = document.getElementById('gemini-key-row') as HTMLElement;
const geminiApiKeyInput = document.getElementById('gemini-api-key-input') as HTMLInputElement;
const btnSaveGeminiKey = document.getElementById('btn-save-gemini-key') as HTMLButtonElement;
const btnToggleGeminiKey = document.getElementById('btn-toggle-gemini-key') as HTMLButtonElement;
const btnClearGeminiKey = document.getElementById('btn-clear-gemini-key') as HTMLButtonElement;
const fieldsSummaryDetails = document.getElementById('fields-summary-details') as HTMLDetailsElement;
const summaryTotalCount = document.getElementById('summary-total-count') as HTMLElement;
const mappingsList = document.getElementById('mappings-list') as HTMLElement;

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuoteData();
  await checkGeminiStatus();
  await checkForExistingSession();
  setupEventListeners();
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
});

async function loadQuoteData(): Promise<void> {
  chrome.runtime.sendMessage({ type: 'GET_QUOTE_DATA' }, (response) => {
    if (response?.data) {
      currentQuoteData = response.data;
    }
  });
}

// ─── Statut global (header) ─────────────────────────────────────────────────

type AppStatus = 'ready' | 'busy' | 'attention';

function setAppStatus(status: AppStatus, label: string): void {
  statusDot.className = `dot ${status === 'ready' ? 'dot-ready' : status === 'busy' ? 'dot-busy' : 'dot-attention'}`;
  statusText.textContent = label;
}

// ─── Intelligence (Gemini), repliée dans les Paramètres ─────────────────────

async function checkGeminiStatus(): Promise<void> {
  chrome.runtime.sendMessage({ type: 'GET_GEMINI_API_KEY' }, (response) => {
    updateGeminiUIState(Boolean(response?.hasKey));
  });
}

function updateGeminiUIState(isConfigured: boolean): void {
  if (isConfigured) {
    intelligenceStatus.textContent = 'Activée';
    intelligenceStatus.className = 'config-pill active';
    btnClearGeminiKey.classList.remove('hidden');
  } else {
    intelligenceStatus.textContent = 'Non activée';
    intelligenceStatus.className = 'config-pill';
    btnClearGeminiKey.classList.add('hidden');
  }
  geminiKeyRow.classList.add('hidden');
}

function setupEventListeners(): void {
  btnScan.addEventListener('click', handleScanClick);
  btnFill.addEventListener('click', handleFillClick);
  btnSaveGeminiKey.addEventListener('click', handleSaveGeminiKey);
  btnClearGeminiKey.addEventListener('click', handleClearGeminiKey);
  btnToggleGeminiKey.addEventListener('click', () => {
    geminiKeyRow.classList.toggle('hidden');
  });
}

async function handleSaveGeminiKey(): Promise<void> {
  const rawKey = geminiApiKeyInput.value.trim();
  if (!rawKey) return;

  btnSaveGeminiKey.disabled = true;
  chrome.runtime.sendMessage({ type: 'SET_GEMINI_API_KEY', apiKey: rawKey }, (response) => {
    btnSaveGeminiKey.disabled = false;
    geminiApiKeyInput.value = '';
    if (response?.success) {
      updateGeminiUIState(true);
      addAssistantMessage("✨ L'intelligence est activée.");
    }
  });
}

async function handleClearGeminiKey(): Promise<void> {
  btnClearGeminiKey.disabled = true;
  chrome.runtime.sendMessage({ type: 'CLEAR_GEMINI_API_KEY' }, (response) => {
    btnClearGeminiKey.disabled = false;
    geminiApiKeyInput.value = '';
    if (response?.success) {
      updateGeminiUIState(false);
      addAssistantMessage("D'accord, je continuerai avec une analyse locale.");
    }
  });
}

/**
 * Messages spontanés en provenance du Content Script (ex : nouvelle étape
 * détectée automatiquement, sans action du courtier).
 */
function handleBackgroundMessage(message: any): void {
  if (message?.type === 'AUTO_STEP_DETECTED' && message.run) {
    currentRun = message.run;
    addAssistantMessage('↪️ Je passe à l\'étape suivante...');
    processRunResults(message.run);
  }
}

// ─── Reprise automatique d'un devis en cours ────────────────────────────────

async function checkForExistingSession(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const context = identifySessionContext(tab.url);
  const sessionKey = buildSessionKey(context);

  chrome.runtime.sendMessage({ type: 'LIST_QUOTE_SESSIONS', sessionKey }, (response) => {
    const sessions: QuoteSession[] = response?.sessions || [];
    if (sessions.length === 0) return;

    const presentation = pickSessionPresentation(sessions);
    if (presentation.mode === 'single') {
      renderResumeBanner(presentation.sessions[0]);
    } else if (presentation.mode === 'multiple') {
      renderSessionChoiceList(presentation.sessions);
    }
  });
}

function renderResumeBanner(session: QuoteSession): void {
  const card = document.createElement('div');
  card.className = 'chat-message assistant';

  card.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble">
      <p>👋 Vous avez déjà commencé ce formulaire.</p>
      <p>${escapeHtml(formatStepLabel(session))}</p>
      ${renderProgressBarHtml(session)}
      <div class="question-choices">
        <button class="choice-btn" data-action="resume">Reprendre</button>
        <button class="choice-btn" data-action="new">Nouveau formulaire</button>
      </div>
    </div>
  `;

  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;

  card.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
    disableCardControls(card);
    resumeSession(session.sessionId);
  });
  card.querySelector('[data-action="new"]')?.addEventListener('click', () => {
    disableCardControls(card);
    startNewSession();
  });
}

function renderSessionChoiceList(sessions: QuoteSession[]): void {
  const card = document.createElement('div');
  card.className = 'chat-message assistant';

  const items = sessions
    .map((s, idx) => {
      const date = new Date(s.updatedAt).toLocaleDateString('fr-FR');
      return `<button class="choice-btn" data-index="${idx}">${escapeHtml(s.product)} — ${escapeHtml(date)} — ${escapeHtml(formatStepLabel(s))}</button>`;
    })
    .join('');

  card.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble">
      <p>👋 J'ai trouvé plusieurs formulaires en cours.</p>
      <p>Lequel souhaitez-vous reprendre ?</p>
      <div class="question-choices">${items}</div>
      <div class="question-choices"><button class="choice-btn" data-action="new">Nouveau formulaire</button></div>
    </div>
  `;

  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;

  card.querySelectorAll('[data-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number((btn as HTMLElement).dataset.index);
      disableCardControls(card);
      resumeSession(sessions[idx].sessionId);
    });
  });
  card.querySelector('[data-action="new"]')?.addEventListener('click', () => {
    disableCardControls(card);
    startNewSession();
  });
}

function disableCardControls(card: HTMLElement): void {
  card.querySelectorAll('button, input').forEach((el) => {
    (el as HTMLInputElement | HTMLButtonElement).disabled = true;
  });
}

async function resumeSession(sessionId: string): Promise<void> {
  setAppStatus('busy', 'Analyse…');
  addAssistantMessage('🔄 Je reprends là où vous vous étiez arrêté...');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setAppStatus('ready', 'Prêt');
    addAssistantMessage('Je ne trouve pas la page à analyser.');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'RESUME_SESSION', sessionId }, (response) => {
    if (chrome.runtime.lastError || !response?.success || !response.run) {
      setAppStatus('ready', 'Prêt');
      addAssistantMessage("⚠️ Je n'arrive pas à reprendre ce formulaire sur cette page. Vérifiez qu'elle est bien ouverte.");
      return;
    }
    currentRun = response.run;
    btnScan.classList.add('hidden');
    processRunResults(response.run);
  });
}

function startNewSession(): void {
  addAssistantMessage("D'accord, je repars sur un nouveau formulaire.");
  resetToInitialState();
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'RESET_SESSION' }, () => {
      void chrome.runtime.lastError;
    });
  });
}

function resetToInitialState(): void {
  currentRun = null;
  pendingQuestions = [];
  answeredCount = 0;
  btnScan.classList.remove('hidden');
  btnScan.disabled = false;
  btnScan.textContent = getScanButtonLabel('idle');
  btnFill.classList.add('hidden');
  fieldsSummaryDetails.classList.add('hidden');
  setAppStatus('ready', 'Prêt');
}

// ─── Analyse du formulaire ───────────────────────────────────────────────────

async function handleScanClick(): Promise<void> {
  btnScan.disabled = true;
  btnScan.textContent = getScanButtonLabel('busy');
  setAppStatus('busy', 'Analyse…');
  addAssistantMessage('👀 Je regarde le formulaire...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Aucun onglet actif.');

    chrome.tabs.sendMessage(
      tab.id,
      { type: 'DETECT_FIELDS', quoteData: currentQuoteData || undefined },
      (response) => {
        if (chrome.runtime.lastError || !response?.success || !response.run) {
          btnScan.disabled = false;
          btnScan.textContent = getScanButtonLabel('idle');
          setAppStatus('ready', 'Prêt');
          addAssistantMessage("⚠️ Je n'arrive pas à analyser cette page. Vérifiez que le formulaire est bien chargé.");
          return;
        }

        currentRun = response.run;
        btnScan.textContent = getScanButtonLabel(response.run.metrics?.cacheHit ? 'cache-hit' : 'analyzed');
        btnScan.classList.add('hidden');
        processRunResults(response.run);
      }
    );
  } catch (err: any) {
    btnScan.disabled = false;
    btnScan.textContent = getScanButtonLabel('idle');
    setAppStatus('ready', 'Prêt');
    addAssistantMessage("⚠️ Je n'ai pas pu analyser la page.");
  }
}

/**
 * Traite les résultats et initie les questions conversationnelles si nécessaire.
 * N'expose jamais de détail technique : uniquement des comptes et des questions naturelles.
 */
function processRunResults(run: AutomationRun): void {
  answeredCount = 0;

  const usedLocalAnalysis = run.mappings.some((m) => m.source === 'local-fallback');

  const autoReady = run.mappings.filter(
    (m) =>
      (m.status === MappingStatus.MATCHED || m.status === MappingStatus.CONFIRMED) &&
      !m.epistemicBlockReason &&
      m.resolvedValue !== undefined &&
      m.resolvedValue !== null
  );

  pendingQuestions = run.mappings.filter(
    (m) =>
      (m.status === MappingStatus.NEEDS_CONFIRMATION || !m.canonicalPath || m.resolvedValue === undefined) &&
      !m.epistemicBlockReason &&
      m.field.isInteractable
  );

  renderSummaryList(run);
  renderStepProgress(run);

  const outcomeLines = describeAnalysisOutcome({
    cacheHit: Boolean(run.metrics?.cacheHit),
    usedLocalAnalysis,
    autoReadyCount: autoReady.length,
    pendingCount: pendingQuestions.length,
  });
  for (const line of outcomeLines) {
    addAssistantMessage(line);
  }

  if (pendingQuestions.length === 0) {
    setAppStatus('ready', 'Prêt à remplir');
    showFillButton(autoReady.length);
  } else {
    setAppStatus('attention', 'Question en attente');
    askNextQuestion();
  }
}

function renderStepProgress(run: AutomationRun): void {
  if (!run.stepInfo) return;

  const { currentStep, totalSteps } = run.stepInfo;
  const label = totalSteps ? `Étape ${currentStep} sur ${totalSteps}` : `Étape ${currentStep}`;

  const card = document.createElement('div');
  card.className = 'chat-message assistant';
  card.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble">
      <p class="step-label">${escapeHtml(label)}</p>
      ${totalSteps ? renderProgressBarHtml(run.stepInfo) : ''}
    </div>
  `;
  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
}

function renderProgressBarHtml(step: { currentStep: number; totalSteps: number | null }): string {
  const percent = computeProgressPercent(step);
  if (percent === null) return '';
  return `<div class="progress-bar"><div class="progress-bar-fill" style="width:${percent}%"></div></div>`;
}

// ─── Questions conversationnelles ────────────────────────────────────────────

function askNextQuestion(): void {
  if (pendingQuestions.length === 0) {
    const totalReady = currentRun?.mappings.filter(
      (m) =>
        (m.status === MappingStatus.MATCHED || m.status === MappingStatus.CONFIRMED) &&
        !m.epistemicBlockReason &&
        m.resolvedValue !== undefined
    ).length || 0;

    addAssistantMessage(`🎉 Le formulaire est prêt.<br>✓ ${totalReady} information(s) seront remplies.`);
    setAppStatus('ready', 'Prêt à remplir');
    showFillButton(totalReady);
    return;
  }

  setAppStatus('attention', 'Question en attente');

  const nextMapping = pendingQuestions[0];
  const field = nextMapping.field;
  const fieldLabel = field.label || field.placeholder || field.name || 'cette information';
  const questionLine = buildQuestionLine(fieldLabel);

  const questionCard = document.createElement('div');
  questionCard.className = 'chat-message assistant';

  const choices = field.options && field.options.length > 0
    ? field.options.map((opt) => opt.text || opt.value)
    : [];

  let inputHtml = '';
  if (choices.length > 0) {
    inputHtml = `
      <div class="question-choices">
        ${choices
          .map(
            (choice) =>
              `<button class="choice-btn" data-value="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`
          )
          .join('')}
      </div>
    `;
  } else {
    const inputType = resolveQuestionInputType(field.type);
    const placeholder = inputType === 'text' ? 'Votre réponse...' : '';
    inputHtml = `
      <div class="question-input-row">
        <input type="${inputType}" class="question-input" placeholder="${placeholder}" />
        <button class="choice-submit-btn">Valider</button>
      </div>
    `;
  }

  questionCard.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble">
      <p>J'ai besoin d'une précision :</p>
      <p class="question-text">${escapeHtml(questionLine)}</p>
      ${inputHtml}
    </div>
  `;

  conversationFeed.appendChild(questionCard);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;

  if (choices.length > 0) {
    questionCard.querySelectorAll('.choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = (btn as HTMLElement).dataset.value || (btn as HTMLElement).textContent || '';
        handleUserAnswer(nextMapping, val, questionCard);
      });
    });
  } else {
    const inputEl = questionCard.querySelector('.question-input') as HTMLInputElement;
    const submitBtn = questionCard.querySelector('.choice-submit-btn') as HTMLButtonElement;

    const submitAnswer = () => {
      const val = inputEl.value.trim();
      if (val) {
        handleUserAnswer(nextMapping, val, questionCard);
      }
    };

    submitBtn.addEventListener('click', submitAnswer);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
}

function handleUserAnswer(mapping: FieldMapping, answer: string, cardElement: HTMLElement): void {
  disableCardControls(cardElement);
  addUserMessage(answer);

  mapping.resolvedValue = answer;
  mapping.status = MappingStatus.CONFIRMED;
  mapping.userProvidedValue = answer;
  answeredCount++;

  // Mémoriser la réponse dans le formulaire en cours : ne plus jamais reposer
  // la même question, y compris après un rechargement ou un changement d'étape.
  if (mapping.canonicalPath) {
    persistUserAnswer(mapping.canonicalPath, answer);
  }

  pendingQuestions.shift();

  if (currentRun) {
    renderSummaryList(currentRun);
  }

  setTimeout(() => {
    addAssistantMessage('Parfait ✓ Je continue.');
    setTimeout(() => askNextQuestion(), 250);
  }, 300);
}

function persistUserAnswer(canonicalPath: string, value: string): void {
  if (!currentRun?.sessionId) return;
  const sessionId = currentRun.sessionId;

  chrome.runtime.sendMessage({ type: 'GET_QUOTE_SESSION', sessionId }, (response) => {
    const session: QuoteSession | null = response?.session || null;
    if (!session) return;

    session.userAnswers[canonicalPath] = value;
    session.completedFields[canonicalPath] = true;
    const timestamp = new Date().toISOString();
    session.updatedAt = timestamp;
    session.lastVisitedAt = timestamp;

    chrome.runtime.sendMessage({ type: 'SAVE_QUOTE_SESSION', session });
  });
}

// ─── Remplissage ──────────────────────────────────────────────────────────────

function showFillButton(count: number): void {
  btnFill.classList.remove('hidden');
  fillCount.textContent = String(count);
  btnFill.disabled = count === 0;
  btnFill.textContent = `Remplir le formulaire (${count})`;
}

async function handleFillClick(): Promise<void> {
  if (!currentRun) return;

  btnFill.disabled = true;
  btnFill.textContent = 'Remplissage en cours…';
  setAppStatus('busy', 'Remplissage…');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Aucun onglet actif.');

    chrome.tabs.sendMessage(
      tab.id,
      { type: 'EXECUTE_FILL', mappings: currentRun.mappings },
      (response) => {
        if (response?.success && response.run) {
          btnFill.classList.add('hidden');
          addAssistantMessage('✓ Cette étape est remplie.');
          finishFillFlow(tab.id!);
        } else {
          btnFill.disabled = false;
          btnFill.textContent = 'Réessayer';
          setAppStatus('attention', 'À vérifier');
          addAssistantMessage("⚠️ Une erreur est survenue pendant le remplissage. Vous pouvez réessayer.");
        }
      }
    );
  } catch (err: any) {
    btnFill.disabled = false;
    setAppStatus('attention', 'À vérifier');
    addAssistantMessage("⚠️ Je n'ai pas pu remplir le formulaire.");
  }
}

/**
 * Après remplissage : propose de continuer si une étape suivante existe,
 * sinon annonce que le formulaire est prêt. Ne soumet et ne clique jamais
 * automatiquement — action toujours explicite du courtier.
 */
function finishFillFlow(tabId: number): void {
  if (currentRun?.stepInfo?.nextButtonFound) {
    offerNextStep(tabId);
    return;
  }

  setAppStatus('ready', 'Terminé');
  const card = document.createElement('div');
  card.className = 'chat-message assistant';
  card.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble">
      <p>🎉 Le formulaire est prêt.</p>
      <p>Tous les champs que je pouvais remplir ont été complétés.</p>
      <div class="question-choices">
        <button class="choice-btn" data-action="verify">Vérifier le formulaire</button>
      </div>
    </div>
  `;
  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;

  card.querySelector('[data-action="verify"]')?.addEventListener('click', () => {
    fieldsSummaryDetails.classList.remove('hidden');
    fieldsSummaryDetails.open = true;
    fieldsSummaryDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function offerNextStep(tabId: number): void {
  const card = document.createElement('div');
  card.className = 'chat-message assistant';
  card.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble">
      <p>✓ Cette étape est prête.</p>
      <div class="question-choices">
        <button class="choice-btn" data-action="continue">Continuer →</button>
      </div>
    </div>
  `;
  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
  setAppStatus('ready', 'Prêt');

  card.querySelector('[data-action="continue"]')?.addEventListener('click', () => {
    disableCardControls(card);
    setAppStatus('busy', 'Analyse…');
    addAssistantMessage("J'analyse la prochaine étape...");
    chrome.tabs.sendMessage(tabId, { type: 'CLICK_NEXT_STEP' }, () => {
      void chrome.runtime.lastError;
    });
  });
}

// ─── Rendu ──────────────────────────────────────────────────────────────────

function addAssistantMessage(htmlContent: string): void {
  const msg = document.createElement('div');
  msg.className = 'chat-message assistant';
  msg.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble"><p>${htmlContent}</p></div>
  `;
  conversationFeed.appendChild(msg);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
}

function addUserMessage(text: string): void {
  const msg = document.createElement('div');
  msg.className = 'chat-message user';
  msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  conversationFeed.appendChild(msg);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
}

function renderSummaryList(run: AutomationRun): void {
  fieldsSummaryDetails.classList.remove('hidden');
  summaryTotalCount.textContent = String(run.mappings.length);
  mappingsList.innerHTML = '';

  for (const m of run.mappings) {
    const row = document.createElement('div');
    row.className = 'summary-row';

    const label = m.field.label || m.field.placeholder || m.field.name || 'Champ';
    let statusText = '✓ Trouvée';
    let statusClass = 'found';

    if (m.epistemicBlockReason) {
      statusText = 'Non renseignée';
      statusClass = 'missing';
    } else if (m.status === MappingStatus.NEEDS_CONFIRMATION) {
      statusText = 'À vérifier';
      statusClass = 'confirm';
    } else if (m.status === MappingStatus.UNMATCHED || (!m.resolvedValue && !m.userProvidedValue)) {
      statusText = 'Manquante';
      statusClass = 'missing';
    }

    row.innerHTML = `
      <span class="summary-label">${escapeHtml(label)}</span>
      <span class="summary-status ${statusClass}">${statusText}</span>
    `;

    mappingsList.appendChild(row);
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
