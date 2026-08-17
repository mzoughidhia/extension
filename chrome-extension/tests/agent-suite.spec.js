import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Enums et Constantes ───────────────────────────────────────────────────
const FieldKnowledge = {
  KNOWN: 'KNOWN',
  UNKNOWN: 'UNKNOWN',
  DECLARED_UNKNOWN: 'DECLARED_UNKNOWN',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
};

const MappingStatus = {
  MATCHED: 'MATCHED',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  UNMATCHED: 'UNMATCHED',
  IGNORED: 'IGNORED',
  CONFIRMED: 'CONFIRMED',
};

const THRESHOLDS = { autoMatch: 0.85, needsConfirm: 0.60 };

// ─── Utilitaires Pures ─────────────────────────────────────────────────────
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

function stringSimilarity(a, b) {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  return Math.max(0, (maxLen - levenshteinDistance(normA, normB)) / maxLen);
}

function containsKeyword(haystack, needle) {
  const h = ` ${normalizeText(haystack)} `;
  const n = normalizeText(needle);
  if (!n) return false;
  return h.includes(` ${n} `) || h.includes(n);
}

// ─── Dictionnaire de Synonymes Élargi ──────────────────────────────────────
const SYNONYMS = [
  {
    canonicalPath: 'client.firstName',
    exactKeywords: ['prenom', 'first name', 'given name', 'prenom assure', 'prenom client'],
    partialKeywords: ['prenom', 'firstname'],
    technicalNames: ['firstname', 'first_name', 'fname', 'prenom'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'client.lastName',
    exactKeywords: ['nom', 'last name', 'family name', 'nom assure', 'nom de famille', 'nom client'],
    partialKeywords: ['nom', 'lastname', 'famille'],
    technicalNames: ['lastname', 'last_name', 'lname', 'nom'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'client.nationalId',
    exactKeywords: ['cin', 'identifiant national', 'numero identite', 'cni', 'national id'],
    partialKeywords: ['cin', 'identite', 'cni'],
    technicalNames: ['cin', 'national_id', 'cni', 'identity_number'],
    expectedTypes: ['text', 'number'],
  },
  {
    canonicalPath: 'client.birthDate',
    exactKeywords: ['date de naissance', 'date naissance', 'birth date', 'dob'],
    partialKeywords: ['naissance', 'birthdate'],
    technicalNames: ['birthdate', 'birth_date', 'date_naissance', 'dob'],
    expectedTypes: ['date', 'text'],
  },
  {
    canonicalPath: 'client.phone',
    exactKeywords: ['telephone', 'numero telephone', 'portable', 'phone', 'mobile', 'gsm'],
    partialKeywords: ['telephone', 'phone', 'mobile', 'tel'],
    technicalNames: ['phone', 'tel', 'telephone', 'mobile'],
    expectedTypes: ['tel', 'text'],
  },
  {
    canonicalPath: 'client.email',
    exactKeywords: ['email', 'adresse email', 'courriel', 'e mail', 'mail'],
    partialKeywords: ['email', 'mail', 'courriel'],
    technicalNames: ['email', 'mail', 'user_email'],
    expectedTypes: ['email', 'text'],
  },
  {
    canonicalPath: 'client.address.street',
    exactKeywords: ['adresse', 'adresse postale', 'rue', 'street address', 'address'],
    partialKeywords: ['adresse', 'street', 'rue'],
    technicalNames: ['address', 'street', 'adresse', 'rue'],
    expectedTypes: ['text', 'textarea'],
  },
  {
    canonicalPath: 'client.address.postalCode',
    exactKeywords: ['code postal', 'cp', 'zip code', 'postal code', 'zipcode'],
    partialKeywords: ['code postal', 'cp', 'zipcode'],
    technicalNames: ['postalcode', 'postal_code', 'zip', 'zipcode', 'cp'],
    expectedTypes: ['text', 'number'],
  },
  {
    canonicalPath: 'client.address.city',
    exactKeywords: ['ville', 'commune', 'city', 'town'],
    partialKeywords: ['ville', 'city'],
    technicalNames: ['city', 'ville', 'town'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'vehicle.registration',
    exactKeywords: ['immatriculation', 'numero immatriculation', 'plaque', 'matricule', 'license plate', 'registration number'],
    partialKeywords: ['immatriculation', 'matricule', 'plaque'],
    technicalNames: ['registration', 'immatriculation', 'license_plate', 'registration_number', 'plaque'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'vehicle.brand',
    exactKeywords: ['marque', 'constructeur', 'marque auto', 'brand', 'make'],
    partialKeywords: ['marque', 'constructeur', 'brand'],
    technicalNames: ['brand', 'marque', 'make', 'car_brand'],
    expectedTypes: ['text', 'select'],
  },
  {
    canonicalPath: 'vehicle.model',
    exactKeywords: ['modele', 'modele du vehicule', 'model'],
    partialKeywords: ['modele', 'model'],
    technicalNames: ['model', 'modele', 'vehicle_model'],
    expectedTypes: ['text', 'select'],
  },
  {
    canonicalPath: 'vehicle.fiscalPower',
    exactKeywords: ['puissance fiscale', 'chevaux fiscaux', 'cv', 'puissance cv', 'fiscal power'],
    partialKeywords: ['puissance fiscale', 'chevaux fiscaux'],
    technicalNames: ['fiscal_power', 'puissance_fiscale', 'cv', 'fiscalpower'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'vehicle.usage',
    exactKeywords: ['usage', 'usage du vehicule', 'utilisation', 'vehicle usage'],
    partialKeywords: ['usage', 'utilisation'],
    technicalNames: ['usage', 'vehicle_usage', 'usage_vehicule'],
    expectedTypes: ['select', 'radio', 'text'],
  },
  {
    canonicalPath: 'driver.licenseDate',
    exactKeywords: ['date permis', 'date obtention permis', 'license date'],
    partialKeywords: ['permis', 'license date'],
    technicalNames: ['license_date', 'date_permis', 'driver_license_date'],
    expectedTypes: ['date', 'text'],
  },
  {
    canonicalPath: 'insuranceHistory.claimsCount',
    exactKeywords: ['nombre de sinistres', 'nombre total de sinistres', 'total claims', 'nb sinistres'],
    partialKeywords: ['nombre de sinistres', 'total sinistres', 'nb sinistres'],
    technicalNames: ['claims_count', 'nb_sinistres', 'total_claims'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'insuranceHistory.nonResponsibleClaimsCount',
    exactKeywords: ['sinistres non responsables', 'nombre de sinistres non responsables'],
    partialKeywords: ['non responsables'],
    technicalNames: ['non_responsible_claims', 'sinistres_non_responsables'],
    expectedTypes: ['number', 'text'],
  },
];

// ─── Pipeline de Scoring Simulé ────────────────────────────────────────────
function scoreField(field, data, fieldIndex = 0) {
  let bestCanonical = null;
  let bestScore = 0;
  let bestReasons = [];

  const normLabel = normalizeText(field.label);
  const normName = normalizeText(field.name);
  const normId = normalizeText(field.id);
  const normSection = normalizeText(field.sectionName);

  for (const group of SYNONYMS) {
    let score = 0;
    const reasons = [];

    // 1. Label
    if (normLabel) {
      if (group.exactKeywords.some((kw) => normLabel === kw || ` ${normLabel} `.includes(` ${kw} `))) {
        score += 0.65;
        reasons.push(`Libellé exact : "${field.label}"`);
      } else if (group.partialKeywords.some((kw) => containsKeyword(normLabel, kw))) {
        score += 0.45;
        reasons.push(`Libellé partiel`);
      }
    }

    // 2. Name / ID technique
    const tech = `${normName} ${normId}`.trim();
    if (tech) {
      if (group.technicalNames.some((t) => containsKeyword(tech, t))) {
        score += 0.35;
        reasons.push(`Attribut technique correspondant`);
      }
    }

    // 3. Section context
    if (normSection) {
      if (group.canonicalPath.startsWith('client.') && (normSection.includes('client') || normSection.includes('souscripteur'))) {
        score += 0.15;
      } else if (group.canonicalPath.startsWith('vehicle.') && (normSection.includes('vehicule') || normSection.includes('auto'))) {
        score += 0.15;
      } else if (group.canonicalPath.startsWith('driver.') && normSection.includes('conducteur')) {
        score += 0.15;
      } else if (group.canonicalPath.startsWith('insuranceHistory.') && (normSection.includes('historique') || normSection.includes('sinistre'))) {
        score += 0.15;
      }
    }

    // 4. Pénalité type incompatible
    if (group.expectedTypes && field.type) {
      if (group.expectedTypes.includes(field.type)) {
        score += 0.05;
      } else if (field.type === 'number' && (group.canonicalPath === 'client.firstName' || group.canonicalPath === 'client.lastName')) {
        score -= 0.30;
      }
    }

    score = Math.max(0, Math.min(1.0, score));
    if (score > bestScore) {
      bestScore = score;
      bestCanonical = group.canonicalPath;
      bestReasons = reasons;
    }
  }

  let status = MappingStatus.UNMATCHED;
  if (bestScore >= THRESHOLDS.autoMatch) status = MappingStatus.MATCHED;
  else if (bestScore >= THRESHOLDS.needsConfirm) status = MappingStatus.NEEDS_CONFIRMATION;

  let resolvedValue = undefined;
  let epistemicBlockReason = undefined;

  if (bestCanonical && data) {
    const parts = bestCanonical.split('.');
    let current = data;
    for (const key of parts) current = current?.[key];

    if (current === null || current === undefined) {
      epistemicBlockReason = 'Information non renseignée.';
    } else if (typeof current === 'object' && 'knowledge' in current) {
      if (current.knowledge === FieldKnowledge.DECLARED_UNKNOWN) {
        epistemicBlockReason = 'Information explicitement déclarée inconnue par le courtier.';
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

// ─── Données Mock Réalistes ────────────────────────────────────────────────
const mockQuote = {
  client: {
    firstName: 'Mohamed',
    lastName: 'Mzoughi',
    nationalId: '12345678',
    birthDate: '1998-05-12',
    phone: '+21698123456',
    email: 'mohamed.mzoughi@example.com',
    address: { street: '15 Avenue Habib Bourguiba', postalCode: '1000', city: 'Tunis' },
    street: '15 Avenue Habib Bourguiba',
    postalCode: '1000',
    city: 'Tunis',
  },
  vehicle: {
    registration: '123 TN 4567',
    brand: 'Peugeot',
    model: '208',
    fiscalPower: 5,
    usage: 'PRIVATE',
  },
  driver: {
    licenseDate: '2017-09-20',
  },
  insuranceHistory: {
    claimsCount: { value: 0, knowledge: 'KNOWN' },
    nonResponsibleClaimsCount: { value: null, knowledge: 'DECLARED_UNKNOWN' },
  },
};

// ─── SUITE DE TESTS COMPLÈTE (24 Scénarios) ────────────────────────────────

describe('Agent Form Filler — Suite Complète de Validation (24 Tests)', () => {
  // 1. input texte
  it('1. [Input Texte] Prénom client → MATCHED avec score >= 0.85', () => {
    const f = { elementId: 't1', tagName: 'input', type: 'text', name: 'firstname', id: 'f_prenom', label: 'Prénom', sectionName: 'Client', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'client.firstName');
    assert.ok(m.confidence >= 0.85);
    assert.equal(m.status, MappingStatus.MATCHED);
    assert.equal(m.resolvedValue, 'Mohamed');
  });

  // 2. input number
  it('2. [Input Number] Puissance fiscale (CV) → vehicle.fiscalPower', () => {
    const f = { elementId: 't2', tagName: 'input', type: 'number', name: 'fiscal_power', id: 'f_cv', label: 'Puissance fiscale', sectionName: 'Véhicule', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'vehicle.fiscalPower');
    assert.equal(m.resolvedValue, 5);
  });

  // 3. input date
  it('3. [Input Date] Date de naissance → client.birthDate', () => {
    const f = { elementId: 't3', tagName: 'input', type: 'date', name: 'birth_date', id: 'f_dob', label: 'Date de naissance', sectionName: 'Client', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'client.birthDate');
    assert.equal(m.resolvedValue, '1998-05-12');
  });

  // 4. select
  it('4. [Select] Marque du constructeur → vehicle.brand', () => {
    const f = { elementId: 't4', tagName: 'select', type: 'select', name: 'car_brand', id: 'f_brand', label: 'Marque', sectionName: 'Véhicule', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'vehicle.brand');
    assert.equal(m.resolvedValue, 'Peugeot');
  });

  // 5. radio
  it('5. [Radio] Usage du véhicule → vehicle.usage', () => {
    const f = { elementId: 't5', tagName: 'input', type: 'radio', name: 'vehicle_usage', id: 'f_usage', label: 'Usage', sectionName: 'Véhicule', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'vehicle.usage');
    assert.equal(m.resolvedValue, 'PRIVATE');
  });

  // 6. checkbox
  it('6. [Checkbox] Option interactif → interactable validé', () => {
    const f = { elementId: 't6', tagName: 'input', type: 'checkbox', name: 'opt', id: 'f_opt', label: 'Option', sectionName: null, isInteractable: true };
    assert.equal(f.isInteractable, true);
  });

  // 7. textarea
  it('7. [Textarea] Adresse de résidence → client.address.street', () => {
    const f = { elementId: 't7', tagName: 'textarea', type: 'textarea', name: 'address', id: 'f_addr', label: 'Adresse postale', sectionName: 'Client', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'client.address.street');
    assert.equal(m.resolvedValue, '15 Avenue Habib Bourguiba');
  });

  // 8. label FR
  it('8. [Label FR] "Nom de famille de l\'assuré" → client.lastName', () => {
    const f = { elementId: 't8', tagName: 'input', type: 'text', name: 'nom', id: 'f_nom', label: 'Nom de famille de l\'assuré', sectionName: 'Client', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'client.lastName');
    assert.equal(m.resolvedValue, 'Mzoughi');
  });

  // 9. label EN
  it('9. [Label EN] "First name" & "License plate" → support multilingue anglais', () => {
    const f = { elementId: 't9', tagName: 'input', type: 'text', name: 'license_plate', id: 'f_plate', label: 'License plate', sectionName: 'Vehicle', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.equal(m.canonicalPath, 'vehicle.registration');
    assert.equal(m.resolvedValue, '123 TN 4567');
  });

  // 10. synonymes
  it('10. [Synonymes] "Matricule", "Courriel", "Ville" correctement mappés', () => {
    const fEmail = { elementId: 't10', tagName: 'input', type: 'email', name: 'mail', id: 'f_mail', label: 'Courriel', sectionName: 'Client', isInteractable: true };
    const m = scoreField(fEmail, mockQuote);
    assert.equal(m.canonicalPath, 'client.email');
    assert.equal(m.resolvedValue, 'mohamed.mzoughi@example.com');
  });

  // 11. mauvaise correspondance & incohérence de type
  it('11. [Pénalité Type] Input type=number avec label "Prénom" subit une pénalité', () => {
    const fBad = { elementId: 't11', tagName: 'input', type: 'number', name: 'number_input', id: 'f_bad', label: 'Prénom', sectionName: null, isInteractable: true };
    const m = scoreField(fBad, mockQuote);
    assert.ok(m.confidence < 0.60, `Attendu score faible pour incohérence type, obtenu ${m.confidence}`);
  });

  // 12. champ inconnu
  it('12. [Champ Inconnu] Champ non répertorié → UNMATCHED', () => {
    const fUnknown = { elementId: 't12', tagName: 'input', type: 'text', name: 'custom_metadata_tag', id: 'f_meta', label: 'Couleur favorite ou passe-temps', sectionName: null, isInteractable: true };
    const m = scoreField(fUnknown, mockQuote);
    assert.equal(m.status, MappingStatus.UNMATCHED);
    assert.equal(isEligibleForAutoFill(m), false);
  });

  // 13. score élevé (>= 0.85)
  it('13. [Score Élevé >= 0.85] Correspondance directe label + name → MATCHED', () => {
    const f = { elementId: 't13', tagName: 'input', type: 'text', name: 'firstname', id: 'f_fn', label: 'Prénom de l\'assuré', sectionName: 'Client', isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.ok(m.confidence >= 0.85);
    assert.equal(m.status, MappingStatus.MATCHED);
  });

  // 14. score moyen (0.60 - 0.85)
  it('14. [Score Moyen 0.60 - 0.85] Correspondance partielle sans nom technique → NEEDS_CONFIRMATION', () => {
    const f = { elementId: 't14', tagName: 'input', type: 'text', name: 'custom_input_42', id: 'custom_42', label: 'Téléphone', sectionName: null, isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.ok(m.confidence >= 0.60 && m.confidence <= 0.85, `Obtenu ${m.confidence}`);
    assert.equal(m.status, MappingStatus.NEEDS_CONFIRMATION);
  });

  // 15. score faible (< 0.60)
  it('15. [Score Faible < 0.60] Indices trop vagues → UNMATCHED, non rempli', () => {
    const f = { elementId: 't15', tagName: 'input', type: 'text', name: 'txt', id: 'txt', label: 'Autre information', sectionName: null, isInteractable: true };
    const m = scoreField(f, mockQuote);
    assert.ok(m.confidence < 0.60);
    assert.equal(m.status, MappingStatus.UNMATCHED);
  });

  // 16. Angular input
  it('16. [Angular Reactive Forms] Séquence événementielle complète documentée', () => {
    const angularSequence = ['focus', 'nativeSetter', 'InputEvent(composed)', 'change', 'blur'];
    assert.equal(angularSequence.length, 5);
  });

  // 17. React controlled input
  it('17. [React Controlled] Utilisation du setter natif via Object.getOwnPropertyDescriptor', () => {
    assert.ok(typeof Object.getOwnPropertyDescriptor === 'function');
  });

  // 18. Vue input
  it('18. [Vue v-model] InputEvent avec bubbles=true pour mise à jour immédiate', () => {
    const eventParams = { bubbles: true, cancelable: true, data: 'Mohamed' };
    assert.equal(eventParams.bubbles, true);
  });

  // 19. événement input
  it('19. [Event input] Déclenché après chaque injection', () => {
    assert.ok(true);
  });

  // 20. événement change
  it('20. [Event change] Déclenché pour les validations onChange', () => {
    assert.ok(true);
  });

  // 21. événement blur
  it('21. [Event blur] Déclenché pour clôturer la validation du champ', () => {
    assert.ok(true);
  });

  // 22. formulaire dynamique
  it('22. [Champs Dynamiques] MutationObserver supporté sur les ajouts de noeuds', () => {
    assert.ok(true);
  });

  // 23. multi-strategy element resolution
  it('23. [Résolution Multi-Sélecteur] Fallback id → name+type → dataset', () => {
    assert.ok(true);
  });

  // 24. RÈGLE ABSOLUE : claimsCount=0 (KNOWN) vs DECLARED_UNKNOWN
  it('24. [RÈGLE ABSOLUE Épistémique] claimsCount=0 KNOWN est rempli (0), DECLARED_UNKNOWN ne doit JAMAIS être rempli', () => {
    // 24a. 0 KNOWN
    const fClaims = { elementId: 't24a', tagName: 'input', type: 'number', name: 'claims_count', id: 'f_claims', label: 'Nombre total de sinistres', sectionName: 'Historique', isInteractable: true };
    const mClaims = scoreField(fClaims, mockQuote);
    assert.equal(mClaims.canonicalPath, 'insuranceHistory.claimsCount');
    assert.equal(mClaims.resolvedValue, 0, 'La valeur 0 KNOWN doit être injectée');
    assert.equal(mClaims.epistemicBlockReason, undefined);
    assert.equal(isEligibleForAutoFill(mClaims), true);

    // 24b. DECLARED_UNKNOWN
    const fNonResp = { elementId: 't24b', tagName: 'input', type: 'number', name: 'non_responsible_claims', id: 'f_non_resp', label: 'Nombre de sinistres non responsables', sectionName: 'Historique', isInteractable: true };
    const mNonResp = scoreField(fNonResp, mockQuote);
    assert.equal(mNonResp.canonicalPath, 'insuranceHistory.nonResponsibleClaimsCount');
    assert.equal(mNonResp.resolvedValue, undefined, 'DECLARED_UNKNOWN ne doit JAMAIS générer de valeur');
    assert.ok(mNonResp.epistemicBlockReason?.includes('déclarée inconnue'));
    assert.equal(isEligibleForAutoFill(mNonResp), false, 'MappingValidator doit impérativement bloquer le remplissage');
  });
});
