import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

function installMockChromeStorage() {
  const table = { form_agent_quote_sessions: {}, form_memory: {} };
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
      lastError: undefined,
    },
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

installMockChromeStorage();

// Charge le VRAI code src/ utilisé par le pipeline multi-page :
// - form-fingerprint : empreinte de structure (Étape 1)
// - session-store : persistance QuoteSession
// - content-script : createNewSession / applySessionAnswers / updateSessionProgress
//   (fonctions réellement exportées et utilisées par handleDetectFields)
const { computeFormFingerprint } = await loadRealModule('src/content/form-fingerprint.ts');
const { SessionStore } = await loadRealModule('src/background/session-store.ts');
const { createNewSession, applySessionAnswers, updateSessionProgress } = await loadRealModule(
  'src/content/content-script.ts'
);
const { identifySessionContext, buildSessionKey } = await loadRealModule('src/shared/session-context.ts');

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
    sectionName: null,
    isInteractable: true,
    ...overrides,
  };
}

/**
 * Reproduit — avec le VRAI code exporté de content-script.ts — la portion
 * "session" du pipeline handleDetectFields : charge/crée la session, applique
 * les réponses déjà connues, met à jour la progression, persiste.
 */
async function analyzeStepForSession(state, detectedFields, stepInfo, mappings) {
  const fingerprint = computeFormFingerprint(detectedFields);

  let session = state.activeSessionId ? await SessionStore.get(state.activeSessionId) : null;
  if (!session) {
    session = createNewSession(state.sessionKey, state.context);
  }

  const resolvedMappings = applySessionAnswers(mappings, session.userAnswers);
  updateSessionProgress(session, stepInfo, fingerprint, resolvedMappings);

  state.activeSessionId = session.sessionId;
  await SessionStore.set(session);

  return { session, mappings: resolvedMappings };
}

function newTabState(url) {
  const context = identifySessionContext(url);
  return { activeSessionId: null, context, sessionKey: buildSessionKey(context) };
}

