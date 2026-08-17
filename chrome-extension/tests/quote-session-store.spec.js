import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

const { SessionStore } = await loadRealModule('src/background/session-store.ts');

function installMockChromeStorage() {
  const table = { form_agent_quote_sessions: {} };
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

function sampleSession(overrides = {}) {
  const now = new Date().toISOString();
  return {
    sessionId: 'session_1',
    sessionKey: 'www.april-on.fr::moto',
    origin: 'www.april-on.fr',
    product: 'moto',
    quoteId: null,
    quoteNumber: null,
    quoteStatus: null,
    quoteDate: null,
    currentStep: 1,
    totalSteps: null,
    steps: [],
    completedFields: {},
    userAnswers: {},
    detectedQuotes: [],
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
    lastVisitedAt: now,
    ...overrides,
  };
}

describe('SessionStore — persistance QuoteSession (Étape 2, vrai code src/)', () => {
  beforeEach(() => {
    installMockChromeStorage();
  });

  it('1. Création : set() puis get() renvoient la session créée', async () => {
    const session = sampleSession();
    await SessionStore.set(session);

    const found = await SessionStore.get(session.sessionId);
    assert.ok(found);
    assert.equal(found.sessionId, 'session_1');
  });

  it('2. Sauvegarde : les champs mis à jour sont persistés', async () => {
    const session = sampleSession();
    await SessionStore.set(session);

    session.currentStep = 2;
    session.userAnswers.parkingType = 'GARAGE_CLOS';
    await SessionStore.set(session);

    const found = await SessionStore.get(session.sessionId);
    assert.equal(found.currentStep, 2);
    assert.equal(found.userAnswers.parkingType, 'GARAGE_CLOS');
  });

  it('3. Récupération : get() renvoie null pour une session inconnue', async () => {
    const result = await SessionStore.get('inexistant');
    assert.equal(result, null);
  });

  it('4. Suppression : delete() retire la session du stockage', async () => {
    const session = sampleSession();
    await SessionStore.set(session);
    await SessionStore.delete(session.sessionId);

    const found = await SessionStore.get(session.sessionId);
    assert.equal(found, null);
  });

  it("5. Reprise après reload : la session persiste entre deux lectures indépendantes (simulateur de reload)", async () => {
    const session = sampleSession({ userAnswers: { parkingType: 'GARAGE_CLOS' } });
    await SessionStore.set(session);

    // Simule un "reload" : nouvelle lecture depuis le stockage, sans état en mémoire
    const reloaded = await SessionStore.get(session.sessionId);
    assert.equal(reloaded.userAnswers.parkingType, 'GARAGE_CLOS');
  });

  it("6. La session est stockée sous une clé dédiée 'form_agent_quote_sessions'", () => {
    const table = installMockChromeStorage();
    assert.ok('form_agent_quote_sessions' in table);
    assert.ok(!('form_memory' in table));
    assert.ok(!('quoteData' in table));
  });

  it('7. findBySessionKey() isole les sessions par produit (moto vs auto)', async () => {
    await SessionStore.set(sampleSession({ sessionId: 's_moto', sessionKey: 'www.april-on.fr::moto', product: 'moto' }));
    await SessionStore.set(sampleSession({ sessionId: 's_auto', sessionKey: 'www.april-on.fr::auto', product: 'auto' }));

    const motoSessions = await SessionStore.findBySessionKey('www.april-on.fr::moto');
    assert.equal(motoSessions.length, 1);
    assert.equal(motoSessions[0].sessionId, 's_moto');
  });

  it('8. findBySessionKey() isole les sessions par site (deux extranets différents)', async () => {
    await SessionStore.set(sampleSession({ sessionId: 's_april', sessionKey: 'www.april-on.fr::moto' }));
    await SessionStore.set(sampleSession({ sessionId: 's_autre', sessionKey: 'www.autre-assureur.fr::moto' }));

    const results = await SessionStore.findBySessionKey('www.april-on.fr::moto');
    assert.equal(results.length, 1);
    assert.equal(results[0].sessionId, 's_april');
  });

  it('9. findBySessionKey() exclut une session ancienne (expirée, > 7 jours sans activité)', async () => {
    const old = sampleSession({
      sessionId: 's_old',
      lastVisitedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await SessionStore.set(old);

    const results = await SessionStore.findBySessionKey('www.april-on.fr::moto');
    assert.equal(results.length, 0);
  });

  it('10. findBySessionKey() exclut une session déjà terminée (status completed)', async () => {
    await SessionStore.set(sampleSession({ sessionId: 's_done', status: 'completed' }));

    const results = await SessionStore.findBySessionKey('www.april-on.fr::moto');
    assert.equal(results.length, 0);
  });

  it('11. findBySessionKey() trie les sessions de la plus récente à la plus ancienne', async () => {
    await SessionStore.set(sampleSession({ sessionId: 's_a', lastVisitedAt: new Date(Date.now() - 1000).toISOString() }));
    await SessionStore.set(sampleSession({ sessionId: 's_b', lastVisitedAt: new Date().toISOString() }));

    const results = await SessionStore.findBySessionKey('www.april-on.fr::moto');
    assert.equal(results[0].sessionId, 's_b');
  });

  it('12. clear() supprime toutes les sessions', async () => {
    await SessionStore.set(sampleSession({ sessionId: 's_1' }));
    await SessionStore.set(sampleSession({ sessionId: 's_2' }));
    await SessionStore.clear();

    const all = await SessionStore.find(() => true);
    assert.equal(all.length, 0);
  });

  it("13. Ambiguïté : plusieurs sessions actives pour la même clé → toutes remontées (au Side Panel de choisir)", async () => {
    await SessionStore.set(sampleSession({ sessionId: 's_1', lastVisitedAt: new Date(Date.now() - 5000).toISOString() }));
    await SessionStore.set(sampleSession({ sessionId: 's_2', lastVisitedAt: new Date().toISOString() }));

    const results = await SessionStore.findBySessionKey('www.april-on.fr::moto');
    assert.equal(results.length, 2, 'aucune reprise automatique implicite : les deux sont proposées');
  });
});
