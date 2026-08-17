// src/shared/session-context.ts
var PRODUCT_QUERY_KEYS = ["name", "product", "produit", "oid"];
var COMBINING_DIACRITICS_START = 768;
var COMBINING_DIACRITICS_END = 879;
function stripDiacritics(value) {
  let result = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) || 0;
    if (code >= COMBINING_DIACRITICS_START && code <= COMBINING_DIACRITICS_END) {
      continue;
    }
    result += ch;
  }
  return result;
}
function normalizeProductToken(value) {
  const decomposed = value.toLowerCase().normalize("NFD");
  const withoutDiacritics = stripDiacritics(decomposed);
  const token = withoutDiacritics.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return token || "default";
}
function identifySessionContext(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { origin: "unknown", product: "default" };
  }
  const origin = url.hostname || "unknown";
  for (const key of PRODUCT_QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value) {
      return { origin, product: normalizeProductToken(value) };
    }
  }
  const pathSegment = url.pathname.split("/").filter(Boolean)[0];
  if (pathSegment) {
    return { origin, product: normalizeProductToken(pathSegment) };
  }
  return { origin, product: "default" };
}
function buildSessionKey(context) {
  return `${context.origin}::${context.product}`;
}

// src/shared/ux-copy.ts
var SCAN_BUTTON_LABELS = {
  idle: "Analyser le formulaire",
  busy: "Analyse en cours\u2026",
  "cache-hit": "\u2713 Formulaire reconnu",
  analyzed: "\u2713 Formulaire analys\xE9"
};
function getScanButtonLabel(state) {
  return SCAN_BUTTON_LABELS[state];
}
var TYPED_INPUT_TYPES = /* @__PURE__ */ new Set(["date", "number"]);
function resolveQuestionInputType(fieldType) {
  return TYPED_INPUT_TYPES.has(fieldType) ? fieldType : "text";
}
function buildQuestionLine(fieldLabel) {
  const trimmed = fieldLabel.trim();
  return /[?!.]$/.test(trimmed) ? trimmed : `${trimmed} ?`;
}
function describeAnalysisOutcome(input) {
  const lines = [];
  if (input.cacheHit) {
    lines.push("\u2713 Formulaire reconnu.");
  } else if (input.usedLocalAnalysis) {
    lines.push("Le mode intelligent est momentan\xE9ment indisponible. Je continue avec une analyse locale.");
  }
  if (input.pendingCount === 0) {
    lines.push(`\u2713 ${input.autoReadyCount} information(s) pr\xEAte(s).`);
  } else {
    lines.push(`\u2713 ${input.autoReadyCount} information(s) pr\xEAte(s)<br>\u26A0\uFE0F ${input.pendingCount} information(s) manquante(s)`);
  }
  return lines;
}
function formatStepLabel(step) {
  return step.totalSteps ? `\xC9tape ${step.currentStep} sur ${step.totalSteps}` : `\xC9tape ${step.currentStep}`;
}
function computeProgressPercent(step) {
  if (!step.totalSteps) return null;
  return Math.max(0, Math.min(100, Math.round(step.currentStep / step.totalSteps * 100)));
}
function pickSessionPresentation(sessions) {
  if (sessions.length === 0) return { mode: "none", sessions: [] };
  if (sessions.length === 1) return { mode: "single", sessions };
  return { mode: "multiple", sessions };
}

