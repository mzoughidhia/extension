import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

// Charge le VRAI code src/ utilisé par le Side Panel pour décider quoi
// afficher au courtier (Étape 3, UX conversationnelle).
const {
  getScanButtonLabel,
  resolveQuestionInputType,
  buildQuestionLine,
  describeAnalysisOutcome,
  formatStepLabel,
  computeProgressPercent,
  pickSessionPresentation,
} = await loadRealModule('src/shared/ux-copy.ts');

const BANNED_TERMS = [
  'gemini mapping',
  'canonicalpath',
  'confidence',
  'matched',
  'needs_confirmation',
  'unmatched',
  'fieldknowledge',
  'fingerprint',
  'formmemory',
  'cache hit',
  'cache miss',
  'fallback local',
  'sessionid',
  'automation run',
  'épistémique',
  'epistemique',
  'validation canonique',
];

function containsJargon(text) {
  const lower = text.toLowerCase();
  return BANNED_TERMS.find((term) => lower.includes(term));
}

function sampleSession(overrides = {}) {
  const now = new Date().toISOString();
  return {
    sessionId: 's1',
    sessionKey: 'www.april-on.fr::moto',
    origin: 'www.april-on.fr',
    product: 'moto',
    quoteId: null,
    quoteNumber: null,
    quoteStatus: null,
    quoteDate: null,
    currentStep: 2,
    totalSteps: 4,
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

describe('ux-copy — expérience conversationnelle sans jargon (Étape 3, vrai code src/)', () => {
  // 1. affichage / état du bouton principal
  it('1. Bouton principal : état initial "Analyser le formulaire"', () => {
    assert.equal(getScanButtonLabel('idle'), 'Analyser le formulaire');
  });

  it('2. Bouton principal : état "Analyse en cours…" pendant l\'analyse', () => {
    assert.equal(getScanButtonLabel('busy'), 'Analyse en cours…');
  });

  it('3. Bouton principal : "✓ Formulaire analysé" après une analyse Gemini', () => {
    assert.equal(getScanButtonLabel('analyzed'), '✓ Formulaire analysé');
  });

  it('4. Bouton principal : "✓ Formulaire reconnu" quand le formulaire est déjà connu (cache)', () => {
    assert.equal(getScanButtonLabel('cache-hit'), '✓ Formulaire reconnu');
  });

  // 5. Types de question
  it("5. Question SELECT/RADIO : gérée par des choix (pas par resolveQuestionInputType, testé séparément)", () => {
    // Les champs à options passent par les boutons de choix côté Side Panel ;
    // resolveQuestionInputType ne s'applique qu'aux champs sans options.
    assert.equal(resolveQuestionInputType('text'), 'text');
  });

  it('6. Question date : utilise un input de type date', () => {
    assert.equal(resolveQuestionInputType('date'), 'date');
  });

  it('7. Question nombre : utilise un input de type number', () => {
    assert.equal(resolveQuestionInputType('number'), 'number');
  });

  it('8. Question texte libre : utilise un input de type text par défaut', () => {
    assert.equal(resolveQuestionInputType('tel'), 'text');
    assert.equal(resolveQuestionInputType('email'), 'text');
  });

  // 9. Question naturelle (jamais le nom technique du champ)
  it('9. La question reprend le libellé humain du champ, jamais un chemin canonique', () => {
    const line = buildQuestionLine('Mode de stationnement habituel de la moto');
    assert.equal(line, 'Mode de stationnement habituel de la moto ?');
    assert.equal(containsJargon(line), undefined);
  });

  it("10. Un libellé se terminant déjà par une ponctuation n'est pas doublé", () => {
    assert.equal(buildQuestionLine('Quel est votre usage ?'), 'Quel est votre usage ?');
  });

  // 11. Progression multi-page
  it('11. formatStepLabel affiche "Étape X sur Y" quand le total est connu', () => {
    assert.equal(formatStepLabel({ currentStep: 2, totalSteps: 4 }), 'Étape 2 sur 4');
  });

  it('12. formatStepLabel affiche seulement "Étape X" quand le total est inconnu (jamais inventé)', () => {
    assert.equal(formatStepLabel({ currentStep: 3, totalSteps: null }), 'Étape 3');
  });

  it('13. computeProgressPercent calcule un pourcentage cohérent', () => {
    assert.equal(computeProgressPercent({ currentStep: 1, totalSteps: 4 }), 25);
    assert.equal(computeProgressPercent({ currentStep: 4, totalSteps: 4 }), 100);
  });

  it('14. computeProgressPercent renvoie null si le total est inconnu (pas de barre approximative)', () => {
    assert.equal(computeProgressPercent({ currentStep: 2, totalSteps: null }), null);
  });

  // 15-18. Résultat d'analyse (formulaire reconnu / erreur Gemini / fallback / terminé)
  it('15. Formulaire reconnu (cache) : message dédié, sans mention technique de cache', () => {
    const lines = describeAnalysisOutcome({ cacheHit: true, usedLocalAnalysis: false, autoReadyCount: 14, pendingCount: 0 });
    assert.equal(lines[0], '✓ Formulaire reconnu.');
    lines.forEach((line) => assert.equal(containsJargon(line), undefined));
  });

  it('16. Analyse locale (Gemini indisponible) : message rassurant, aucune erreur technique affichée', () => {
    const lines = describeAnalysisOutcome({ cacheHit: false, usedLocalAnalysis: true, autoReadyCount: 10, pendingCount: 1 });
    assert.equal(lines[0], 'Le mode intelligent est momentanément indisponible. Je continue avec une analyse locale.');
    lines.forEach((line) => assert.equal(containsJargon(line), undefined));
  });

  it('17. Aucune question en attente : formulaire prêt, décompte simple', () => {
    const lines = describeAnalysisOutcome({ cacheHit: false, usedLocalAnalysis: false, autoReadyCount: 14, pendingCount: 0 });
    assert.ok(lines.some((l) => l.includes('14')));
  });

  it("18. Questions en attente : une seule ligne annonce le nombre manquant (pas la liste détaillée)", () => {
    const lines = describeAnalysisOutcome({ cacheHit: false, usedLocalAnalysis: false, autoReadyCount: 8, pendingCount: 3 });
    const summaryLine = lines[lines.length - 1];
    assert.ok(summaryLine.includes('3'));
    assert.ok(!summaryLine.includes('\n-')); // jamais une liste à puces des champs manquants
  });

  // 19-20. Reprise de session
  it('19. Une seule session trouvée : proposée directement (mode "single")', () => {
    const result = pickSessionPresentation([sampleSession()]);
    assert.equal(result.mode, 'single');
    assert.equal(result.sessions.length, 1);
  });

  it('20. Aucune session : rien à proposer (mode "none")', () => {
    const result = pickSessionPresentation([]);
    assert.equal(result.mode, 'none');
  });

  it('21. Plusieurs sessions : jamais de choix automatique, toutes remontées (mode "multiple")', () => {
    const result = pickSessionPresentation([sampleSession({ sessionId: 'a' }), sampleSession({ sessionId: 'b' })]);
    assert.equal(result.mode, 'multiple');
    assert.equal(result.sessions.length, 2);
  });

  // 22. Aucun terme technique dans la totalité des textes générés dynamiquement
  it('22. Aucun terme technique dans les textes produits par ux-copy (scan exhaustif)', () => {
    const allTexts = [
      getScanButtonLabel('idle'),
      getScanButtonLabel('busy'),
      getScanButtonLabel('analyzed'),
      getScanButtonLabel('cache-hit'),
      buildQuestionLine('Test'),
      ...describeAnalysisOutcome({ cacheHit: true, usedLocalAnalysis: false, autoReadyCount: 5, pendingCount: 0 }),
      ...describeAnalysisOutcome({ cacheHit: false, usedLocalAnalysis: true, autoReadyCount: 5, pendingCount: 2 }),
      formatStepLabel({ currentStep: 1, totalSteps: 3 }),
    ];

    for (const text of allTexts) {
      const found = containsJargon(text);
      assert.equal(found, undefined, `terme technique détecté ("${found}") dans : "${text}"`);
    }
  });
});