describe('Multi-page & reprise de session — pipeline réel (Étape 2, vrai code src/)', () => {
  beforeEach(() => {
    installMockChromeStorage();
  });

  it('1. Page 1 : une nouvelle session est créée avec currentStep = 1', async () => {
    const tab = newTabState('https://www.april-on.fr/home?oid=april-moto-particulier-moto&name=Moto');
    const detected = [field()];

    const { session } = await analyzeStepForSession(tab, detected, { currentStep: 1, totalSteps: 3, stepLabel: 'Véhicule' }, []);

    assert.equal(session.currentStep, 1);
    assert.equal(session.status, 'in_progress');
    assert.equal(session.steps.length, 1);
  });

  it("2. Page 2 (structure différente, même onglet) : la MÊME session est réutilisée, currentStep progresse", async () => {
    const tab = newTabState('https://www.april-on.fr/home?oid=april-moto-particulier-moto&name=Moto');
    const page1 = [field()];
    const page2 = [field({ elementId: 'field_2', name: 'birthdate', label: 'Date de naissance', type: 'date' })];

    const first = await analyzeStepForSession(tab, page1, { currentStep: 1, totalSteps: 3, stepLabel: 'Véhicule' }, []);
    const second = await analyzeStepForSession(tab, page2, { currentStep: 2, totalSteps: 3, stepLabel: 'Conducteur' }, []);

    assert.equal(second.session.sessionId, first.session.sessionId, 'même devis = même sessionId');
    assert.equal(second.session.currentStep, 2);
    assert.equal(second.session.steps.length, 2);
  });

  it("3. SPA sans changement d'URL : deux étapes avec la même URL mais des DOM différents produisent des empreintes différentes et deux entrées steps", async () => {
    const sameUrl = 'https://www.april-on.fr/home?oid=april-moto-particulier-moto&name=Moto';
    const tab = newTabState(sameUrl);
    const page1 = [field()];
    const page2 = [field({ elementId: 'x2', name: 'cv', label: 'Puissance fiscale', type: 'number' })];

    await analyzeStepForSession(tab, page1, { currentStep: 1, totalSteps: null, stepLabel: null }, []);
    const result = await analyzeStepForSession(tab, page2, { currentStep: 2, totalSteps: null, stepLabel: null }, []);

    assert.equal(result.session.steps.length, 2);
    assert.notEqual(result.session.steps[0].formFingerprint, result.session.steps[1].formFingerprint);
  });

  it("4. Ré-analyse de la même page (mutation DOM insignifiante) : aucun doublon dans steps (idempotent)", async () => {
    const tab = newTabState('https://www.april-on.fr/home?oid=april-moto-particulier-moto&name=Moto');
    const page = [field()];

    await analyzeStepForSession(tab, page, { currentStep: 1, totalSteps: null, stepLabel: null }, []);
    const result = await analyzeStepForSession(tab, page, { currentStep: 1, totalSteps: null, stepLabel: null }, []);

    assert.equal(result.session.steps.length, 1, "la même structure ne doit pas créer une nouvelle entrée d'étape");
  });

  it('5. Réponse utilisateur sauvegardée : une réponse donnée à l\'étape 1 est mémorisée dans la session', async () => {
    const tab = newTabState('https://www.april-on.fr/home?oid=april-moto-particulier-moto&name=Moto');
    const page1 = [field({ name: 'parking', label: 'Stationnement' })];

    const { session } = await analyzeStepForSession(tab, page1, { currentStep: 1, totalSteps: 2, stepLabel: null }, []);

    // Le courtier répond à la question posée par le Side Panel
    session.userAnswers['vehicle.parkingType'] = 'GARAGE_CLOS';
    session.completedFields['vehicle.parkingType'] = true;
    await SessionStore.set(session);

    const reloaded = await SessionStore.get(session.sessionId);
    assert.equal(reloaded.userAnswers['vehicle.parkingType'], 'GARAGE_CLOS');
  });

  it("6. Reprise avec réponse existante : à l'étape 2, le champ correspondant est pré-rempli sans reposer la question", async () => {
    const tab = newTabState('https://www.april-on.fr/home?oid=april-moto-particulier-moto&name=Moto');
    const page1 = [field({ name: 'parking', label: 'Stationnement' })];

    const { session } = await analyzeStepForSession(tab, page1, { currentStep: 1, totalSteps: 2, stepLabel: null }, []);
    session.userAnswers['vehicle.parkingType'] = 'GARAGE_CLOS';
    await SessionStore.set(session);

    const page2Mappings = [
      {
        field: field({ elementId: 'p2', name: 'parking2' }),
        canonicalPath: 'vehicle.parkingType',
        confidence: 0.9,
        reasons: ['test'],
        status: 'NEEDS_CONFIRMATION',
        resolvedValue: undefined,
      },
    ];

    const result = await analyzeStepForSession(
      tab,
      [field({ elementId: 'p2', name: 'parking2' })],
      { currentStep: 2, totalSteps: 2, stepLabel: null },
      page2Mappings
    );

    const resolved = result.mappings[0];
    assert.equal(resolved.resolvedValue, 'GARAGE_CLOS');
    assert.equal(resolved.status, 'CONFIRMED');
    assert.equal(resolved.source, 'user-answer');
  });

  it('7. Isolation entre deux produits (moto vs auto) sur le même site : sessions distinctes', async () => {
    const motoTab = newTabState('https://www.april-on.fr/home?oid=x&name=Moto');
    const autoTab = newTabState('https://www.april-on.fr/home?oid=x&name=Auto');

    const moto = await analyzeStepForSession(motoTab, [field()], { currentStep: 1, totalSteps: null, stepLabel: null }, []);
    const auto = await analyzeStepForSession(autoTab, [field()], { currentStep: 1, totalSteps: null, stepLabel: null }, []);

    assert.notEqual(moto.session.sessionId, auto.session.sessionId);
    assert.notEqual(moto.session.sessionKey, auto.session.sessionKey);
  });

  it('8. Isolation entre deux sites différents pour le même produit', async () => {
    const siteA = newTabState('https://www.april-on.fr/home?name=Moto');
    const siteB = newTabState('https://www.autre-assureur.fr/home?name=Moto');

    const a = await analyzeStepForSession(siteA, [field()], { currentStep: 1, totalSteps: null, stepLabel: null }, []);
    const b = await analyzeStepForSession(siteB, [field()], { currentStep: 1, totalSteps: null, stepLabel: null }, []);

    assert.notEqual(a.session.sessionKey, b.session.sessionKey);
    assert.equal(a.session.origin, 'www.april-on.fr');
    assert.equal(b.session.origin, 'www.autre-assureur.fr');
  });

  it('9. Une session ancienne (lastVisitedAt > 7 jours) reste accessible par ID (continuité active) mais disparaît des reprises proposées', async () => {
    const tab = newTabState('https://www.april-on.fr/home?name=Moto');
    const { session } = await analyzeStepForSession(tab, [field()], { currentStep: 1, totalSteps: null, stepLabel: null }, []);

    session.lastVisitedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await SessionStore.set(session);

    // Continuité dans l'onglet où la session est déjà active : toujours accessible par ID
    const stillActive = await SessionStore.get(session.sessionId);
    assert.ok(stillActive);

    // Mais elle n'est plus proposée en reprise (liste filtrée)
    const proposedForResume = await SessionStore.findBySessionKey(tab.sessionKey);
    assert.equal(proposedForResume.length, 0);
  });

  it('10. Session ambiguë : deux sessions actives pour la même clé sont toutes les deux remontées (jamais de reprise automatique implicite)', async () => {
    const tab1 = newTabState('https://www.april-on.fr/home?name=Moto');
    const tab2 = newTabState('https://www.april-on.fr/home?name=Moto');

    await analyzeStepForSession(tab1, [field()], { currentStep: 1, totalSteps: null, stepLabel: null }, []);
    await analyzeStepForSession(tab2, [field({ elementId: 'other' })], { currentStep: 1, totalSteps: null, stepLabel: null }, []);

    const candidates = await SessionStore.findBySessionKey(tab1.sessionKey);
    assert.equal(candidates.length, 2, 'les deux sessions doivent être proposées au choix, aucune reprise automatique');
  });

  it("11. completedFields ne contient jamais la valeur réelle du client, uniquement un marqueur", async () => {
    const tab = newTabState('https://www.april-on.fr/home?name=Moto');
    const mappings = [
      {
        field: field({ name: 'firstname' }),
        canonicalPath: 'client.firstName',
        confidence: 0.95,
        reasons: ['ok'],
        status: 'MATCHED',
        resolvedValue: 'Mohamed',
      },
    ];

    const { session } = await analyzeStepForSession(tab, [field()], { currentStep: 1, totalSteps: null, stepLabel: null }, mappings);

    assert.equal(session.completedFields['client.firstName'], true);
    const serialized = JSON.stringify(session.completedFields);
    assert.ok(!serialized.includes('Mohamed'));
  });
});