// src/sidepanel/sidepanel.ts
var currentQuoteData = null;
var currentRun = null;
var pendingQuestions = [];
var answeredCount = 0;
var conversationFeed = document.getElementById("conversation-feed");
var btnScan = document.getElementById("btn-scan");
var btnFill = document.getElementById("btn-fill");
var fillCount = document.getElementById("fill-count");
var statusDot = document.getElementById("status-dot");
var statusText = document.getElementById("status-text");
var intelligenceStatus = document.getElementById("intelligence-status");
var geminiKeyRow = document.getElementById("gemini-key-row");
var geminiApiKeyInput = document.getElementById("gemini-api-key-input");
var btnSaveGeminiKey = document.getElementById("btn-save-gemini-key");
var btnToggleGeminiKey = document.getElementById("btn-toggle-gemini-key");
var btnClearGeminiKey = document.getElementById("btn-clear-gemini-key");
var fieldsSummaryDetails = document.getElementById("fields-summary-details");
var summaryTotalCount = document.getElementById("summary-total-count");
var mappingsList = document.getElementById("mappings-list");
document.addEventListener("DOMContentLoaded", async () => {
  await loadQuoteData();
  await checkGeminiStatus();
  await checkForExistingSession();
  setupEventListeners();
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
});
async function loadQuoteData() {
  chrome.runtime.sendMessage({ type: "GET_QUOTE_DATA" }, (response) => {
    if (response?.data) {
      currentQuoteData = response.data;
    }
  });
}
function setAppStatus(status, label) {
  statusDot.className = `dot ${status === "ready" ? "dot-ready" : status === "busy" ? "dot-busy" : "dot-attention"}`;
  statusText.textContent = label;
}
async function checkGeminiStatus() {
  chrome.runtime.sendMessage({ type: "GET_GEMINI_API_KEY" }, (response) => {
    updateGeminiUIState(Boolean(response?.hasKey));
  });
}
function updateGeminiUIState(isConfigured) {
  if (isConfigured) {
    intelligenceStatus.textContent = "Activ\xE9e";
    intelligenceStatus.className = "config-pill active";
    btnClearGeminiKey.classList.remove("hidden");
  } else {
    intelligenceStatus.textContent = "Non activ\xE9e";
    intelligenceStatus.className = "config-pill";
    btnClearGeminiKey.classList.add("hidden");
  }
  geminiKeyRow.classList.add("hidden");
}
function setupEventListeners() {
  btnScan.addEventListener("click", handleScanClick);
  btnFill.addEventListener("click", handleFillClick);
  btnSaveGeminiKey.addEventListener("click", handleSaveGeminiKey);
  btnClearGeminiKey.addEventListener("click", handleClearGeminiKey);
  btnToggleGeminiKey.addEventListener("click", () => {
    geminiKeyRow.classList.toggle("hidden");
  });
}
async function handleSaveGeminiKey() {
  const rawKey = geminiApiKeyInput.value.trim();
  if (!rawKey) return;
  btnSaveGeminiKey.disabled = true;
  chrome.runtime.sendMessage({ type: "SET_GEMINI_API_KEY", apiKey: rawKey }, (response) => {
    btnSaveGeminiKey.disabled = false;
    geminiApiKeyInput.value = "";
    if (response?.success) {
      updateGeminiUIState(true);
      addAssistantMessage("\u2728 L'intelligence est activ\xE9e.");
    }
  });
}
async function handleClearGeminiKey() {
  btnClearGeminiKey.disabled = true;
  chrome.runtime.sendMessage({ type: "CLEAR_GEMINI_API_KEY" }, (response) => {
    btnClearGeminiKey.disabled = false;
    geminiApiKeyInput.value = "";
    if (response?.success) {
      updateGeminiUIState(false);
      addAssistantMessage("D'accord, je continuerai avec une analyse locale.");
    }
  });
}
function handleBackgroundMessage(message) {
  if (message?.type === "AUTO_STEP_DETECTED" && message.run) {
    currentRun = message.run;
    addAssistantMessage("\u21AA\uFE0F Je passe \xE0 l'\xE9tape suivante...");
    processRunResults(message.run);
  }
}
async function checkForExistingSession() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  const context = identifySessionContext(tab.url);
  const sessionKey = buildSessionKey(context);
  chrome.runtime.sendMessage({ type: "LIST_QUOTE_SESSIONS", sessionKey }, (response) => {
    const sessions = response?.sessions || [];
    if (sessions.length === 0) return;
    const presentation = pickSessionPresentation(sessions);
    if (presentation.mode === "single") {
      renderResumeBanner(presentation.sessions[0]);
    } else if (presentation.mode === "multiple") {
      renderSessionChoiceList(presentation.sessions);
    }
  });
}
function renderResumeBanner(session) {
  const card = document.createElement("div");
  card.className = "chat-message assistant";
  card.innerHTML = `
    <div class="avatar">\u{1F916}</div>
    <div class="bubble">
      <p>\u{1F44B} Vous avez d\xE9j\xE0 commenc\xE9 ce formulaire.</p>
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
  card.querySelector('[data-action="resume"]')?.addEventListener("click", () => {
    disableCardControls(card);
    resumeSession(session.sessionId);
  });
  card.querySelector('[data-action="new"]')?.addEventListener("click", () => {
    disableCardControls(card);
    startNewSession();
  });
}
function renderSessionChoiceList(sessions) {
  const card = document.createElement("div");
  card.className = "chat-message assistant";
  const items = sessions.map((s, idx) => {
    const date = new Date(s.updatedAt).toLocaleDateString("fr-FR");
    return `<button class="choice-btn" data-index="${idx}">${escapeHtml(s.product)} \u2014 ${escapeHtml(date)} \u2014 ${escapeHtml(formatStepLabel(s))}</button>`;
  }).join("");
  card.innerHTML = `
    <div class="avatar">\u{1F916}</div>
    <div class="bubble">
      <p>\u{1F44B} J'ai trouv\xE9 plusieurs formulaires en cours.</p>
      <p>Lequel souhaitez-vous reprendre ?</p>
      <div class="question-choices">${items}</div>
      <div class="question-choices"><button class="choice-btn" data-action="new">Nouveau formulaire</button></div>
    </div>
  `;
  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
  card.querySelectorAll("[data-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      disableCardControls(card);
      resumeSession(sessions[idx].sessionId);
    });
  });
  card.querySelector('[data-action="new"]')?.addEventListener("click", () => {
    disableCardControls(card);
    startNewSession();
  });
}
function disableCardControls(card) {
  card.querySelectorAll("button, input").forEach((el) => {
    el.disabled = true;
  });
}
async function resumeSession(sessionId) {
  setAppStatus("busy", "Analyse\u2026");
  addAssistantMessage("\u{1F504} Je reprends l\xE0 o\xF9 vous vous \xE9tiez arr\xEAt\xE9...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setAppStatus("ready", "Pr\xEAt");
    addAssistantMessage("Je ne trouve pas la page \xE0 analyser.");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "RESUME_SESSION", sessionId }, (response) => {
    if (chrome.runtime.lastError || !response?.success || !response.run) {
      setAppStatus("ready", "Pr\xEAt");
      addAssistantMessage("\u26A0\uFE0F Je n'arrive pas \xE0 reprendre ce formulaire sur cette page. V\xE9rifiez qu'elle est bien ouverte.");
      return;
    }
    currentRun = response.run;
    btnScan.classList.add("hidden");
    processRunResults(response.run);
  });
}
function startNewSession() {
  addAssistantMessage("D'accord, je repars sur un nouveau formulaire.");
  resetToInitialState();
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "RESET_SESSION" }, () => {
      void chrome.runtime.lastError;
    });
  });
}
function resetToInitialState() {
  currentRun = null;
  pendingQuestions = [];
  answeredCount = 0;
  btnScan.classList.remove("hidden");
  btnScan.disabled = false;
  btnScan.textContent = getScanButtonLabel("idle");
  btnFill.classList.add("hidden");
  fieldsSummaryDetails.classList.add("hidden");
  setAppStatus("ready", "Pr\xEAt");
}
async function handleScanClick() {
  btnScan.disabled = true;
  btnScan.textContent = getScanButtonLabel("busy");
  setAppStatus("busy", "Analyse\u2026");
  addAssistantMessage("\u{1F440} Je regarde le formulaire...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Aucun onglet actif.");
    chrome.tabs.sendMessage(
      tab.id,
      { type: "DETECT_FIELDS", quoteData: currentQuoteData || void 0 },
      (response) => {
        if (chrome.runtime.lastError || !response?.success || !response.run) {
          btnScan.disabled = false;
          btnScan.textContent = getScanButtonLabel("idle");
          setAppStatus("ready", "Pr\xEAt");
          addAssistantMessage("\u26A0\uFE0F Je n'arrive pas \xE0 analyser cette page. V\xE9rifiez que le formulaire est bien charg\xE9.");
          return;
        }
        currentRun = response.run;
        btnScan.textContent = getScanButtonLabel(response.run.metrics?.cacheHit ? "cache-hit" : "analyzed");
        btnScan.classList.add("hidden");
        processRunResults(response.run);
      }
    );
  } catch (err) {
    btnScan.disabled = false;
    btnScan.textContent = getScanButtonLabel("idle");
    setAppStatus("ready", "Pr\xEAt");
    addAssistantMessage("\u26A0\uFE0F Je n'ai pas pu analyser la page.");
  }
}
function processRunResults(run) {
  answeredCount = 0;
  const usedLocalAnalysis = run.mappings.some((m) => m.source === "local-fallback");
  const autoReady = run.mappings.filter(
    (m) => (m.status === "MATCHED" /* MATCHED */ || m.status === "CONFIRMED" /* CONFIRMED */) && !m.epistemicBlockReason && m.resolvedValue !== void 0 && m.resolvedValue !== null
  );
  pendingQuestions = run.mappings.filter(
    (m) => (m.status === "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */ || !m.canonicalPath || m.resolvedValue === void 0) && !m.epistemicBlockReason && m.field.isInteractable
  );
  renderSummaryList(run);
  renderStepProgress(run);
  const outcomeLines = describeAnalysisOutcome({
    cacheHit: Boolean(run.metrics?.cacheHit),
    usedLocalAnalysis,
    autoReadyCount: autoReady.length,
    pendingCount: pendingQuestions.length
  });
  for (const line of outcomeLines) {
    addAssistantMessage(line);
  }
  if (pendingQuestions.length === 0) {
    setAppStatus("ready", "Pr\xEAt \xE0 remplir");
    showFillButton(autoReady.length);
  } else {
    setAppStatus("attention", "Question en attente");
    askNextQuestion();
  }
}
function renderStepProgress(run) {
  if (!run.stepInfo) return;
  const { currentStep, totalSteps } = run.stepInfo;
  const label = totalSteps ? `\xC9tape ${currentStep} sur ${totalSteps}` : `\xC9tape ${currentStep}`;
  const card = document.createElement("div");
  card.className = "chat-message assistant";
  card.innerHTML = `
    <div class="avatar">\u{1F916}</div>
    <div class="bubble">
      <p class="step-label">${escapeHtml(label)}</p>
      ${totalSteps ? renderProgressBarHtml(run.stepInfo) : ""}
    </div>
  `;
  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
}
function renderProgressBarHtml(step) {
  const percent = computeProgressPercent(step);
  if (percent === null) return "";
  return `<div class="progress-bar"><div class="progress-bar-fill" style="width:${percent}%"></div></div>`;
}
function askNextQuestion() {
  if (pendingQuestions.length === 0) {
    const totalReady = currentRun?.mappings.filter(
      (m) => (m.status === "MATCHED" /* MATCHED */ || m.status === "CONFIRMED" /* CONFIRMED */) && !m.epistemicBlockReason && m.resolvedValue !== void 0
    ).length || 0;
    addAssistantMessage(`\u{1F389} Le formulaire est pr\xEAt.<br>\u2713 ${totalReady} information(s) seront remplies.`);
    setAppStatus("ready", "Pr\xEAt \xE0 remplir");
    showFillButton(totalReady);
    return;
  }
  setAppStatus("attention", "Question en attente");
  const nextMapping = pendingQuestions[0];
  const field = nextMapping.field;
  const fieldLabel = field.label || field.placeholder || field.name || "cette information";
  const questionLine = buildQuestionLine(fieldLabel);
  const questionCard = document.createElement("div");
  questionCard.className = "chat-message assistant";
  const choices = field.options && field.options.length > 0 ? field.options.map((opt) => opt.text || opt.value) : [];
  let inputHtml = "";
  if (choices.length > 0) {
    inputHtml = `
      <div class="question-choices">
        ${choices.map(
      (choice) => `<button class="choice-btn" data-value="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`
    ).join("")}
      </div>
    `;
  } else {
    const inputType = resolveQuestionInputType(field.type);
    const placeholder = inputType === "text" ? "Votre r\xE9ponse..." : "";
    inputHtml = `
      <div class="question-input-row">
        <input type="${inputType}" class="question-input" placeholder="${placeholder}" />
        <button class="choice-submit-btn">Valider</button>
      </div>
    `;
  }
  questionCard.innerHTML = `
    <div class="avatar">\u{1F916}</div>
    <div class="bubble">
      <p>J'ai besoin d'une pr\xE9cision :</p>
      <p class="question-text">${escapeHtml(questionLine)}</p>
      ${inputHtml}
    </div>
  `;
  conversationFeed.appendChild(questionCard);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
  if (choices.length > 0) {
    questionCard.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.value || btn.textContent || "";
        handleUserAnswer(nextMapping, val, questionCard);
      });
    });
  } else {
    const inputEl = questionCard.querySelector(".question-input");
    const submitBtn = questionCard.querySelector(".choice-submit-btn");
    const submitAnswer = () => {
      const val = inputEl.value.trim();
      if (val) {
        handleUserAnswer(nextMapping, val, questionCard);
      }
    };
    submitBtn.addEventListener("click", submitAnswer);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitAnswer();
    });
  }
}
function handleUserAnswer(mapping, answer, cardElement) {
  disableCardControls(cardElement);
  addUserMessage(answer);
  mapping.resolvedValue = answer;
  mapping.status = "CONFIRMED" /* CONFIRMED */;
  mapping.userProvidedValue = answer;
  answeredCount++;
  if (mapping.canonicalPath) {
    persistUserAnswer(mapping.canonicalPath, answer);
  }
  pendingQuestions.shift();
  if (currentRun) {
    renderSummaryList(currentRun);
  }
  setTimeout(() => {
    addAssistantMessage("Parfait \u2713 Je continue.");
    setTimeout(() => askNextQuestion(), 250);
  }, 300);
}
function persistUserAnswer(canonicalPath, value) {
  if (!currentRun?.sessionId) return;
  const sessionId = currentRun.sessionId;
  chrome.runtime.sendMessage({ type: "GET_QUOTE_SESSION", sessionId }, (response) => {
    const session = response?.session || null;
    if (!session) return;
    session.userAnswers[canonicalPath] = value;
    session.completedFields[canonicalPath] = true;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    session.updatedAt = timestamp;
    session.lastVisitedAt = timestamp;
    chrome.runtime.sendMessage({ type: "SAVE_QUOTE_SESSION", session });
  });
}
function showFillButton(count) {
  btnFill.classList.remove("hidden");
  fillCount.textContent = String(count);
  btnFill.disabled = count === 0;
  btnFill.textContent = `Remplir le formulaire (${count})`;
}
async function handleFillClick() {
  if (!currentRun) return;
  btnFill.disabled = true;
  btnFill.textContent = "Remplissage en cours\u2026";
  setAppStatus("busy", "Remplissage\u2026");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Aucun onglet actif.");
    chrome.tabs.sendMessage(
      tab.id,
      { type: "EXECUTE_FILL", mappings: currentRun.mappings },
      (response) => {
        if (response?.success && response.run) {
          btnFill.classList.add("hidden");
          addAssistantMessage("\u2713 Cette \xE9tape est remplie.");
          finishFillFlow(tab.id);
        } else {
          btnFill.disabled = false;
          btnFill.textContent = "R\xE9essayer";
          setAppStatus("attention", "\xC0 v\xE9rifier");
          addAssistantMessage("\u26A0\uFE0F Une erreur est survenue pendant le remplissage. Vous pouvez r\xE9essayer.");
        }
      }
    );
  } catch (err) {
    btnFill.disabled = false;
    setAppStatus("attention", "\xC0 v\xE9rifier");
    addAssistantMessage("\u26A0\uFE0F Je n'ai pas pu remplir le formulaire.");
  }
}
function finishFillFlow(tabId) {
  if (currentRun?.stepInfo?.nextButtonFound) {
    offerNextStep(tabId);
    return;
  }
  setAppStatus("ready", "Termin\xE9");
  const card = document.createElement("div");
  card.className = "chat-message assistant";
  card.innerHTML = `
    <div class="avatar">\u{1F916}</div>
    <div class="bubble">
      <p>\u{1F389} Le formulaire est pr\xEAt.</p>
      <p>Tous les champs que je pouvais remplir ont \xE9t\xE9 compl\xE9t\xE9s.</p>
      <div class="question-choices">
        <button class="choice-btn" data-action="verify">V\xE9rifier le formulaire</button>
      </div>
    </div>
  `;
  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
  card.querySelector('[data-action="verify"]')?.addEventListener("click", () => {
    fieldsSummaryDetails.classList.remove("hidden");
    fieldsSummaryDetails.open = true;
    fieldsSummaryDetails.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
function offerNextStep(tabId) {
  const card = document.createElement("div");
  card.className = "chat-message assistant";
  card.innerHTML = `
    <div class="avatar">\u{1F916}</div>
    <div class="bubble">
      <p>\u2713 Cette \xE9tape est pr\xEAte.</p>
      <div class="question-choices">
        <button class="choice-btn" data-action="continue">Continuer \u2192</button>
      </div>
    </div>
  `;
  conversationFeed.appendChild(card);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
  setAppStatus("ready", "Pr\xEAt");
  card.querySelector('[data-action="continue"]')?.addEventListener("click", () => {
    disableCardControls(card);
    setAppStatus("busy", "Analyse\u2026");
    addAssistantMessage("J'analyse la prochaine \xE9tape...");
    chrome.tabs.sendMessage(tabId, { type: "CLICK_NEXT_STEP" }, () => {
      void chrome.runtime.lastError;
    });
  });
}
function addAssistantMessage(htmlContent) {
  const msg = document.createElement("div");
  msg.className = "chat-message assistant";
  msg.innerHTML = `
    <div class="avatar">\u{1F916}</div>
    <div class="bubble"><p>${htmlContent}</p></div>
  `;
  conversationFeed.appendChild(msg);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
}
function addUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "chat-message user";
  msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  conversationFeed.appendChild(msg);
  conversationFeed.scrollTop = conversationFeed.scrollHeight;
}
function renderSummaryList(run) {
  fieldsSummaryDetails.classList.remove("hidden");
  summaryTotalCount.textContent = String(run.mappings.length);
  mappingsList.innerHTML = "";
  for (const m of run.mappings) {
    const row = document.createElement("div");
    row.className = "summary-row";
    const label = m.field.label || m.field.placeholder || m.field.name || "Champ";
    let statusText2 = "\u2713 Trouv\xE9e";
    let statusClass = "found";
    if (m.epistemicBlockReason) {
      statusText2 = "Non renseign\xE9e";
      statusClass = "missing";
    } else if (m.status === "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */) {
      statusText2 = "\xC0 v\xE9rifier";
      statusClass = "confirm";
    } else if (m.status === "UNMATCHED" /* UNMATCHED */ || !m.resolvedValue && !m.userProvidedValue) {
      statusText2 = "Manquante";
      statusClass = "missing";
    }
    row.innerHTML = `
      <span class="summary-label">${escapeHtml(label)}</span>
      <span class="summary-status ${statusClass}">${statusText2}</span>
    `;
    mappingsList.appendChild(row);
  }
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
//# sourceMappingURL=sidepanel.js.map
