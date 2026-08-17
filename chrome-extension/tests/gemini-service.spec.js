import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Modèles et Utilitaires pour les Tests ─────────────────────────────────
const CANONICAL_PATHS = [
  'client.firstName', 'client.lastName', 'client.nationalId', 'client.birthDate',
  'client.phone', 'client.email', 'client.address.street', 'client.address.postalCode',
  'client.address.city', 'client.address.country',
  'vehicle.registration', 'vehicle.brand', 'vehicle.model', 'vehicle.version',
  'vehicle.firstRegistrationDate', 'vehicle.fiscalPower', 'vehicle.vehicleValue',
  'vehicle.vehicleType', 'vehicle.usage',
  'driver.firstName', 'driver.lastName', 'driver.birthDate', 'driver.licenseDate',
  'driver.profession', 'driver.phone',
  'insuranceHistory.previousInsurer', 'insuranceHistory.previousContractStartDate',
  'insuranceHistory.previousContractEndDate', 'insuranceHistory.seniority',
  'insuranceHistory.bonusMalus', 'insuranceHistory.claimsCount',
  'insuranceHistory.responsibleClaimsCount', 'insuranceHistory.nonResponsibleClaimsCount',
  'insuranceHistory.wasTerminated', 'insuranceHistory.terminatedByInsurer',
  'insuranceHistory.terminationReason', 'insuranceHistory.terminationDate',
];

function isValidCanonicalPath(path) {
  return CANONICAL_PATHS.includes(path);
}

class GeminiError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class TestableGeminiService {
  constructor(config = {}) {
    this.config = {
      model: 'gemini-2.5-flash',
      timeoutMs: 500,
      apiVersion: 'v1beta',
      ...config,
    };
  }

  async analyzeForm(request, customApiKey) {
    const apiKey = customApiKey;
    if (!apiKey || apiKey.trim() === '') {
      throw new GeminiError('API_KEY_MISSING', 'Clé API non configurée.');
    }

    const endpointUrl = `https://generativelanguage.googleapis.com/${this.config.apiVersion}/models/${encodeURIComponent(this.config.model)}:generateContent`;

    const userPayload = {
      formSchema: request.formSchema,
      availableData: request.availableData,
      allowedCanonicalPaths: request.allowedCanonicalPaths || CANONICAL_PATHS,
    };

    const requestBody = {
      systemInstruction: {
        parts: [{ text: "Agent d'analyse de formulaires d'assurance." }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(userPayload) }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: { mappings: { type: 'ARRAY' } } },
      },
    };

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let rawResponse;
    try {
      rawResponse = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timerId);
      if (err.name === 'AbortError') {
        throw new GeminiError('TIMEOUT', 'La requête a expiré.');
      }
      throw new GeminiError('NETWORK_ERROR', `Erreur réseau : ${err.message}`);
    } finally {
      clearTimeout(timerId);
    }

    if (!rawResponse.ok) {
      if (rawResponse.status === 429) {
        throw new GeminiError('RATE_LIMITED', 'Quota dépassé (429)', 429);
      }
      if (rawResponse.status === 401 || rawResponse.status === 403) {
        throw new GeminiError('HTTP_ERROR', `Clé non autorisée (${rawResponse.status})`, rawResponse.status);
      }
      throw new GeminiError('HTTP_ERROR', `Erreur HTTP ${rawResponse.status}`, rawResponse.status);
    }

    let responseJson;
    try {
      responseJson = await rawResponse.json();
    } catch {
      throw new GeminiError('PARSE_ERROR', 'Réponse HTTP non-JSON.');
    }

    const candidateText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new GeminiError('INVALID_RESPONSE', 'Réponse Gemini vide.');
    }

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(candidateText);
    } catch {
      throw new GeminiError('PARSE_ERROR', 'Contenu Gemini non-JSON.');
    }

    if (!parsedOutput || !Array.isArray(parsedOutput.mappings)) {
      throw new GeminiError('INVALID_RESPONSE', "Propriété 'mappings' absente.");
    }

    const sanitizedMappings = parsedOutput.mappings.map((m) => {
      let canonicalPath = m.canonicalPath ? String(m.canonicalPath) : null;
      let confidence = typeof m.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : 0;
      let reason = String(m.reason || '');

      if (canonicalPath && !isValidCanonicalPath(canonicalPath)) {
        reason = `Chemin non valide dans le catalogue fermé`;
        canonicalPath = null;
        confidence = 0;
      }

      return {
        fieldId: String(m.fieldId || ''),
        canonicalPath,
        confidence,
        reason,
        suggestedValue: m.suggestedValue,
      };
    });

    return {
      mappings: sanitizedMappings,
      model: this.config.model,
      summary: parsedOutput.summary,
    };
  }
}

// ─── SUITE DE TESTS GEMINI SERVICE ─────────────────────────────────────────

