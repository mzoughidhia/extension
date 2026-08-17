import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

// Charge le VRAI code src/ (fingerprint + store), pas une réimplémentation.
const { computeFormFingerprint, buildFormMemoryKey } = await loadRealModule('src/content/form-fingerprint.ts');
const { FormMemoryStore } = await loadRealModule('src/background/form-memory-store.ts');

function installMockChromeStorage() {
  const table = { form_memory: {} };
  globalThis.chrome = {
    storage: {
      local: {
        get(keys, cb) {
          const result = {};
          for (const key of keys) result[key] = table[key];
          cb(result);
        },
        set(obj, cb) {
          Object.assign(table, obj);
          if (cb) cb();
        },
      },
    },
  };
}

function field(overrides = {}) {
  return {
    elementId: 'field_1',
    selector: '#f1',
    tagName: 'input',
    type: 'text',
    name: 'firstname',
    id: 'f_fn',
    label: 'Prénom',
    placeholder: null,
    ariaLabel: null,
    surroundingText: null,
    sectionName: 'Conducteur',
    isInteractable: true,
    ...overrides,
  };
}

/**
 * Reproduit la décision de cache réellement prise dans content-script.ts
 * (`handleDetectFields`) : calcule l'empreinte, consulte FormMemoryStore,
 * et n'appelle Gemini (ici simulé par un compteur) qu'en cas de MISS.
 */
async function analyzeWithCache(detected, origin, geminiCallCounter) {
  const fingerprint = computeFormFingerprint(detected);
  const memoryKey = buildFormMemoryKey(origin, fingerprint);

  const cached = await FormMemoryStore.get(memoryKey);
  if (cached) {
    return { cacheHit: true, mappings: cached.validatedMappings };
  }

  // Cache MISS → appel Gemini (simulé)
  geminiCallCounter.count += 1;
  const validatedMappings = detected.map((f, index) => ({
    fieldKey: `${index}_simulated`,
    canonicalPath: f.name === 'firstname' ? 'client.firstName' : null,
    confidence: 0.9,
    reason: 'Simulé pour le test',
  }));

  const now = new Date().toISOString();
  await FormMemoryStore.set({
    memoryKey,
    origin,
    product: null,
    formFingerprint: fingerprint,
    fieldStructure: [],
    validatedMappings,
    createdAt: now,
    lastUsedAt: now,
    version: 1,
  });

  return { cacheHit: false, mappings: validatedMappings };
}

describe('Cache Gemini via FormMemory — pipeline réel fingerprint + store (Étape 1, vrai code src/)', () => {
  beforeEach(() => {
    installMockChromeStorage();
  });

  it('1. Premier scan d\'un formulaire → cache MISS → Gemini appelé une fois', async () => {
    const counter = { count: 0 };
    const detected = [field()];

    const result = await analyzeWithCache(detected, 'www.april-on.fr', counter);

    assert.equal(result.cacheHit, false);
    assert.equal(counter.count, 1);
  });

  it('2. Deuxième scan du même formulaire (identique) → cache HIT → Gemini NON appelé', async () => {
    const counter = { count: 0 };
    const detected = [field()];

    await analyzeWithCache(detected, 'www.april-on.fr', counter);
    const second = await analyzeWithCache(detected, 'www.april-on.fr', counter);

    assert.equal(second.cacheHit, true);
    assert.equal(counter.count, 1, 'Gemini ne doit pas être rappelé au deuxième scan');
  });

  it("3. Formulaire structurellement différent → fingerprint différent → Gemini rappelé", async () => {
    const counter = { count: 0 };
    const detectedA = [field()];
    const detectedB = [field({ label: 'Nom', name: 'lastname' })];

    await analyzeWithCache(detectedA, 'www.april-on.fr', counter);
    const result = await analyzeWithCache(detectedB, 'www.april-on.fr', counter);

    assert.equal(result.cacheHit, false);
    assert.equal(counter.count, 2);
  });

  it('4. Mémoire expirée → traitée comme cache MISS → Gemini rappelé', async () => {
    const counter = { count: 0 };
    const detected = [field()];
    const origin = 'www.april-on.fr';

    await analyzeWithCache(detected, origin, counter);

    // Simule l'expiration en réécrivant lastUsedAt dans le passé lointain
    const fingerprint = computeFormFingerprint(detected);
    const memoryKey = buildFormMemoryKey(origin, fingerprint);
    const memory = await FormMemoryStore.get(memoryKey);
    memory.lastUsedAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await FormMemoryStore.set(memory);

    const result = await analyzeWithCache(detected, origin, counter);
    assert.equal(result.cacheHit, false);
    assert.equal(counter.count, 2, 'Gemini doit être rappelé car la mémoire est expirée');
  });

  it('5. Le mapping mémorisé est réutilisable pour plusieurs clients différents (cache par formulaire, pas par client)', async () => {
    const counter = { count: 0 };
    const detected = [field()];
    const origin = 'www.april-on.fr';

    // Client A déclenche l'analyse Gemini
    const clientA = await analyzeWithCache(detected, origin, counter);
    assert.equal(clientA.cacheHit, false);

    // Client B et Client C réutilisent le cache formé pour Client A
    const clientB = await analyzeWithCache(detected, origin, counter);
    const clientC = await analyzeWithCache(detected, origin, counter);

    assert.equal(clientB.cacheHit, true);
    assert.equal(clientC.cacheHit, true);
    assert.equal(counter.count, 1, 'Un seul appel Gemini pour 3 clients sur le même formulaire');
  });

  it('6. Le mapping validé sauvegardé correspond bien au chemin canonique attendu', async () => {
    const counter = { count: 0 };
    const detected = [field()];

    await analyzeWithCache(detected, 'www.april-on.fr', counter);
    const second = await analyzeWithCache(detected, 'www.april-on.fr', counter);

    assert.equal(second.mappings[0].canonicalPath, 'client.firstName');
  });

  it('7. Deux origines différentes (sites différents) ne partagent pas leur cache', async () => {
    const counter = { count: 0 };
    const detected = [field()];

    await analyzeWithCache(detected, 'www.april-on.fr', counter);
    const otherSite = await analyzeWithCache(detected, 'www.autre-assureur.fr', counter);

    assert.equal(otherSite.cacheHit, false);
    assert.equal(counter.count, 2);
  });
});
