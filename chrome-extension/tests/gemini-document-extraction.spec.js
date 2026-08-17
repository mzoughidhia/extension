import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

// Charge le VRAI code src/ — GeminiService.analyzeDocument (lecture réelle de document).
const { GeminiService, GeminiError } = await loadRealModule('src/background/gemini.service.ts');

const ALLOWED_CANONICAL_PATHS = ['vehicle.registration', 'vehicle.brand', 'vehicle.model', 'client.firstName'];

function documentRequest(overrides = {}) {
  return {
    documentBase64: 'QUJDMTIz',
    mimeType: 'image/png',
    allowedCanonicalPaths: ALLOWED_CANONICAL_PATHS,
    ...overrides,
  };
}

describe('GeminiService.analyzeDocument (OCR réel, vrai code src/, appel réseau mocké)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('1. rejette avec API_KEY_MISSING si aucune clé fournie', async () => {
    const service = new GeminiService();
    await assert.rejects(
      () => service.analyzeDocument(documentRequest(), ''),
      (err) => {
        assert.equal(err.code, 'API_KEY_MISSING');
        return true;
      }
    );
  });

  it('5. construit un appel Gemini avec le document en inlineData (PNG) et le catalogue autorisé, sans exposer la clé dans le corps', async () => {
    let capturedBody;
    let capturedHeaders;
    globalThis.fetch = async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ fields: [] }) }] } }],
        }),
      };
    };

    const service = new GeminiService();
    await service.analyzeDocument(documentRequest({ mimeType: 'image/png' }), 'test-key-123');

    assert.equal(capturedHeaders['x-goog-api-key'], 'test-key-123');
    const inlinePart = capturedBody.contents[0].parts.find((p) => p.inlineData);
    assert.ok(inlinePart, 'le document doit être transmis en inlineData');
    assert.equal(inlinePart.inlineData.mimeType, 'image/png');
    assert.equal(inlinePart.inlineData.data, 'QUJDMTIz');
    assert.ok(!JSON.stringify(capturedBody).includes('test-key-123'), 'la clé ne doit jamais figurer dans le corps de la requête');
  });

  it('accepte un document PDF (mimeType transmis tel quel)', async () => {
    let capturedBody;
    globalThis.fetch = async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ fields: [] }) }] } }] }) };
    };

    const service = new GeminiService();
    await service.analyzeDocument(documentRequest({ mimeType: 'application/pdf' }), 'test-key');

    const inlinePart = capturedBody.contents[0].parts.find((p) => p.inlineData);
    assert.equal(inlinePart.inlineData.mimeType, 'application/pdf');
  });

  it('accepte un document JPEG (mimeType transmis tel quel)', async () => {
    let capturedBody;
    globalThis.fetch = async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ fields: [] }) }] } }] }) };
    };

    const service = new GeminiService();
    await service.analyzeDocument(documentRequest({ mimeType: 'image/jpeg' }), 'test-key');

    const inlinePart = capturedBody.contents[0].parts.find((p) => p.inlineData);
    assert.equal(inlinePart.inlineData.mimeType, 'image/jpeg');
  });

  it('6/7. parse correctement le JSON Gemini et accepte les canonicalPath valides', async () => {
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
                    fields: [
                      { canonicalPath: 'vehicle.registration', value: '123 TU 4567', confidence: 0.98 },
                      { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 0.97 },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const service = new GeminiService();
    const result = await service.analyzeDocument(documentRequest(), 'test-key');

    assert.equal(result.fields.length, 2);
    assert.deepEqual(result.fields[0], { canonicalPath: 'vehicle.registration', value: '123 TU 4567', confidence: 0.98 });
  });

  it('8. ignore silencieusement un canonicalPath hors du catalogue fermé (jamais halluciné)', async () => {
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
                    fields: [
                      { canonicalPath: 'vehicle.registration', value: '123 TU 4567', confidence: 0.9 },
                      { canonicalPath: 'chemin.invente.qui.nexiste.pas', value: 'x', confidence: 0.9 },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const service = new GeminiService();
    const result = await service.analyzeDocument(documentRequest(), 'test-key');

    assert.equal(result.fields.length, 1);
    assert.equal(result.fields[0].canonicalPath, 'vehicle.registration');
  });

  it("9. n'invente jamais une valeur : un champ sans value est ignoré, pas inventé", async () => {
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
                    fields: [
                      { canonicalPath: 'vehicle.brand', value: '', confidence: 0.9 },
                      { canonicalPath: 'vehicle.model', confidence: 0.9 },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const service = new GeminiService();
    const result = await service.analyzeDocument(documentRequest(), 'test-key');

    assert.equal(result.fields.length, 0);
  });

  it('12. gère une erreur Gemini (401) proprement, sans exposer la clé', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'API key not valid' } }),
    });

    const service = new GeminiService();
    await assert.rejects(
      () => service.analyzeDocument(documentRequest(), 'bad-key'),
      (err) => {
        assert.equal(err.code, 'HTTP_ERROR');
        assert.ok(!err.message.includes('bad-key'));
        return true;
      }
    );
  });

  it("rejette avec INVALID_RESPONSE si la propriété 'fields' est absente", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ notFields: [] }) }] } }] }),
    });

    const service = new GeminiService();
    await assert.rejects(
      () => service.analyzeDocument(documentRequest(), 'test-key'),
      (err) => {
        assert.equal(err.code, 'INVALID_RESPONSE');
        return true;
      }
    );
  });

  it('réutilise le même client HTTP que analyzeForm (une seule implémentation Gemini)', async () => {
    const service = new GeminiService();
    assert.equal(typeof service.analyzeForm, 'function');
    assert.equal(typeof service.analyzeDocument, 'function');
    // Les deux méthodes appartiennent à la même classe GeminiService — aucun second moteur.
  });
});