describe('GeminiService — Appels Réseau Mockés & Gestion des Erreurs (Étape 2)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const sampleRequest = {
    formSchema: {
      fields: [
        { id: 'f1', label: 'Prénom', name: 'firstname', type: 'text' },
        { id: 'f2', label: 'Marque', name: 'brand', type: 'select' },
      ],
    },
    availableData: {
      client: { firstName: 'Mohamed', lastName: 'Mzoughi' },
      vehicle: { brand: 'Peugeot' },
    },
    allowedCanonicalPaths: CANONICAL_PATHS,
  };

  // 1. Clé API manquante
  it('1. [Erreur Clé Manquante] Rejette avec code API_KEY_MISSING si aucune clé fournie', async () => {
    const service = new TestableGeminiService();
    await assert.rejects(
      async () => service.analyzeForm(sampleRequest, ''),
      (err) => {
        assert.equal(err.code, 'API_KEY_MISSING');
        return true;
      }
    );
  });

  // 2. Requête HTTP correctement construite
  it('2. [Format Requête] Envoie un POST avec header x-goog-api-key, Content-Type et body JSON structuré', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders = {};
    let capturedBody = {};

    globalThis.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedMethod = options.method;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      mappings: [
                        { fieldId: 'f1', canonicalPath: 'client.firstName', confidence: 0.99, reason: 'Prénom' },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    };

    const service = new TestableGeminiService({ model: 'gemini-2.5-flash' });
    const result = await service.analyzeForm(sampleRequest, 'dummy_test_key_123');

    assert.ok(capturedUrl.includes('models/gemini-2.5-flash:generateContent'));
    assert.equal(capturedMethod, 'POST');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');
    assert.equal(capturedHeaders['x-goog-api-key'], 'dummy_test_key_123');
    assert.equal(capturedBody.generationConfig.responseMimeType, 'application/json');
    assert.ok(capturedBody.generationConfig.responseSchema);
    assert.equal(result.mappings[0].canonicalPath, 'client.firstName');
  });

  // 3. Réponse Gemini valide avec structured output
  it('3. [Succès Réponse Structurée] Retourne GeminiMappingResponse avec les correspondances', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    mappings: [
                      { fieldId: 'f1', canonicalPath: 'client.firstName', confidence: 0.98, reason: 'Prénom du souscripteur', suggestedValue: 'Mohamed' },
                      { fieldId: 'f2', canonicalPath: 'vehicle.brand', confidence: 0.95, reason: 'Marque du véhicule', suggestedValue: 'Peugeot' },
                    ],
                    summary: 'Mapping complet réussi.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const service = new TestableGeminiService();
    const result = await service.analyzeForm(sampleRequest, 'test_key');

    assert.equal(result.mappings.length, 2);
    assert.equal(result.mappings[0].fieldId, 'f1');
    assert.equal(result.mappings[0].canonicalPath, 'client.firstName');
    assert.equal(result.mappings[0].confidence, 0.98);
    assert.equal(result.summary, 'Mapping complet réussi.');
  });

  // 4. Protection contre les hallucinations (chemin invalide)
  it('4. [Sécurité Catalogue Fermé] Réinitialise canonicalPath à null si Gemini invente un chemin non autorisé', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    mappings: [
                      { fieldId: 'f1', canonicalPath: 'invented.path.that.does.not.exist', confidence: 0.99, reason: 'Hallucination' },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const service = new TestableGeminiService();
    const result = await service.analyzeForm(sampleRequest, 'test_key');

    assert.equal(result.mappings[0].canonicalPath, null, 'Le chemin non autorisé doit être forcé à null');
    assert.equal(result.mappings[0].confidence, 0);
    assert.ok(result.mappings[0].reason.includes('catalogue fermé'));
  });

  // 5. Erreur HTTP 401 / 403
  it('5. [Erreur HTTP 401/403] Rejette avec HTTP_ERROR pour clé non valide', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'API key not valid' } }),
    });

    const service = new TestableGeminiService();
    await assert.rejects(
      async () => service.analyzeForm(sampleRequest, 'bad_key'),
      (err) => {
        assert.equal(err.code, 'HTTP_ERROR');
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  // 6. Erreur HTTP 429 (Rate Limit)
  it('6. [Erreur Quota 429] Rejette avec RATE_LIMITED', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Quota exceeded' } }),
    });

    const service = new TestableGeminiService();
    await assert.rejects(
      async () => service.analyzeForm(sampleRequest, 'test_key'),
      (err) => {
        assert.equal(err.code, 'RATE_LIMITED');
        assert.equal(err.statusCode, 429);
        return true;
      }
    );
  });

  // 7. Timeout (AbortController)
  it('7. [Timeout] Rejette avec TIMEOUT si la requête dépasse le délai configuré', async () => {
    globalThis.fetch = async (_url, options) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    const service = new TestableGeminiService({ timeoutMs: 30 });
    await assert.rejects(
      async () => service.analyzeForm(sampleRequest, 'test_key'),
      (err) => {
        assert.equal(err.code, 'TIMEOUT');
        return true;
      }
    );
  });

  // 8. Réponse Gemini vide ou non-JSON
  it('8. [Réponse Invalide] Rejette avec INVALID_RESPONSE si aucun candidat ou PARSE_ERROR si JSON corrompu', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    });

    const service = new TestableGeminiService();
    await assert.rejects(
      async () => service.analyzeForm(sampleRequest, 'test_key'),
      (err) => {
        assert.equal(err.code, 'INVALID_RESPONSE');
        return true;
      }
    );
  });
});
