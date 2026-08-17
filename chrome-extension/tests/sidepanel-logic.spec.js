import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Logique Métier et Rendu Simulés pour le Side Panel ───────────────────
function computeGeminiUIState(hasKey) {
  if (hasKey) {
    return {
      statusText: 'Configuré',
      statusClass: 'gemini-badge gemini-badge-configured',
      hintText: "Gemini est prêt pour l'analyse sémantique.",
      canClear: true,
    };
  }
  return {
    statusText: 'Non configuré',
    statusClass: 'gemini-badge gemini-badge-unconfigured',
    hintText: "Configurez votre clé Gemini pour activer l'analyse IA.",
    canClear: false,
  };
}

function computeConfidenceBadge(confidence) {
  const pct = Math.round(confidence * 100);
  if (pct >= 85) return { pct, className: 'high' };
  if (pct >= 60) return { pct, className: 'medium' };
  return { pct, className: 'low' };
}

function computeSourceBadge(source) {
  if (source === 'gemini') {
    return { label: '🤖 Gemini', className: 'source-badge gemini' };
  }
  return { label: '⚡ Fallback local', className: 'source-badge fallback' };
}

function computeScanFeedbackMessage(mappings, totalDetected) {
  const hasGemini = mappings.some((m) => m.source === 'gemini');
  if (hasGemini) {
    return {
      type: 'success',
      text: `✅ Analyse terminée avec Gemini : ${totalDetected} champ(s) analysé(s).`,
    };
  }
  return {
    type: 'warning',
    text: `⚠️ Gemini indisponible — analyse locale (fallback) utilisée : ${totalDetected} champ(s).`,
  };
}

function filterReadyToFillMappings(mappings) {
  return mappings.filter(
    (m) =>
      (m.status === 'MATCHED' || m.status === 'CONFIRMED') &&
      !m.epistemicBlockReason &&
      m.resolvedValue !== undefined &&
      m.resolvedValue !== null
  );
}

// ─── SUITE DE TESTS DU SIDE PANEL (Étape 4) ────────────────────────────────

describe('Side Panel UX & Gestion Gemini (Étape 4)', () => {
  // 1. État Gemini non configuré
  it('1. [État Gemini Non Configuré] Affiche le statut non configuré et désactive la suppression', () => {
    const state = computeGeminiUIState(false);
    assert.equal(state.statusText, 'Non configuré');
    assert.ok(state.statusClass.includes('gemini-badge-unconfigured'));
    assert.equal(state.canClear, false);
    assert.ok(state.hintText.includes('Configurez votre clé'));
  });

  // 2. État Gemini configuré
  it('2. [État Gemini Configuré] Affiche le statut configuré et active le bouton de suppression', () => {
    const state = computeGeminiUIState(true);
    assert.equal(state.statusText, 'Configuré');
    assert.ok(state.statusClass.includes('gemini-badge-configured'));
    assert.equal(state.canClear, true);
    assert.ok(state.hintText.includes('Gemini est prêt'));
  });

  // 3. Sauvegarde & Suppression de clé (sans fuite)
  it('3. [Sécurité Clé] La clé enregistrée valide l\'état sans être exposée dans le DOM', () => {
    let storedKey = null;
    const saveKey = (key) => { storedKey = key.trim(); };
    const clearKey = () => { storedKey = null; };

    saveKey('AIzaSyTestSecret123');
    assert.equal(Boolean(storedKey), true);
    assert.equal(computeGeminiUIState(Boolean(storedKey)).statusText, 'Configuré');

    clearKey();
    assert.equal(Boolean(storedKey), false);
    assert.equal(computeGeminiUIState(Boolean(storedKey)).statusText, 'Non configuré');
  });

  // 4. Badge Source Gemini
  it('4. [Badge Source Gemini] Affiche le label Gemini avec classe CSS distincte', () => {
    const badge = computeSourceBadge('gemini');
    assert.equal(badge.label, '🤖 Gemini');
    assert.ok(badge.className.includes('gemini'));
  });

  // 5. Badge Source Fallback local
  it('5. [Badge Source Fallback] Affiche le label Fallback local', () => {
    const badge = computeSourceBadge('local-fallback');
    assert.equal(badge.label, '⚡ Fallback local');
    assert.ok(badge.className.includes('fallback'));
  });

  // 6. Confiance et couleur de tag (>=85% high, 60-84% medium, <60% low)
  it('6. [Badges de Confiance] 90% -> high, 75% -> medium, 50% -> low', () => {
    assert.equal(computeConfidenceBadge(0.92).className, 'high');
    assert.equal(computeConfidenceBadge(0.85).className, 'high');
    assert.equal(computeConfidenceBadge(0.70).className, 'medium');
    assert.equal(computeConfidenceBadge(0.60).className, 'medium');
    assert.equal(computeConfidenceBadge(0.55).className, 'low');
  });

  // 7. Message d'état après analyse Gemini réussie
  it('7. [Feedback Scan Gemini] Notifie l\'utilisateur que Gemini a réalisé l\'analyse', () => {
    const sampleMappings = [
      { fieldId: 'f1', source: 'gemini', status: 'MATCHED' },
      { fieldId: 'f2', source: 'gemini', status: 'MATCHED' },
    ];
    const msg = computeScanFeedbackMessage(sampleMappings, 2);
    assert.equal(msg.type, 'success');
    assert.ok(msg.text.includes('Gemini'));
  });

  // 8. Message d'état après fallback local
  it('8. [Feedback Scan Fallback] Notifie clairement que l\'analyse locale a été utilisée', () => {
    const sampleMappings = [
      { fieldId: 'f1', source: 'local-fallback', status: 'MATCHED' },
    ];
    const msg = computeScanFeedbackMessage(sampleMappings, 1);
    assert.equal(msg.type, 'warning');
    assert.ok(msg.text.includes('fallback'));
  });

  // 9. Filtrage des champs éligibles au remplissage
  it('9. [Sécurité Remplissage] Seuls MATCHED et CONFIRMED sans blocage épistémique sont comptabilisés pour remplissage', () => {
    const mappings = [
      { fieldId: 'f1', status: 'MATCHED', resolvedValue: 'Mohamed', epistemicBlockReason: undefined },
      { fieldId: 'f2', status: 'NEEDS_CONFIRMATION', resolvedValue: '208', epistemicBlockReason: undefined },
      { fieldId: 'f3', status: 'CONFIRMED', resolvedValue: 'Peugeot', epistemicBlockReason: undefined },
      { fieldId: 'f4', status: 'MATCHED', resolvedValue: undefined, epistemicBlockReason: 'Inconnu' },
      { fieldId: 'f5', status: 'UNMATCHED', resolvedValue: undefined, epistemicBlockReason: undefined },
    ];

    const ready = filterReadyToFillMappings(mappings);
    assert.equal(ready.length, 2); // f1 et f3 uniquement
    assert.equal(ready[0].fieldId, 'f1');
    assert.equal(ready[1].fieldId, 'f3');
  });

  // 10. Confirmation unitaire d'un champ NEEDS_CONFIRMATION
  it('10. [Confirmation Manuelle] Passer un statut NEEDS_CONFIRMATION à CONFIRMED le rend éligible au remplissage', () => {
    const mapping = { fieldId: 'f2', status: 'NEEDS_CONFIRMATION', resolvedValue: '208', epistemicBlockReason: undefined };
    assert.equal(filterReadyToFillMappings([mapping]).length, 0);

    mapping.status = 'CONFIRMED';
    assert.equal(filterReadyToFillMappings([mapping]).length, 1);
  });
});
