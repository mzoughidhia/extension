import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

// Charge le VRAI code src/ — orchestration du protocole externe Angular ↔ extension.
const {
  toExternalRequiredFields,
  inferQuestionType,
  handlePrepareExtranetQuote,
  computeFillOutcome,
  handleFillExtranetQuote,
  handleAnalyzeDocument,
} = await loadRealModule('src/background/external-message-handler.ts');

function field(overrides = {}) {
  return {
    elementId: 'field_1',
    selector: '#f1',
    tagName: 'input',
    type: 'text',
    name: 'brand',
    id: 'f_brand',
    label: 'Marque',
    placeholder: null,
    ariaLabel: null,
    surroundingText: null,
    sectionName: null,
    isInteractable: true,
    ...overrides,
  };
}

function mapping(overrides = {}) {
  return {
    field: field(),
    canonicalPath: 'vehicle.brand',
    confidence: 0.95,
    reasons: ['test'],
    status: 'MATCHED',
    resolvedValue: undefined,
    ...overrides,
  };
}

function fillResult(overrides = {}) {
  return {
    elementId: 'field_1',
    selector: '#f1',
    canonicalPath: 'vehicle.brand',
    valueFilled: 'Yamaha',
    success: true,
    ...overrides,
  };
}

function angularQuoteRequest(overrides = {}) {
  return {
    client: { firstName: '', lastName: '', nationalId: null, birthDate: null, phone: null, email: null, address: null, postalCode: null, city: null, country: null },
    vehicle: { registration: null, brand: null, model: null, version: null, firstRegistrationDate: null, fiscalPower: null, vehicleValue: null, vehicleType: null, usage: null, parkingType: null },
    driver: { sameAsClient: true, firstName: null, lastName: null, birthDate: null, licenseDate: null, profession: null, phone: null },
    insuranceHistory: {
      previousInsurer: null, previousContractStartDate: null, previousContractEndDate: null,
      seniority: { value: null, knowledge: 'UNKNOWN' }, bonusMalus: { value: null, knowledge: 'UNKNOWN' },
      claimsCount: { value: null, knowledge: 'UNKNOWN' }, responsibleClaimsCount: { value: null, knowledge: 'UNKNOWN' },
      nonResponsibleClaimsCount: { value: null, knowledge: 'UNKNOWN' }, wasTerminated: false, terminatedByInsurer: false,
      terminationReason: null, terminationDate: null,
    },
    ...overrides,
  };
}

