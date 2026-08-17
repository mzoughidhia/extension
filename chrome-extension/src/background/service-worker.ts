import { MockDataProvider } from '../providers/mock-data-provider';
import { ExtensionMessage } from '../shared/messages';
import { ExternalRequestMessage } from '../shared/external-messages';
import { handleAnalyzeDocument, handleFillExtranetQuote, handlePrepareExtranetQuote } from './external-message-handler';
import { FormMemoryStore } from './form-memory-store';
import { SessionStore } from './session-store';
import {
  clearStoredApiKey,
  GeminiError,
  GeminiService,
  getStoredApiKey,
  setStoredApiKey,
} from './gemini.service';

const mockProvider = new MockDataProvider();
const geminiService = new GeminiService();

// Configuration à l'installation de l'extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Form Agent] Service Worker initialisé.');

  // Configurer le side panel pour s'ouvrir au clic sur l'icône de l'extension
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      console.warn('SidePanel API non disponible :', e);
    }
  }

  // Initialiser les données de test par défaut dans le stockage local si absentes
  const initialData = await mockProvider.getQuoteRequest();
  chrome.storage.local.get(['quoteData'], (result) => {
    if (!result.quoteData) {
      chrome.storage.local.set({ quoteData: initialData });
    }
  });
});

// Écouteur de messages central du Service Worker
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'GET_QUOTE_DATA') {
    chrome.storage.local.get(['quoteData'], async (result) => {
      if (result.quoteData) {
        sendResponse({ type: 'QUOTE_DATA_RESPONSE', data: result.quoteData });
      } else {
        const fallback = await mockProvider.getQuoteRequest();
        sendResponse({ type: 'QUOTE_DATA_RESPONSE', data: fallback });
      }
    });
    return true;
  }

  if (message.type === 'SET_QUOTE_DATA') {
    chrome.storage.local.set({ quoteData: message.data }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ─── Gestion de l'analyse Gemini ──────────────────────────────────────────
  if (message.type === 'ANALYZE_WITH_GEMINI') {
    console.log('[FormAgent][Gemini] Service Worker: Requête d\'analyse reçue.');
    geminiService
      .analyzeForm(message.request)
      .then((response) => {
        console.log(`[FormAgent][Gemini] Service Worker: Analyse terminée avec ${response.mappings?.length || 0} mapping(s).`);
        sendResponse({
          type: 'GEMINI_ANALYSIS_RESPONSE',
          success: true,
          response,
        });
      })
      .catch((err: any) => {
        const errorCode = err instanceof GeminiError ? err.code : 'UNKNOWN_ERROR';
        console.warn(`[FormAgent][Gemini] Service Worker: Échec de l'appel (${errorCode}) :`, err.message);
        sendResponse({
          type: 'GEMINI_ANALYSIS_RESPONSE',
          success: false,
          error: err.message || "Erreur lors de l'analyse Gemini",
          errorCode,
        });
      });
    return true; // Maintient la liaison asynchrone ouverte
  }

  // ─── Gestion de la clé API Gemini ─────────────────────────────────────────
  if (message.type === 'SET_GEMINI_API_KEY') {
    setStoredApiKey(message.apiKey)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_GEMINI_API_KEY') {
    getStoredApiKey()
      .then((key) => sendResponse({ success: true, hasKey: Boolean(key && key.length > 0) }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CLEAR_GEMINI_API_KEY') {
    clearStoredApiKey()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ─── Gestion de la mémoire des formulaires (FormMemory / cache) ──────────
  if (message.type === 'GET_FORM_MEMORY') {
    FormMemoryStore.get(message.memoryKey)
      .then((memory) => sendResponse({ type: 'FORM_MEMORY_RESPONSE', memory }))
      .catch(() => sendResponse({ type: 'FORM_MEMORY_RESPONSE', memory: null }));
    return true;
  }

  if (message.type === 'SAVE_FORM_MEMORY') {
    FormMemoryStore.set(message.memory)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'DELETE_FORM_MEMORY') {
    FormMemoryStore.delete(message.memoryKey)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CLEAR_FORM_MEMORY') {
    FormMemoryStore.clear()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ─── Gestion des sessions de devis (QuoteSession) ─────────────────────────
  if (message.type === 'GET_QUOTE_SESSION') {
    SessionStore.get(message.sessionId)
      .then((session) => sendResponse({ type: 'QUOTE_SESSION_RESPONSE', session }))
      .catch(() => sendResponse({ type: 'QUOTE_SESSION_RESPONSE', session: null }));
    return true;
  }

  if (message.type === 'SAVE_QUOTE_SESSION') {
    SessionStore.set(message.session)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'DELETE_QUOTE_SESSION') {
    SessionStore.delete(message.sessionId)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'LIST_QUOTE_SESSIONS') {
    SessionStore.findBySessionKey(message.sessionKey)
      .then((sessions) => sendResponse({ type: 'QUOTE_SESSIONS_LIST_RESPONSE', sessions }))
      .catch(() => sendResponse({ type: 'QUOTE_SESSIONS_LIST_RESPONSE', sessions: [] }));
    return true;
  }
});

/**
 * Canal EXTERNE — messages en provenance d'une page web autorisée (voir
 * `externally_connectable` dans manifest.json), typiquement l'espace Angular.
 * Distinct du canal interne ci-dessus. Aucune donnée sensible (credentials,
 * tokens, cookies) ne transite jamais ici — voir `external-messages.ts`.
 */
chrome.runtime.onMessageExternal.addListener(
  (message: ExternalRequestMessage, _sender, sendResponse) => {
    if (message.type === 'PREPARE_EXTRANET_QUOTE') {
      handlePrepareExtranetQuote(message)
        .then((fields) =>
          sendResponse({
            type: 'EXTRANET_FORM_REQUIREMENTS',
            quoteFileId: message.quoteFileId,
            extranetId: message.extranetId,
            fields,
          })
        )
        .catch((err: unknown) =>
          sendResponse({
            type: 'EXTRANET_ANALYSIS_ERROR',
            quoteFileId: message.quoteFileId,
            extranetId: message.extranetId,
            error: err instanceof Error ? err.message : "Erreur lors de l'analyse de l'extranet.",
          })
        );
      return true;
    }

    if (message.type === 'FILL_EXTRANET_QUOTE') {
      handleFillExtranetQuote(message)
        .then((outcome) =>
          sendResponse({
            type: 'FILL_EXTRANET_RESULT',
            quoteFileId: message.quoteFileId,
            extranetId: message.extranetId,
            status: outcome.status,
            filledFieldsCount: outcome.filledFieldsCount,
            missingFields: outcome.missingFields,
            lastStepReached: outcome.lastStepReached,
          })
        )
        .catch((err: unknown) =>
          sendResponse({
            type: 'FILL_EXTRANET_ERROR',
            quoteFileId: message.quoteFileId,
            extranetId: message.extranetId,
            error: err instanceof Error ? err.message : "Erreur lors du remplissage de l'extranet.",
          })
        );
      return true;
    }

    if (message.type === 'ANALYZE_DOCUMENT') {
      handleAnalyzeDocument(message, geminiService)
        .then((fields) =>
          sendResponse({
            type: 'DOCUMENT_OCR_RESULT',
            documentId: message.documentId,
            fields,
          })
        )
        .catch((err: unknown) =>
          sendResponse({
            type: 'DOCUMENT_OCR_ERROR',
            documentId: message.documentId,
            error: err instanceof Error ? err.message : "Erreur lors de l'analyse du document.",
          })
        );
      return true;
    }

    return false;
  }
);
