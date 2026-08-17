import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { RequiredField } from '../models/questionnaire.model';
import {
  AnalyzeDocumentMessage,
  FillExtranetQuoteMessage,
  FillOutcome,
  FormAgentOcrField,
  FormAgentResponseMessage,
  PrepareExtranetQuoteMessage,
  toRequiredFields,
} from '../models/form-agent-bridge.model';
import { QuoteRequest } from '../models/quote-request.model';

/** L'extension n'est pas installée / le navigateur ne l'expose pas. */
export class FormAgentUnavailableError extends Error {
  constructor() {
    super("Form Agent n'est pas disponible.");
    this.name = 'FormAgentUnavailableError';
  }
}

/** L'extension est présente mais ne répond pas (timeout, onglet fermé, etc.). */
export class FormAgentUnreachableError extends Error {
  constructor() {
    super('Impossible de communiquer avec Form Agent.');
    this.name = 'FormAgentUnreachableError';
  }
}

/** Le formulaire de l'extranet n'a pas pu être analysé (jamais de détail Gemini exposé). */
export class FormAgentAnalysisError extends Error {
  constructor() {
    super("Le formulaire n'a pas pu être analysé sur cette page.");
    this.name = 'FormAgentAnalysisError';
  }
}

/** Le remplissage de l'extranet a échoué (jamais de détail Gemini exposé). */
export class FormAgentFillError extends Error {
  constructor() {
    super("Le remplissage de l'extranet a échoué.");
    this.name = 'FormAgentFillError';
  }
}

/** La lecture du document a échoué (jamais de détail Gemini/clé API exposé). */
export class FormAgentDocumentAnalysisError extends Error {
  constructor() {
    super('La lecture du document a échoué.');
    this.name = 'FormAgentDocumentAnalysisError';
  }
}

const RESPONSE_TIMEOUT_MS = 25_000;

/** Le strict sous-ensemble de `chrome.runtime` utilisé ici — évite une dépendance `@types/chrome`. */
interface ChromeRuntimeLike {
  readonly lastError?: { message?: string };
  sendMessage(
    extensionId: string,
    message: unknown,
    responseCallback: (response: FormAgentResponseMessage | undefined) => void
  ): void;
}

function getChromeRuntime(): ChromeRuntimeLike | undefined {
  return (globalThis as unknown as { chrome?: { runtime?: ChromeRuntimeLike } }).chrome?.runtime;
}

/**
 * Pont EXTERNE avec l'extension Chrome "Form Agent"
 * (`chrome.runtime.sendMessage(extensionId, ...)`).
 *
 * Ne duplique JAMAIS le pipeline d'analyse ni de remplissage (Gemini /
 * FormMemory / QuoteSession / FormFiller restent entièrement dans
 * l'extension) : ce service envoie uniquement le dossier canonique déjà
 * connu et reçoit en retour des faits (champs demandés, champs remplis).
 */
@Injectable({ providedIn: 'root' })
export class FormAgentBridgeService {
  /**
   * Demande à Form Agent d'analyser l'extranet cible et de renvoyer les
   * champs qu'il demande réellement. Émet une seule fois puis se termine.
   */
  prepareExtranetQuote(params: {
    quoteFileId: string;
    extranetId: string;
    extranetUrl: string;
    quoteData: QuoteRequest;
  }): Observable<RequiredField[]> {
    const message: PrepareExtranetQuoteMessage = {
      type: 'PREPARE_EXTRANET_QUOTE',
      quoteFileId: params.quoteFileId,
      extranetId: params.extranetId,
      extranetUrl: params.extranetUrl,
      quoteData: params.quoteData,
    };

    return this.sendExternalMessage(message, (response) => {
      if (response.type === 'EXTRANET_ANALYSIS_ERROR') {
        throw new FormAgentAnalysisError();
      }
      if (response.type !== 'EXTRANET_FORM_REQUIREMENTS') {
        throw new FormAgentUnreachableError();
      }
      return toRequiredFields(response.fields);
    });
  }

  /**
   * Demande à Form Agent de remplir réellement l'extranet à partir du
   * dossier fourni (KNOWN uniquement — jamais de valeur inventée, garanti
   * par le pipeline existant de l'extension). Ne déclenche jamais d'action
   * irréversible (soumission, signature) : uniquement le remplissage des champs.
   */
  fillExtranetQuote(params: {
    quoteFileId: string;
    extranetId: string;
    extranetUrl: string;
    quoteData: QuoteRequest;
  }): Observable<FillOutcome> {
    const message: FillExtranetQuoteMessage = {
      type: 'FILL_EXTRANET_QUOTE',
      quoteFileId: params.quoteFileId,
      extranetId: params.extranetId,
      extranetUrl: params.extranetUrl,
      quoteData: params.quoteData,
    };

    return this.sendExternalMessage(message, (response) => {
      if (response.type === 'FILL_EXTRANET_ERROR') {
        throw new FormAgentFillError();
      }
      if (response.type !== 'FILL_EXTRANET_RESULT') {
        throw new FormAgentUnreachableError();
      }
      return {
        status: response.status,
        filledFieldsCount: response.filledFieldsCount,
        missingFields: toRequiredFields(response.missingFields),
        lastStepReached: response.lastStepReached,
      };
    });
  }

  /**
   * Demande à Form Agent de lire un document (PDF/PNG/JPEG) via le même
   * service Gemini que l'analyse de formulaire — la clé API reste dans le
   * stockage de l'extension, jamais transmise à Angular. Ne déclenche aucun
   * remplissage d'extranet.
   */
  analyzeDocument(params: { documentId: string; documentBase64: string; mimeType: string }): Observable<FormAgentOcrField[]> {
    const message: AnalyzeDocumentMessage = {
      type: 'ANALYZE_DOCUMENT',
      documentId: params.documentId,
      documentBase64: params.documentBase64,
      mimeType: params.mimeType,
    };

    return this.sendExternalMessage(message, (response) => {
      if (response.type === 'DOCUMENT_OCR_ERROR') {
        throw new FormAgentDocumentAnalysisError();
      }
      if (response.type !== 'DOCUMENT_OCR_RESULT') {
        throw new FormAgentUnreachableError();
      }
      return response.fields;
    });
  }

  /**
   * Envoie un message externe à l'extension et adapte la réponse — factorise
   * la gestion de disponibilité/délai/erreurs commune à tous les échanges.
   */
  private sendExternalMessage<T>(
    message: unknown,
    adapt: (response: FormAgentResponseMessage) => T
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      const runtime = getChromeRuntime();

      if (!runtime?.sendMessage || !environment.formAgentExtensionId) {
        subscriber.error(new FormAgentUnavailableError());
        return;
      }

      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        subscriber.error(new FormAgentUnreachableError());
      }, RESPONSE_TIMEOUT_MS);

      try {
        runtime.sendMessage(environment.formAgentExtensionId, message, (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);

          if (runtime.lastError || !response) {
            subscriber.error(new FormAgentUnreachableError());
            return;
          }

          try {
            subscriber.next(adapt(response));
            subscriber.complete();
          } catch (err) {
            subscriber.error(err);
          }
        });
      } catch {
        settled = true;
        clearTimeout(timeoutId);
        subscriber.error(new FormAgentUnreachableError());
      }

      return () => clearTimeout(timeoutId);
    });
  }
}
