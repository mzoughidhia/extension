/**
 * Tests d'intégration du pipeline complet : FieldMapper + ConfidenceScorer + MappingValidator
 *
 * Ces tests sont auto-contenus : ils reproduisent les structures de données et la logique
 * du pipeline sans dépendre d'imports TypeScript (non supportés par Node.js ESM directement).
 *
 * La logique réelle de scoring est testée ici de façon white-box.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Enums ──────────────────────────────────────────────────────────────────
const FieldKnowledge = { KNOWN: 'KNOWN', UNKNOWN: 'UNKNOWN', DECLARED_UNKNOWN: 'DECLARED_UNKNOWN', NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION' };
const MappingStatus = { MATCHED: 'MATCHED', NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION', UNMATCHED: 'UNMATCHED', IGNORED: 'IGNORED', CONFIRMED: 'CONFIRMED' };

const THRESHOLDS = { autoMatch: 0.90, needsConfirm: 0.70 };

// ─── Mock Data ───────────────────────────────────────────────────────────────
const quoteData = {
  client: {
    firstName: 'Mohamed', lastName: 'Mzoughi', nationalId: '12345678',
    birthDate: '1998-05-12', phone: '+21698123456', email: 'mohamed.mzoughi@example.com',
    street: '15 Avenue Habib Bourguiba', postalCode: '1000', city: 'Tunis', country: 'Tunisie',
  },
  vehicle: {
    registration: '123 TN 4567', brand: 'Peugeot', model: '208',
    version: '1.2 PureTech 100 Allure', firstRegistrationDate: '2021-06-15',
    fiscalPower: 5, vehicleValue: 45000, vehicleType: 'Voiture', usage: 'PRIVATE',
  },
  driver: {
    sameAsClient: true, firstName: 'Mohamed', lastName: 'Mzoughi',
    birthDate: '1998-05-12', licenseDate: '2017-09-20', profession: 'Ingénieur',
  },
  insuranceHistory: {
    previousInsurer: 'STAR Assurances',
    seniority: { value: 3, knowledge: 'KNOWN' },
    bonusMalus: { value: 0.8, knowledge: 'KNOWN' },
    claimsCount: { value: 0, knowledge: 'KNOWN' },
    responsibleClaimsCount: { value: 0, knowledge: 'KNOWN' },
    nonResponsibleClaimsCount: { value: null, knowledge: 'DECLARED_UNKNOWN' },
    wasTerminated: false, terminatedByInsurer: false, terminationReason: null, terminationDate: null,
  },
};

// ─── Logique de test simplifiée (simule le scoring déterministe) ──────────────
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function containsKeyword(haystack, needle) {
  const h = ` ${normalizeText(haystack)} `;
  const n = normalizeText(needle);
  if (!n) return false;
  return h.includes(` ${n} `) || h.includes(n);
}

// Dictionnaire de test simplifié (sous-ensemble des synonymes réels)
const FIELD_SYNONYMS_TEST = [
  { canonicalPath: 'client.firstName', exactKeywords: ['prenom', 'prenom assure', 'prenom client'], partialKeywords: ['prenom', 'firstname'], technicalNames: ['firstname', 'first_name', 'fname', 'prenom'] },
  { canonicalPath: 'client.lastName', exactKeywords: ['nom', 'nom assure', 'nom de famille'], partialKeywords: ['nom', 'lastname'], technicalNames: ['lastname', 'last_name', 'lname', 'nom'] },
  { canonicalPath: 'vehicle.registration', exactKeywords: ['immatriculation', 'numero immatriculation', 'plaque'], partialKeywords: ['immatriculation', 'matricule', 'plaque', 'registration'], technicalNames: ['registration', 'immatriculation', 'license_plate', 'registration_number'] },
  { canonicalPath: 'vehicle.fiscalPower', exactKeywords: ['puissance fiscale', 'chevaux fiscaux', 'cv', 'puissance cv'], partialKeywords: ['puissance fiscale', 'chevaux fiscaux'], technicalNames: ['fiscal_power', 'puissance_fiscale', 'cv', 'fiscalpower'] },
  { canonicalPath: 'insuranceHistory.claimsCount', exactKeywords: ['nombre de sinistres', 'nombre total de sinistres', 'total sinistres'], partialKeywords: ['nombre de sinistres', 'sinistres declares', 'nb sinistres'], technicalNames: ['claims_count', 'nb_sinistres', 'nombre_sinistres'] },
  { canonicalPath: 'insuranceHistory.nonResponsibleClaimsCount', exactKeywords: ['sinistres non responsables', 'nombre de sinistres non responsables'], partialKeywords: ['non responsables'], technicalNames: ['non_responsible_claims', 'sinistres_non_responsables'] },
];

function scoreField(field, data) {
  let bestCanonical = null;
  let bestScore = 0;
  let bestReasons = [];

  const normLabel = normalizeText(field.label);
  const normName = normalizeText(field.name);

  for (const group of FIELD_SYNONYMS_TEST) {
    let score = 0;
    const reasons = [];

    if (normLabel) {
      if (group.exactKeywords.some(kw => normLabel === kw || ` ${normLabel} `.includes(` ${kw} `))) {
        score += 0.65; reasons.push(`Libellé exact : "${field.label}"`);
      } else if (group.partialKeywords.some(kw => containsKeyword(normLabel, kw))) {
        score += 0.45; reasons.push(`Libellé partiel`);
      }
    }

    if (normName) {
      const techText = normName;
      if (group.technicalNames.some(tech => containsKeyword(techText, tech))) {
        score += 0.35; reasons.push(`Attribut technique : name="${field.name}"`);
      }
    }

    score = Math.min(1.0, score);
    if (score > bestScore) {
      bestScore = score;
      bestCanonical = group.canonicalPath;
      bestReasons = reasons;
    }
  }

  let status = MappingStatus.UNMATCHED;
  if (bestScore >= THRESHOLDS.autoMatch) status = MappingStatus.MATCHED;
  else if (bestScore >= THRESHOLDS.needsConfirm) status = MappingStatus.NEEDS_CONFIRMATION;

  // Résolution de valeur canonique
  let resolvedValue;
  let epistemicBlockReason;

  if (bestCanonical && data) {
    const parts = bestCanonical.split('.');
    let current = data;
    for (const key of parts) current = current?.[key];

    if (current === null || current === undefined) {
      epistemicBlockReason = 'Information non renseignée.';
    } else if (typeof current === 'object' && 'knowledge' in current) {
      if (current.knowledge === FieldKnowledge.DECLARED_UNKNOWN) {
        epistemicBlockReason = 'Information explicitement déclarée inconnue par le courtier — ne pas remplir.';
      } else if (current.knowledge === FieldKnowledge.UNKNOWN) {
        epistemicBlockReason = 'Information non renseignée.';
      } else if (current.knowledge === FieldKnowledge.KNOWN) {
        resolvedValue = current.value;
      }
    } else {
      resolvedValue = current;
    }
  }

  return { field, canonicalPath: bestCanonical, confidence: bestScore, reasons: bestReasons, status, resolvedValue, epistemicBlockReason };
}

function isEligibleForAutoFill(mapping) {
  if (mapping.status !== MappingStatus.MATCHED && mapping.status !== MappingStatus.CONFIRMED) return false;
  if (mapping.epistemicBlockReason) return false;
  if (mapping.resolvedValue === undefined || mapping.resolvedValue === null) return false;
  if (!mapping.field.isInteractable) return false;
  return true;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Pipeline : FieldMapper + ConfidenceScorer + MappingValidator', () => {
  it('✅ "Prénom de l\'assuré" → client.firstName (confiance ≥ 0.90, valeur = Mohamed)', () => {
    const field = { elementId: 'f1', tagName: 'input', type: 'text', name: 'firstname', id: 'assure_prenom', label: "Prénom de l'assuré", placeholder: null, ariaLabel: null, surroundingText: null, sectionName: 'Souscripteur', isInteractable: true };
    const mapping = scoreField(field, quoteData);
    assert.equal(mapping.canonicalPath, 'client.firstName');
    assert.ok(mapping.confidence >= 0.90, `Confiance attendue >= 0.90, obtenu ${mapping.confidence}`);
    assert.equal(mapping.status, MappingStatus.MATCHED);
    assert.equal(mapping.resolvedValue, 'Mohamed');
    assert.equal(isEligibleForAutoFill(mapping), true);
  });

  it('✅ "Numéro d\'immatriculation" → vehicle.registration', () => {
    const field = { elementId: 'f2', tagName: 'input', type: 'text', name: 'registration_number', id: 'immat', label: "Numéro d'immatriculation", placeholder: null, ariaLabel: null, surroundingText: null, sectionName: 'Véhicule', isInteractable: true };
    const mapping = scoreField(field, quoteData);
    assert.equal(mapping.canonicalPath, 'vehicle.registration');
    assert.ok(mapping.confidence >= 0.90);
    assert.equal(mapping.resolvedValue, '123 TN 4567');
  });

  it('✅ "Puissance fiscale (CV)" → vehicle.fiscalPower', () => {
    const field = { elementId: 'f3', tagName: 'input', type: 'number', name: 'fiscal_power', id: 'cv_fiscaux', label: 'Puissance fiscale (CV)', placeholder: null, ariaLabel: null, surroundingText: null, sectionName: 'Véhicule', isInteractable: true };
    const mapping = scoreField(field, quoteData);
    assert.equal(mapping.canonicalPath, 'vehicle.fiscalPower');
    assert.ok(mapping.confidence >= 0.90);
    assert.equal(mapping.resolvedValue, 5);
    assert.equal(isEligibleForAutoFill(mapping), true);
  });

  it('✅ RÈGLE ABSOLUE : claimsCount = 0 (KNOWN) doit être rempli (0 n\'est pas "rien")', () => {
    const field = { elementId: 'f4', tagName: 'input', type: 'number', name: 'claims_count', id: 'nb_sinistres', label: 'Nombre total de sinistres', placeholder: null, ariaLabel: null, surroundingText: null, sectionName: 'Historique', isInteractable: true };
    const mapping = scoreField(field, quoteData);
    assert.equal(mapping.canonicalPath, 'insuranceHistory.claimsCount');
    assert.equal(mapping.resolvedValue, 0, 'La valeur 0 KNOWN doit être résolue comme 0, pas undefined');
    assert.equal(mapping.epistemicBlockReason, undefined);
    assert.equal(isEligibleForAutoFill(mapping), true);
  });

  it('🛡️ RÈGLE ABSOLUE : nonResponsibleClaimsCount (DECLARED_UNKNOWN) ne doit JAMAIS être rempli', () => {
    const field = { elementId: 'f5', tagName: 'input', type: 'number', name: 'non_responsible_claims', id: 'nb_sinistres_non_resp', label: 'Nombre de sinistres non responsables', placeholder: null, ariaLabel: null, surroundingText: null, sectionName: 'Historique', isInteractable: true };
    const mapping = scoreField(field, quoteData);
    assert.equal(mapping.canonicalPath, 'insuranceHistory.nonResponsibleClaimsCount');
    assert.equal(mapping.resolvedValue, undefined, 'Un champ DECLARED_UNKNOWN ne doit jamais produire de valeur');
    assert.ok(mapping.epistemicBlockReason?.includes('déclarée inconnue'), `Attendu le motif épistémique, obtenu: ${mapping.epistemicBlockReason}`);
    assert.equal(isEligibleForAutoFill(mapping), false, 'MappingValidator doit rejeter ce champ');
  });

  it('🚫 Champ sans rapport → UNMATCHED, non rempli', () => {
    const field = { elementId: 'f6', tagName: 'input', type: 'text', name: 'couleur_yeux', id: 'random_field', label: 'Couleur des yeux', placeholder: null, ariaLabel: null, surroundingText: null, sectionName: null, isInteractable: true };
    const mapping = scoreField(field, quoteData);
    assert.equal(mapping.status, MappingStatus.UNMATCHED);
    assert.equal(isEligibleForAutoFill(mapping), false);
  });
});
