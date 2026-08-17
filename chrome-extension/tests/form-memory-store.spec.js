import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

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
  return table;
}

function sampleMemory(overrides = {}) {
  const now = new Date().toISOString();
  return {
    memoryKey: 'www.april-on.fr::abc123',
    origin: 'www.april-on.fr',
    product: null,
    formFingerprint: 'abc123',
    fieldStructure: [{ fieldKey: '0_deadbeef', name: 'firstname', label: 'Prénom', type: 'text', section: null, order: 0 }],
    validatedMappings: [{ fieldKey: '0_deadbeef', canonicalPath: 'client.firstName', confidence: 0.95, reason: 'OK' }],
    createdAt: now,
    lastUsedAt: now,
    version: 1,
    ...overrides,
  };
}

describe('FormMemoryStore — persistance chrome.storage.local (Étape 1, vrai code src/)', () => {
  beforeEach(() => {
    installMockChromeStorage();
  });

  it('1. get() renvoie null quand la mémoire est absente (premier scan → cache MISS)', async () => {
    const result = await FormMemoryStore.get('inexistant::xyz');
    assert.equal(result, null);
  });

  it('2. set() puis get() renvoient la mémoire enregistrée (cache HIT au second scan)', async () => {
    const memory = sampleMemory();
    await FormMemoryStore.set(memory);

    const result = await FormMemoryStore.get(memory.memoryKey);
    assert.ok(result);
    assert.equal(result.memoryKey, memory.memoryKey);
    assert.equal(result.validatedMappings[0].canonicalPath, 'client.firstName');
  });

  it("3. La mémoire est stockée sous une clé dédiée 'form_memory', jamais mélangée avec quoteData/gemini_api_key", () => {
    const table = installMockChromeStorage();
    assert.ok('form_memory' in table);
    assert.ok(!('quoteData' in table));
    assert.ok(!('gemini_api_key' in table));
  });

  it('4. get() invalide une mémoire dont la version de schéma diffère (mémoire corrompue/obsolète)', async () => {
    const memory = sampleMemory({ version: 999 });
    await FormMemoryStore.set(memory);

    const result = await FormMemoryStore.get(memory.memoryKey);
    assert.equal(result, null);
  });

  it('5. get() invalide une mémoire expirée (au-delà du TTL)', async () => {
    const expired = sampleMemory({ lastUsedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() }); // 60 jours
    await FormMemoryStore.set(expired);

    const result = await FormMemoryStore.get(expired.memoryKey);
    assert.equal(result, null);
  });

  it('6. get() accepte une mémoire récente (dans le TTL)', async () => {
    const fresh = sampleMemory({ lastUsedAt: new Date().toISOString() });
    await FormMemoryStore.set(fresh);

    const result = await FormMemoryStore.get(fresh.memoryKey);
    assert.ok(result);
  });

  it('7. get() invalide une mémoire corrompue (validatedMappings absent)', async () => {
    const corrupted = sampleMemory();
    delete corrupted.validatedMappings;
    await FormMemoryStore.set(corrupted);

    const result = await FormMemoryStore.get(corrupted.memoryKey);
    assert.equal(result, null);
  });

  it('8. delete() supprime une mémoire spécifique', async () => {
    const memory = sampleMemory();
    await FormMemoryStore.set(memory);
    await FormMemoryStore.delete(memory.memoryKey);

    const result = await FormMemoryStore.get(memory.memoryKey);
    assert.equal(result, null);
  });

  it('9. clear() supprime toutes les mémoires', async () => {
    await FormMemoryStore.set(sampleMemory({ memoryKey: 'k1' }));
    await FormMemoryStore.set(sampleMemory({ memoryKey: 'k2' }));

    await FormMemoryStore.clear();

    const all = await FormMemoryStore.find(() => true);
    assert.equal(all.length, 0);
  });

  it('10. find() retrouve toutes les mémoires correspondant à un prédicat (ex: même origine)', async () => {
    await FormMemoryStore.set(sampleMemory({ memoryKey: 'k1', origin: 'www.april-on.fr' }));
    await FormMemoryStore.set(sampleMemory({ memoryKey: 'k2', origin: 'www.autre-assureur.fr' }));

    const results = await FormMemoryStore.find((m) => m.origin === 'www.april-on.fr');
    assert.equal(results.length, 1);
    assert.equal(results[0].memoryKey, 'k1');
  });

  it('11. La mémoire ne contient aucune donnée personnelle du client, uniquement de la structure', async () => {
    const memory = sampleMemory();
    await FormMemoryStore.set(memory);
    const stored = await FormMemoryStore.get(memory.memoryKey);

    const serialized = JSON.stringify(stored);
    assert.ok(!serialized.includes('Mohamed'));
    assert.ok(!('clientName' in stored));
    assert.ok(!Object.prototype.hasOwnProperty.call(stored.validatedMappings[0], 'value'));
  });
});