describe('external-message-handler — protocole Angular ↔ extension (vrai code src/)', () => {
  describe('inferQuestionType (fonction pure)', () => {
    it('un select avec options devient "choice"', () => {
      const f = field({ tagName: 'select', type: 'select', options: [{ value: 'a', text: 'A' }] });
      assert.equal(inferQuestionType(f), 'choice');
    });

    it('une checkbox devient "boolean"', () => {
      assert.equal(inferQuestionType(field({ type: 'checkbox' })), 'boolean');
    });

    it('un input number devient "number"', () => {
      assert.equal(inferQuestionType(field({ type: 'number' })), 'number');
    });

    it('un input date devient "date"', () => {
      assert.equal(inferQuestionType(field({ type: 'date' })), 'date');
    });

    it('un champ texte simple devient "text"', () => {
      assert.equal(inferQuestionType(field({ type: 'text' })), 'text');
    });
  });

  describe('toExternalRequiredFields (fonction pure)', () => {
    it('ne transmet que les champs reconnus dans le catalogue canonique fermé', () => {
      const mappings = [mapping({ canonicalPath: 'vehicle.brand' }), mapping({ canonicalPath: null, field: field({ elementId: 'f2' }) })];
      const result = toExternalRequiredFields(mappings);
      assert.equal(result.length, 1);
      assert.equal(result[0].canonicalPath, 'vehicle.brand');
    });

    it("traduit l'adresse imbriquée vers le format Angular à plat", () => {
      const mappings = [mapping({ canonicalPath: 'client.address.street', field: field({ elementId: 'f3', label: 'Adresse' }) })];
      const result = toExternalRequiredFields(mappings);
      assert.equal(result[0].canonicalPath, 'client.address');
    });

    it("n'expose jamais confidence, fingerprint ni détail technique interne", () => {
      const mappings = [mapping()];
      const result = toExternalRequiredFields(mappings);
      const serialized = JSON.stringify(result);
      assert.ok(!('confidence' in result[0]));
      assert.ok(!serialized.includes('fingerprint'));
      assert.ok(!serialized.includes('Gemini'));
    });

    it('transmet les options du champ comme choix', () => {
      const mappings = [
        mapping({
          canonicalPath: 'vehicle.usage',
          field: field({
            elementId: 'f4',
            tagName: 'select',
            type: 'select',
            label: 'Usage',
            options: [
              { value: 'PRIVATE', text: 'Privé' },
              { value: 'PROFESSIONAL', text: 'Professionnel' },
            ],
          }),
        }),
      ];
      const result = toExternalRequiredFields(mappings);
      assert.deepEqual(result[0].choices, [
        { value: 'PRIVATE', label: 'Privé' },
        { value: 'PROFESSIONAL', label: 'Professionnel' },
      ]);
    });

    it('ajoute une raison simple pour un champ à confirmer, sans score numérique', () => {
      const mappings = [mapping({ status: 'NEEDS_CONFIRMATION' })];
      const result = toExternalRequiredFields(mappings);
      assert.equal(result[0].reason, 'Confirmation recommandée');
    });

    it('déduplique deux mappings pointant vers le même chemin canonique', () => {
      const mappings = [
        mapping({ field: field({ elementId: 'a' }) }),
        mapping({ field: field({ elementId: 'b' }) }),
      ];
      const result = toExternalRequiredFields(mappings);
      assert.equal(result.length, 1);
    });

    it('un champ non modélisé côté Angular (ex : vehicle.purchaseDate) est filtré', () => {
      const mappings = [mapping({ canonicalPath: 'vehicle.purchaseDate' })];
      const result = toExternalRequiredFields(mappings);
      assert.equal(result.length, 0);
    });
  });

  describe('handlePrepareExtranetQuote (orchestration réelle, API navigateur simulée)', () => {
    let sentToTab;

    beforeEach(() => {
      sentToTab = null;
      globalThis.chrome = {
        tabs: {
          query: async () => [],
          create: async ({ url }) => ({ id: 42, url, status: 'complete' }),
          update: async () => {},
          get: (_id, cb) => cb({ status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} },
          sendMessage: (tabId, msg, cb) => {
            sentToTab = { tabId, msg };
            cb({
              success: true,
              run: {
                runId: 'run_1',
                mappings: [mapping({ canonicalPath: 'vehicle.brand' })],
              },
            });
          },
        },
        runtime: { lastError: undefined },
      };
    });

    it('ouvre un onglet, sollicite DETECT_FIELDS (pipeline existant inchangé), et renvoie les champs requis', async () => {
      const result = await handlePrepareExtranetQuote({
        type: 'PREPARE_EXTRANET_QUOTE',
        quoteFileId: 'file-1',
        extranetId: 'april-moto',
        extranetUrl: 'https://www.april-on.fr/home?oid=x&name=Moto',
        quoteData: {
          client: { firstName: 'Mohamed', lastName: 'Mzoughi', nationalId: null, birthDate: null, phone: null, email: null, address: null, postalCode: null, city: null, country: null },
          vehicle: { registration: null, brand: null, model: null, version: null, firstRegistrationDate: null, fiscalPower: null, vehicleValue: null, vehicleType: null, usage: null, parkingType: null },
          driver: { sameAsClient: true, firstName: null, lastName: null, birthDate: null, licenseDate: null, profession: null, phone: null },
          insuranceHistory: {
            previousInsurer: null, previousContractStartDate: null, previousContractEndDate: null,
            seniority: { value: null, knowledge: 'UNKNOWN' }, bonusMalus: { value: null, knowledge: 'UNKNOWN' },
            claimsCount: { value: null, knowledge: 'UNKNOWN' }, responsibleClaimsCount: { value: null, knowledge: 'UNKNOWN' },
            nonResponsibleClaimsCount: { value: null, knowledge: 'UNKNOWN' }, wasTerminated: false, terminatedByInsurer: false,
            terminationReason: null, terminationDate: null,
          },
        },
      });

      assert.equal(sentToTab.msg.type, 'DETECT_FIELDS');
      assert.equal(result.length, 1);
      assert.equal(result[0].canonicalPath, 'vehicle.brand');
    });

    it("réutilise un onglet déjà ouvert sur l'extranet plutôt que d'en créer un nouveau", async () => {
      let createCalled = false;
      globalThis.chrome.tabs.query = async () => [{ id: 7, url: 'https://www.april-on.fr/home?oid=x', status: 'complete' }];
      globalThis.chrome.tabs.create = async () => {
        createCalled = true;
        return { id: 99 };
      };

      await handlePrepareExtranetQuote({
        type: 'PREPARE_EXTRANET_QUOTE',
        quoteFileId: 'file-1',
        extranetId: 'april-moto',
        extranetUrl: 'https://www.april-on.fr/home?oid=x&name=Moto',
        quoteData: {
          client: { firstName: '', lastName: '', nationalId: null, birthDate: null, phone: null, email: null, address: null, postalCode: null, city: null, country: null },
          vehicle: { registration: null, brand: null, model: null, version: null, firstRegistrationDate: null, fiscalPower: null, vehicleValue: null, vehicleType: null, usage: null, parkingType: null },
          driver: { sameAsClient: true, firstName: null, lastName: null, birthDate: null, licenseDate: null, profession: null, phone: null },
          insuranceHistory: {
            previousInsurer: null, previousContractStartDate: null, previousContractEndDate: null,
            seniority: { value: null, knowledge: 'UNKNOWN' }, bonusMalus: { value: null, knowledge: 'UNKNOWN' },
            claimsCount: { value: null, knowledge: 'UNKNOWN' }, responsibleClaimsCount: { value: null, knowledge: 'UNKNOWN' },
            nonResponsibleClaimsCount: { value: null, knowledge: 'UNKNOWN' }, wasTerminated: false, terminatedByInsurer: false,
            terminationReason: null, terminationDate: null,
          },
        },
      });

      assert.equal(createCalled, false, "l'onglet existant doit être réutilisé");
      assert.equal(sentToTab.tabId, 7);
    });
  });

  describe('computeFillOutcome (fonction pure)', () => {
    it('status "ready" quand tous les champs canoniques ont été remplis', () => {
      const mappings = [mapping({ canonicalPath: 'vehicle.brand' })];
      const results = [fillResult({ canonicalPath: 'vehicle.brand', success: true })];

      const outcome = computeFillOutcome(mappings, results);
      assert.equal(outcome.status, 'ready');
      assert.equal(outcome.filledFieldsCount, 1);
      assert.deepEqual(outcome.missingFields, []);
    });

    it('status "partially_filled" quand certains champs manquent encore', () => {
      const mappings = [
        mapping({ canonicalPath: 'vehicle.brand', field: field({ elementId: 'a' }) }),
        mapping({ canonicalPath: 'vehicle.model', field: field({ elementId: 'b', label: 'Modèle' }) }),
      ];
      const results = [fillResult({ canonicalPath: 'vehicle.brand', success: true })];

      const outcome = computeFillOutcome(mappings, results);
      assert.equal(outcome.status, 'partially_filled');
      assert.equal(outcome.filledFieldsCount, 1);
      assert.equal(outcome.missingFields.length, 1);
      assert.equal(outcome.missingFields[0].canonicalPath, 'vehicle.model');
    });

    it("status \"blocked\" quand rien n'a pu être rempli", () => {
      const mappings = [mapping({ canonicalPath: 'vehicle.brand' })];
      const outcome = computeFillOutcome(mappings, []);

      assert.equal(outcome.status, 'blocked');
      assert.equal(outcome.filledFieldsCount, 0);
      assert.equal(outcome.missingFields.length, 1);
    });

    it('un champ UNMATCHED (canonicalPath null) ne pollue jamais missingFields', () => {
      const mappings = [mapping({ canonicalPath: null })];
      const outcome = computeFillOutcome(mappings, []);
      assert.deepEqual(outcome.missingFields, []);
    });
  });

  describe('handleFillExtranetQuote (orchestration réelle, API navigateur simulée)', () => {
    let messagesSentToTab;

    function installChromeMock(runResponse, fillResponse) {
      messagesSentToTab = [];
      globalThis.chrome = {
        tabs: {
          query: async () => [],
          create: async ({ url }) => ({ id: 42, url, status: 'complete' }),
          update: async () => {},
          get: (_id, cb) => cb({ status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} },
          sendMessage: (tabId, msg, cb) => {
            messagesSentToTab.push(msg);
            if (msg.type === 'DETECT_FIELDS') {
              cb({ success: true, run: runResponse });
            } else if (msg.type === 'EXECUTE_FILL') {
              cb({ success: true, run: { fillResults: fillResponse } });
            }
          },
        },
        runtime: { lastError: undefined },
      };
    }

    it("analyse puis remplit dans le même aller-retour, sans dupliquer le pipeline (DETECT_FIELDS puis EXECUTE_FILL)", async () => {
      installChromeMock(
        { runId: 'run_1', mappings: [mapping({ canonicalPath: 'vehicle.brand' })], stepInfo: { currentStep: 2 } },
        [fillResult({ canonicalPath: 'vehicle.brand', success: true })]
      );

      const outcome = await handleFillExtranetQuote({
        type: 'FILL_EXTRANET_QUOTE',
        quoteFileId: 'file-1',
        extranetId: 'april-moto',
        extranetUrl: 'https://www.april-on.fr/home?oid=x&name=Moto',
        quoteData: angularQuoteRequest(),
      });

      assert.deepEqual(messagesSentToTab.map((m) => m.type), ['DETECT_FIELDS', 'EXECUTE_FILL']);
      assert.equal(outcome.status, 'ready');
      assert.equal(outcome.filledFieldsCount, 1);
      assert.equal(outcome.lastStepReached, 2);
    });

    it("ne déclenche jamais d'action au-delà du remplissage des champs (pas de CLICK_NEXT_STEP ni d'action de soumission)", async () => {
      installChromeMock(
        { runId: 'run_1', mappings: [mapping({ canonicalPath: 'vehicle.brand' })] },
        [fillResult({ canonicalPath: 'vehicle.brand', success: true })]
      );

      await handleFillExtranetQuote({
        type: 'FILL_EXTRANET_QUOTE',
        quoteFileId: 'file-1',
        extranetId: 'april-moto',
        extranetUrl: 'https://www.april-on.fr/home?oid=x&name=Moto',
        quoteData: angularQuoteRequest(),
      });

      const messageTypes = messagesSentToTab.map((m) => m.type);
      assert.ok(!messageTypes.includes('CLICK_NEXT_STEP'));
      assert.equal(messageTypes.length, 2, 'uniquement DETECT_FIELDS puis EXECUTE_FILL, rien de plus');
    });

    it('retourne les champs manquants pour qu\'Angular puisse rouvrir le questionnaire', async () => {
      installChromeMock(
        {
          runId: 'run_1',
          mappings: [
            mapping({ canonicalPath: 'vehicle.brand', field: field({ elementId: 'a' }) }),
            mapping({ canonicalPath: 'vehicle.parkingType', field: field({ elementId: 'b', label: 'Stationnement' }) }),
          ],
        },
        [fillResult({ canonicalPath: 'vehicle.brand', success: true })]
      );

      const outcome = await handleFillExtranetQuote({
        type: 'FILL_EXTRANET_QUOTE',
        quoteFileId: 'file-1',
        extranetId: 'april-moto',
        extranetUrl: 'https://www.april-on.fr/home?oid=x&name=Moto',
        quoteData: angularQuoteRequest(),
      });

      assert.equal(outcome.status, 'partially_filled');
      assert.equal(outcome.missingFields.length, 1);
      assert.equal(outcome.missingFields[0].canonicalPath, 'vehicle.parkingType');
    });

    it('ne transmet aucun credential, cookie ou token dans le message envoyé au content script', async () => {
      installChromeMock(
        { runId: 'run_1', mappings: [mapping({ canonicalPath: 'vehicle.brand' })] },
        [fillResult({ canonicalPath: 'vehicle.brand', success: true })]
      );

      await handleFillExtranetQuote({
        type: 'FILL_EXTRANET_QUOTE',
        quoteFileId: 'file-1',
        extranetId: 'april-moto',
        extranetUrl: 'https://www.april-on.fr/home?oid=x&name=Moto',
        quoteData: angularQuoteRequest({
          client: { ...angularQuoteRequest().client, firstName: 'Mohamed' },
        }),
      });

      const serialized = JSON.stringify(messagesSentToTab);
      assert.ok(!/password|cookie|token|credential/i.test(serialized));
    });
  });

  describe('handleAnalyzeDocument (OCR réel via Gemini, orchestration réelle)', () => {
    function stubGeminiService(fields) {
      const calls = [];
      return {
        calls,
        async analyzeDocument(request) {
          calls.push(request);
          return { fields, model: 'gemini-2.5-flash' };
        },
      };
    }

    it("appelle geminiService.analyzeDocument avec le document et le catalogue fermé — jamais de clé API dans le message", async () => {
      const geminiService = stubGeminiService([]);

      await handleAnalyzeDocument(
        { type: 'ANALYZE_DOCUMENT', documentId: 'doc-1', documentBase64: 'QUJD', mimeType: 'image/png' },
        geminiService
      );

      assert.equal(geminiService.calls.length, 1);
      assert.equal(geminiService.calls[0].documentBase64, 'QUJD');
      assert.equal(geminiService.calls[0].mimeType, 'image/png');
      assert.ok(Array.isArray(geminiService.calls[0].allowedCanonicalPaths));
      const serialized = JSON.stringify(geminiService.calls[0]);
      assert.ok(!/api[_-]?key/i.test(serialized));
    });

    it('convertit une confiance Gemini élevée en "high" et une confiance faible en "low"', async () => {
      const geminiService = stubGeminiService([
        { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 0.97 },
        { canonicalPath: 'vehicle.model', value: 'MT-07', confidence: 0.4 },
      ]);

      const fields = await handleAnalyzeDocument(
        { type: 'ANALYZE_DOCUMENT', documentId: 'doc-1', documentBase64: 'QUJD', mimeType: 'image/png' },
        geminiService
      );

      assert.deepEqual(
        fields.find((f) => f.canonicalPath === 'vehicle.brand'),
        { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' }
      );
      assert.deepEqual(
        fields.find((f) => f.canonicalPath === 'vehicle.model'),
        { canonicalPath: 'vehicle.model', value: 'MT-07', confidence: 'low' }
      );
    });

    it('traduit les chemins canoniques extension → Angular (ex : client.address.street → client.address)', async () => {
      const geminiService = stubGeminiService([
        { canonicalPath: 'client.address.street', value: '12 rue des Lilas', confidence: 0.9 },
      ]);

      const fields = await handleAnalyzeDocument(
        { type: 'ANALYZE_DOCUMENT', documentId: 'doc-1', documentBase64: 'QUJD', mimeType: 'application/pdf' },
        geminiService
      );

      assert.equal(fields.length, 1);
      assert.equal(fields[0].canonicalPath, 'client.address');
    });

    it("n'envoie jamais de score de confiance brut à Angular, uniquement high/low", async () => {
      const geminiService = stubGeminiService([{ canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 0.973421 }]);

      const fields = await handleAnalyzeDocument(
        { type: 'ANALYZE_DOCUMENT', documentId: 'doc-1', documentBase64: 'QUJD', mimeType: 'image/jpeg' },
        geminiService
      );

      const serialized = JSON.stringify(fields);
      assert.ok(!serialized.includes('0.973421'));
      assert.ok(serialized.includes('"high"'));
    });

    it("propage une erreur Gemini à l'appelant (service-worker.ts la transforme en DOCUMENT_OCR_ERROR, jamais affichée telle quelle côté Angular)", async () => {
      const geminiService = {
        async analyzeDocument() {
          throw new Error("Clé API Gemini invalide ou non autorisée (401).");
        },
      };

      await assert.rejects(() =>
        handleAnalyzeDocument(
          { type: 'ANALYZE_DOCUMENT', documentId: 'doc-1', documentBase64: 'QUJD', mimeType: 'image/png' },
          geminiService
        )
      );
    });
  });
});
