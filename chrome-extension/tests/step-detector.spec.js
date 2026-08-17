import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

// Charge le VRAI code src/ (fonctions pures du StepDetector).
const { isNextButtonLabel, parseStepFromText } = await loadRealModule('src/content/step-detector.ts');

describe('step-detector — reconnaissance des étapes multi-page (Étape 2, vrai code src/)', () => {
  it('1. Reconnaît "Suivant" comme bouton d\'étape suivante', () => {
    assert.equal(isNextButtonLabel('Suivant'), true);
  });

  it('2. Reconnaît "Continuer"', () => {
    assert.equal(isNextButtonLabel('Continuer'), true);
  });

  it('3. Reconnaît "Étape suivante" (avec accents)', () => {
    assert.equal(isNextButtonLabel('Étape suivante'), true);
  });

  it('4. Reconnaît "Valider et continuer"', () => {
    assert.equal(isNextButtonLabel('Valider et continuer'), true);
  });

  it('5. Reconnaît "Poursuivre"', () => {
    assert.equal(isNextButtonLabel('Poursuivre'), true);
  });

  it('6. Reconnaît les équivalents anglais "Next" / "Continue"', () => {
    assert.equal(isNextButtonLabel('Next'), true);
    assert.equal(isNextButtonLabel('Continue'), true);
  });

  it('7. Rejette un bouton sans rapport ("Annuler", "Retour")', () => {
    assert.equal(isNextButtonLabel('Annuler'), false);
    assert.equal(isNextButtonLabel('Retour'), false);
  });

  it('8. Rejette un texte vide ou nul', () => {
    assert.equal(isNextButtonLabel(''), false);
    assert.equal(isNextButtonLabel(null), false);
  });

  it('9. Ne clique/valide jamais un bouton de soumission finale ("Signer", "Souscrire")', () => {
    assert.equal(isNextButtonLabel('Signer le contrat'), false);
    assert.equal(isNextButtonLabel('Souscrire'), false);
  });

  it('10. parseStepFromText extrait "Étape 2 sur 4"', () => {
    const result = parseStepFromText('Étape 2 sur 4');
    assert.deepEqual(result, { currentStep: 2, totalSteps: 4 });
  });

  it('11. parseStepFromText extrait "Step 3 of 5" (anglais)', () => {
    const result = parseStepFromText('Step 3 of 5');
    assert.deepEqual(result, { currentStep: 3, totalSteps: 5 });
  });

  it('12. parseStepFromText extrait "Étape 1/3" (slash)', () => {
    const result = parseStepFromText('Étape 1/3');
    assert.deepEqual(result, { currentStep: 1, totalSteps: 3 });
  });

  it('13. parseStepFromText renvoie null si aucun format d\'étape reconnu', () => {
    assert.equal(parseStepFromText('Vos informations personnelles'), null);
  });

  it("14. Ne suppose jamais un nombre d'étapes fixe : un texte incomplet renvoie null plutôt qu'une valeur inventée", () => {
    assert.equal(parseStepFromText('Étape 2'), null);
  });
});
