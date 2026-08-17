import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import { createEmptyQuoteRequest } from '../models/quote-request.model';
import {
  FormAgentAnalysisError,
  FormAgentBridgeService,
  FormAgentFillError,
  FormAgentUnavailableError,
  FormAgentUnreachableError,
} from './form-agent-bridge.service';

describe('FormAgentBridgeService', () => {
  let service: FormAgentBridgeService;
  const originalExtensionId = environment.formAgentExtensionId;
  const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FormAgentBridgeService);
  });

  afterEach(() => {
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = originalExtensionId;
    (globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
  });

  function callParams() {
    return {
      quoteFileId: 'file-1',
      extranetId: 'april-moto',
      extranetUrl: 'https://www.april-on.fr/home?oid=x&name=Moto',
      quoteData: createEmptyQuoteRequest(),
    };
  }

  it("émet FormAgentUnavailableError si chrome.runtime n'existe pas (extension non installée)", (done) => {
    (globalThis as unknown as { chrome?: unknown }).chrome = undefined;
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';

    service.prepareExtranetQuote(callParams()).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(FormAgentUnavailableError);
        expect(err.message).toBe("Form Agent n'est pas disponible.");
        done();
      },
    });
  });

  it("émet FormAgentUnavailableError si l'id de l'extension n'est pas configuré", (done) => {
    (globalThis as unknown as { chrome?: unknown }).chrome = { runtime: { sendMessage: jasmine.createSpy() } };
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = '';

    service.prepareExtranetQuote(callParams()).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(FormAgentUnavailableError);
        done();
      },
    });
  });

  it("émet FormAgentUnreachableError si l'extension ne répond pas (lastError)", (done) => {
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
    (globalThis as unknown as { chrome?: unknown }).chrome = {
      runtime: {
        lastError: { message: 'Could not establish connection' },
        sendMessage: (_id: string, _msg: unknown, cb: (r: unknown) => void) => cb(undefined),
      },
    };

    service.prepareExtranetQuote(callParams()).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(FormAgentUnreachableError);
        expect(err.message).toBe('Impossible de communiquer avec Form Agent.');
        done();
      },
    });
  });

  it('émet FormAgentUnreachableError après expiration du délai (aucune réponse)', fakeAsync(() => {
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
    (globalThis as unknown as { chrome?: unknown }).chrome = {
      runtime: { sendMessage: () => void 0 }, // ne rappelle jamais le callback
    };

    let receivedError: unknown;
    service.prepareExtranetQuote(callParams()).subscribe({ error: (err) => (receivedError = err) });

    tick(30_000);

    expect(receivedError).toBeInstanceOf(FormAgentUnreachableError);
  }));

  it('émet FormAgentAnalysisError si l\'extension renvoie une erreur d\'analyse', (done) => {
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
    (globalThis as unknown as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: (_id: string, _msg: unknown, cb: (r: unknown) => void) =>
          cb({ type: 'EXTRANET_ANALYSIS_ERROR', quoteFileId: 'file-1', extranetId: 'april-moto', error: 'GeminiError: HTTP 429' }),
      },
    };

    service.prepareExtranetQuote(callParams()).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(FormAgentAnalysisError);
        // Aucun détail technique interne (Gemini, codes HTTP) ne doit fuiter dans le message affiché.
        expect(err.message).not.toContain('Gemini');
        expect(err.message).not.toContain('429');
        done();
      },
    });
  });

  it("transmet les champs requis reçus de l'extension, convertis pour le questionnaire", (done) => {
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
    (globalThis as unknown as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: (_id: string, _msg: unknown, cb: (r: unknown) => void) =>
          cb({
            type: 'EXTRANET_FORM_REQUIREMENTS',
            quoteFileId: 'file-1',
            extranetId: 'april-moto',
            fields: [{ canonicalPath: 'vehicle.brand', label: 'Marque', type: 'text', required: true }],
          }),
      },
    };

    service.prepareExtranetQuote(callParams()).subscribe({
      next: (fields) => {
        expect(fields).toEqual([{ canonicalPath: 'vehicle.brand', label: 'Marque', type: 'text', choices: undefined, required: true }]);
        done();
      },
    });
  });

  it('envoie le message PREPARE_EXTRANET_QUOTE avec les paramètres fournis', () => {
    (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
    const sendMessageSpy = jasmine.createSpy();
    (globalThis as unknown as { chrome?: unknown }).chrome = { runtime: { sendMessage: sendMessageSpy } };

    const params = callParams();
    service.prepareExtranetQuote(params).subscribe();

    expect(sendMessageSpy).toHaveBeenCalledWith(
      'ext-id',
      jasmine.objectContaining({
        type: 'PREPARE_EXTRANET_QUOTE',
        quoteFileId: params.quoteFileId,
        extranetId: params.extranetId,
        extranetUrl: params.extranetUrl,
      }),
      jasmine.any(Function)
    );
  });

  describe('fillExtranetQuote', () => {
    it('envoie le message FILL_EXTRANET_QUOTE avec les paramètres fournis', () => {
      (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
      const sendMessageSpy = jasmine.createSpy();
      (globalThis as unknown as { chrome?: unknown }).chrome = { runtime: { sendMessage: sendMessageSpy } };

      const params = callParams();
      service.fillExtranetQuote(params).subscribe();

      expect(sendMessageSpy).toHaveBeenCalledWith(
        'ext-id',
        jasmine.objectContaining({ type: 'FILL_EXTRANET_QUOTE', quoteFileId: params.quoteFileId }),
        jasmine.any(Function)
      );
    });

    it('transmet le résultat de remplissage, champs manquants convertis pour le questionnaire', (done) => {
      (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
      (globalThis as unknown as { chrome?: unknown }).chrome = {
        runtime: {
          sendMessage: (_id: string, _msg: unknown, cb: (r: unknown) => void) =>
            cb({
              type: 'FILL_EXTRANET_RESULT',
              quoteFileId: 'file-1',
              extranetId: 'april-moto',
              status: 'partially_filled',
              filledFieldsCount: 4,
              missingFields: [{ canonicalPath: 'vehicle.parkingType', label: 'Stationnement', type: 'choice', required: true }],
              lastStepReached: 1,
            }),
        },
      };

      service.fillExtranetQuote(callParams()).subscribe({
        next: (outcome) => {
          expect(outcome.status).toBe('partially_filled');
          expect(outcome.filledFieldsCount).toBe(4);
          expect(outcome.missingFields.length).toBe(1);
          expect(outcome.missingFields[0].canonicalPath).toBe('vehicle.parkingType');
          expect(outcome.lastStepReached).toBe(1);
          done();
        },
      });
    });

    it("émet FormAgentFillError si l'extension renvoie une erreur de remplissage, sans détail technique", (done) => {
      (environment as { formAgentExtensionId: string }).formAgentExtensionId = 'ext-id';
      (globalThis as unknown as { chrome?: unknown }).chrome = {
        runtime: {
          sendMessage: (_id: string, _msg: unknown, cb: (r: unknown) => void) =>
            cb({ type: 'FILL_EXTRANET_ERROR', quoteFileId: 'file-1', extranetId: 'april-moto', error: 'GeminiError: HTTP 500' }),
        },
      };

      service.fillExtranetQuote(callParams()).subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(FormAgentFillError);
          expect(err.message).not.toContain('Gemini');
          expect(err.message).not.toContain('500');
          done();
        },
      });
    });
  });
});
