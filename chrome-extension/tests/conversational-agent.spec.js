import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Simulation du Moteur Conversationnel ──────────────────────────────────
function processRunResultsConversational(detectedFields, quoteData) {
  const autoReady = [];
  const pendingQuestions = [];

  for (const field of detectedFields) {
    let resolvedValue = undefined;
    let epistemicBlockReason = undefined;

    // Résolution de la valeur depuis le mock dossier
    if (field.canonicalPath) {
      const parts = field.canonicalPath.split('.');
      let current = quoteData;
      for (const k of parts) current = current?.[k];

      if (current === null || current === undefined) {
        // Information non trouvée dans les données -> générer une question
        pendingQuestions.push({
          field,
          canonicalPath: field.canonicalPath,
          status: 'NEEDS_CONFIRMATION',
          userQuestion: `Quelle est la valeur pour "${field.label}" ?`,
          questionChoices: field.options ? field.options.map((o) => o.text || o.value) : [],
        });
        continue;
      }

      if (typeof current === 'object' && 'knowledge' in current) {
        if (current.knowledge === 'DECLARED_UNKNOWN') {
          epistemicBlockReason = 'Information déclarée inconnue.';
        } else if (current.knowledge === 'KNOWN') {
          resolvedValue = current.value;
        }
      } else {
        resolvedValue = current;
      }
    }

    if (epistemicBlockReason) {
      // Bloqué épistémiquement
      continue;
    }

    if (resolvedValue !== undefined && resolvedValue !== null) {
      autoReady.push({
        field,
        canonicalPath: field.canonicalPath,
        resolvedValue,
        status: 'MATCHED',
      });
    }
  }

  return { autoReady, pendingQuestions };
}

function handleUserAnswer(pendingQuestion, answer) {
  return {
    field: pendingQuestion.field,
    canonicalPath: pendingQuestion.canonicalPath,
    resolvedValue: answer,
    status: 'CONFIRMED',
    userProvidedValue: answer,
  };
}

// ─── SUITE DE TESTS CONVERSATIONNELS ───────────────────────────────────────

describe('Form Agent — Expérience Conversationnelle & Questions APRIL Moto', () => {
  const motoQuoteData = {
    client: { firstName: 'Mohamed', lastName: 'Mzoughi' },
    vehicle: {
      registration: '123 TN 4567',
      brand: 'Yamaha',
      model: 'MT-07',
      fiscalPower: 7,
      vehicleType: 'Moto',
      parkingType: null, // Volontairement absent
    },
    driver: {
      licenseType: 'A2',
      licenseDate: '2020-04-15',
    },
  };

  const aprilMotoFormFields = [
    { elementId: 'f1', label: 'Immatriculation', canonicalPath: 'vehicle.registration' },
    { elementId: 'f2', label: 'Marque', canonicalPath: 'vehicle.brand' },
    { elementId: 'f3', label: 'Modèle', canonicalPath: 'vehicle.model' },
    { elementId: 'f4', label: 'Catégorie de permis', canonicalPath: 'driver.licenseType' },
    {
      elementId: 'f5',
      label: 'Mode de stationnement habituel',
      canonicalPath: 'vehicle.parkingType',
      options: [
        { value: 'GARAGE_CLOS', text: 'Garage individuel fermé' },
        { value: 'PARKING_COLLECTIF', text: 'Parking collectif fermé' },
        { value: 'VOIE_PUBLIQUE', text: 'Voie publique / Rue' },
      ],
    },
  ];

  // 1. Détection des informations automatiques vs questions nécessaires
  it('1. [Séparation Automatique vs Questions] 4 informations trouvées automatiquement, 1 question pour le stationnement', () => {
    const res = processRunResultsConversational(aprilMotoFormFields, motoQuoteData);
    assert.equal(res.autoReady.length, 4);
    assert.equal(res.pendingQuestions.length, 1);
    assert.equal(res.pendingQuestions[0].field.elementId, 'f5');
    assert.equal(res.pendingQuestions[0].canonicalPath, 'vehicle.parkingType');
  });

  // 2. Génération des choix interactifs pour un select
  it('2. [Choix Interactifs] Propose les 3 modes de stationnement sous forme de boutons de choix', () => {
    const res = processRunResultsConversational(aprilMotoFormFields, motoQuoteData);
    const q = res.pendingQuestions[0];
    assert.ok(Array.isArray(q.questionChoices));
    assert.equal(q.questionChoices.length, 3);
    assert.equal(q.questionChoices[0], 'Garage individuel fermé');
    assert.equal(q.questionChoices[2], 'Voie publique / Rue');
  });

  // 3. Réponse utilisateur et passage en statut CONFIRMED
  it('3. [Réponse Utilisateur] La sélection de "Garage individuel fermé" résout le champ et le valide', () => {
    const res = processRunResultsConversational(aprilMotoFormFields, motoQuoteData);
    const q = res.pendingQuestions[0];
    const answered = handleUserAnswer(q, 'GARAGE_CLOS');

    assert.equal(answered.status, 'CONFIRMED');
    assert.equal(answered.resolvedValue, 'GARAGE_CLOS');
    assert.equal(answered.userProvidedValue, 'GARAGE_CLOS');
  });

  // 4. Prêt pour remplissage complet après réponse
  it('4. [Remplissage Final après Conversation] Tous les 5 champs deviennent éligibles au remplissage', () => {
    const res = processRunResultsConversational(aprilMotoFormFields, motoQuoteData);
    const answered = handleUserAnswer(res.pendingQuestions[0], 'GARAGE_CLOS');

    const totalFillable = [...res.autoReady, answered];
    assert.equal(totalFillable.length, 5);
    assert.ok(totalFillable.every((m) => m.status === 'MATCHED' || m.status === 'CONFIRMED'));
  });
});
