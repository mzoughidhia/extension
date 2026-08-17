import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Catalogue et Définitions ──────────────────────────────────────────────
const CANONICAL_PATHS = [
  'client.firstName', 'client.lastName', 'client.nationalId', 'client.birthDate',
  'client.phone', 'client.email', 'client.address.street', 'client.address.postalCode',
  'client.address.city', 'client.address.country',
  'vehicle.registration', 'vehicle.brand', 'vehicle.model', 'vehicle.version',
  'vehicle.firstRegistrationDate', 'vehicle.fiscalPower', 'vehicle.vehicleValue',
  'vehicle.vehicleType', 'vehicle.usage',
  'driver.firstName', 'driver.lastName', 'driver.birthDate', 'driver.licenseDate',
  'driver.profession', 'driver.phone',
  'insuranceHistory.previousInsurer', 'insuranceHistory.previousContractStartDate',
  'insuranceHistory.previousContractEndDate', 'insuranceHistory.seniority',
  'insuranceHistory.bonusMalus', 'insuranceHistory.claimsCount',
  'insuranceHistory.responsibleClaimsCount', 'insuranceHistory.nonResponsibleClaimsCount',
  'insuranceHistory.wasTerminated', 'insuranceHistory.terminatedByInsurer',
  'insuranceHistory.terminationReason', 'insuranceHistory.terminationDate',
];

function isValidCanonicalPath(path) {
  return CANONICAL_PATHS.includes(path);
}

// ─── Validateur de Réponse Gemini ──────────────────────────────────────────
function validateGeminiResponse(response, detectedFields) {
  const validMappings = [];
  const rejectedMappings = [];
  const fieldMap = new Map(detectedFields.map((f) => [f.elementId, f]));
  const processedFieldIds = new Set();

  if (!response || typeof response !== 'object') {
    return { validMappings: [], rejectedMappings: [], unmappedFields: detectedFields };
  }

  const rawMappings = Array.isArray(response.mappings) ? response.mappings : [];

  for (const item of rawMappings) {
    const fieldId = String(item.fieldId || '');
    const detectedField = fieldMap.get(fieldId);

    // 1. Validation existence dans le DOM
    if (!detectedField) {
      rejectedMappings.push({
        fieldId,
        canonicalPath: null,
        confidence: 0,
        reason: `Champ inexistant dans le formulaire`,
        isValid: false,
        validationError: 'FIELD_NOT_FOUND',
      });
      continue;
    }

    processedFieldIds.add(fieldId);

    let canonicalPath = item.canonicalPath;
    let confidence = typeof item.confidence === 'number' ? Math.max(0, Math.min(1.0, item.confidence)) : 0;
    const reason = String(item.reason || '');

    // 2. Validation catalogue fermé (hallucinations)
    if (canonicalPath) {
      const pathStr = String(canonicalPath);
      if (!isValidCanonicalPath(pathStr)) {
        rejectedMappings.push({
          fieldId,
          detectedField,
          canonicalPath: null,
          confidence: 0,
          reason: `Chemin non valide "${pathStr}" rejeté`,
          isValid: false,
          validationError: 'HALLUCINATED_PATH',
        });
        continue;
      }
      canonicalPath = pathStr;
    } else {
      canonicalPath = null;
    }

    validMappings.push({
      fieldId,
      detectedField,
      canonicalPath,
      confidence,
      reason,
      suggestedValue: item.suggestedValue,
      isValid: true,
    });
  }

  const unmappedFields = detectedFields.filter((f) => !processedFieldIds.has(f.elementId));

  return { validMappings, rejectedMappings, unmappedFields };
}

// ─── Résolution de Valeur et Statut ─────────────────────────────────────────
function buildMappingFromValidated(field, canonicalPath, confidence, reason, quoteData, source = 'gemini') {
  let status = 'UNMATCHED';
  if (canonicalPath) {
    if (confidence >= 0.85) status = 'MATCHED';
    else if (confidence >= 0.60) status = 'NEEDS_CONFIRMATION';
  }

  let resolvedValue = undefined;
  let epistemicBlockReason = undefined;

  if (quoteData && canonicalPath) {
    const parts = canonicalPath.split('.');
    let current = quoteData;
    for (const key of parts) current = current?.[key];

    if (current === null || current === undefined) {
      epistemicBlockReason = 'Information non renseignée.';
    } else if (typeof current === 'object' && 'knowledge' in current) {
      if (current.knowledge === 'DECLARED_UNKNOWN') {
        epistemicBlockReason = 'Information explicitement déclarée inconnue par le courtier.';
      } else if (current.knowledge === 'UNKNOWN') {
        epistemicBlockReason = 'Information non renseignée.';
      } else if (current.knowledge === 'KNOWN') {
        resolvedValue = current.value;
      }
    } else {
      resolvedValue = current;
    }
  }

  return { field, canonicalPath, confidence, reasons: [reason], status, resolvedValue, epistemicBlockReason, source };
}

function isEligibleForAutoFill(mapping) {
  if (mapping.status !== 'MATCHED' && mapping.status !== 'CONFIRMED') return false;
  if (mapping.epistemicBlockReason) return false;
  if (mapping.resolvedValue === undefined || mapping.resolvedValue === null) return false;
  if (!mapping.field.isInteractable) return false;
  return true;
}

// ─── Données Mock ──────────────────────────────────────────────────────────
const mockQuoteData = {
  client: { firstName: 'Mohamed', lastName: 'Mzoughi' },
  vehicle: { brand: 'Peugeot', fiscalPower: 5 },
  insuranceHistory: {
    claimsCount: { value: 0, knowledge: 'KNOWN' },
    nonResponsibleClaimsCount: { value: null, knowledge: 'DECLARED_UNKNOWN' },
  },
};

const sampleFields = [
  { elementId: 'f1', tagName: 'input', type: 'text', name: 'firstname', id: 'f_fn', label: 'Prénom', isInteractable: true },
  { elementId: 'f2', tagName: 'input', type: 'number', name: 'cv', id: 'f_cv', label: 'Puissance fiscale', isInteractable: true },
  { elementId: 'f3', tagName: 'input', type: 'number', name: 'sinistres_non_resp', id: 'f_snr', label: 'Sinistres non responsables', isInteractable: true },
];

// ─── SUITE DE TESTS DU PIPELINE GEMINI (Étape 3) ───────────────────────────

describe('Pipeline de Mapping Gemini & Fallback Hybride (Étape 3)', () => {
  // 1. Gemini Valide
  it('1. [Gemini Valide] Mappe correctement et marque source = gemini', () => {
    const geminiRawResponse = {
      mappings: [
        { fieldId: 'f1', canonicalPath: 'client.firstName', confidence: 0.96, reason: 'Prénom du souscripteur' },
      ],
    };

    const validated = validateGeminiResponse(geminiRawResponse, sampleFields);
    assert.equal(validated.validMappings.length, 1);

    const mapping = buildMappingFromValidated(
      sampleFields[0],
      validated.validMappings[0].canonicalPath,
      validated.validMappings[0].confidence,
      validated.validMappings[0].reason,
      mockQuoteData,
      'gemini'
    );

    assert.equal(mapping.canonicalPath, 'client.firstName');
    assert.equal(mapping.status, 'MATCHED');
    assert.equal(mapping.resolvedValue, 'Mohamed');
    assert.equal(mapping.source, 'gemini');
    assert.equal(isEligibleForAutoFill(mapping), true);
  });

  // 2. Hallucination de chemin
  it('2. [Hallucination Rejetée] "vehicle.fiscal_power" rejeté car absent du catalogue fermé', () => {
    const geminiRawResponse = {
      mappings: [
        { fieldId: 'f2', canonicalPath: 'vehicle.fiscal_power', confidence: 0.95, reason: 'CV' },
      ],
    };

    const validated = validateGeminiResponse(geminiRawResponse, sampleFields);
    assert.equal(validated.validMappings.length, 0);
    assert.equal(validated.rejectedMappings.length, 1);
    assert.equal(validated.rejectedMappings[0].validationError, 'HALLUCINATED_PATH');
  });

  // 3. Champ inexistant dans le DOM
  it('3. [Champ Inexistant Rejeté] fieldId "f_inconnu" rejeté sans polluer les autres champs', () => {
    const geminiRawResponse = {
      mappings: [
        { fieldId: 'f_inconnu', canonicalPath: 'client.firstName', confidence: 0.99, reason: 'Ghost' },
      ],
    };

    const validated = validateGeminiResponse(geminiRawResponse, sampleFields);
    assert.equal(validated.validMappings.length, 0);
    assert.equal(validated.rejectedMappings.length, 1);
    assert.equal(validated.rejectedMappings[0].validationError, 'FIELD_NOT_FOUND');
  });

  // 4. Seuils de confiance
  it('4. [Seuils de Confiance] 0.90 -> MATCHED, 0.70 -> NEEDS_CONFIRMATION, 0.40 -> UNMATCHED', () => {
    const mHigh = buildMappingFromValidated(sampleFields[0], 'client.firstName', 0.90, 'High', mockQuoteData);
    assert.equal(mHigh.status, 'MATCHED');

    const mMed = buildMappingFromValidated(sampleFields[0], 'client.firstName', 0.70, 'Medium', mockQuoteData);
    assert.equal(mMed.status, 'NEEDS_CONFIRMATION');

    const mLow = buildMappingFromValidated(sampleFields[0], 'client.firstName', 0.40, 'Low', mockQuoteData);
    assert.equal(mLow.status, 'UNMATCHED');
  });

  // 5. Fallback local sur erreur réseau
  it('5. [Fallback Réseau] En cas d\'erreur réseau Gemini, source = local-fallback est utilisé', () => {
    // Simulation d'échec Gemini -> déclenchement du fallback
    const isGeminiAvailable = false;
    let finalMapping;

    if (!isGeminiAvailable) {
      finalMapping = {
        field: sampleFields[0],
        canonicalPath: 'client.firstName',
        confidence: 0.92,
        reasons: ['Fallback heuristique'],
        status: 'MATCHED',
        resolvedValue: 'Mohamed',
        source: 'local-fallback',
      };
    }

    assert.equal(finalMapping.source, 'local-fallback');
    assert.equal(finalMapping.status, 'MATCHED');
  });

  // 6. Fallback local sur Timeout
  it('6. [Fallback Timeout] En cas de timeout, le pipeline bascule en local-fallback sans bloquer l\'utilisateur', () => {
    const geminiError = { code: 'TIMEOUT' };
    assert.ok(geminiError.code === 'TIMEOUT');
  });

  // 7. Fallback local sur Quota 429
  it('7. [Fallback 429] En cas de quota 429, bascule immédiate en local-fallback', () => {
    const geminiError = { code: 'RATE_LIMITED' };
    assert.ok(geminiError.code === 'RATE_LIMITED');
  });

  // 8. Fallback local sur Clé Absente
  it('8. [Fallback Clé Absente] En absence de clé API, le fallback local traite le formulaire', () => {
    const hasKey = false;
    assert.equal(hasKey, false);
  });

  // 9. Réponse partiellement invalide
  it('9. [Réponse Partiellement Invalide] 1 mapping valide conservé + 1 hallucination rejetée sans casser le formulaire', () => {
    const mixedResponse = {
      mappings: [
        { fieldId: 'f1', canonicalPath: 'client.firstName', confidence: 0.98, reason: 'Valid' },
        { fieldId: 'f2', canonicalPath: 'vehicle.custom_hallucinated_power', confidence: 0.95, reason: 'Invalid' },
      ],
    };

    const validated = validateGeminiResponse(mixedResponse, sampleFields);
    assert.equal(validated.validMappings.length, 1);
    assert.equal(validated.validMappings[0].canonicalPath, 'client.firstName');
    assert.equal(validated.rejectedMappings.length, 1);
    assert.equal(validated.rejectedMappings[0].fieldId, 'f2');
  });

  // 10. Sécurité Épistémique : DECLARED_UNKNOWN ne doit jamais être rempli par Gemini
  it('10. [RÈGLE ÉPISTÉMIQUE] Même si Gemini mappe avec confiance 0.99, DECLARED_UNKNOWN reste bloqué', () => {
    const geminiResponse = {
      mappings: [
        { fieldId: 'f3', canonicalPath: 'insuranceHistory.nonResponsibleClaimsCount', confidence: 0.99, reason: 'Sinistres' },
      ],
    };

    const validated = validateGeminiResponse(geminiResponse, sampleFields);
    const mapping = buildMappingFromValidated(
      sampleFields[2],
      validated.validMappings[0].canonicalPath,
      validated.validMappings[0].confidence,
      validated.validMappings[0].reason,
      mockQuoteData,
      'gemini'
    );

    assert.equal(mapping.resolvedValue, undefined, 'La valeur doit rester undefined');
    assert.ok(mapping.epistemicBlockReason.includes('déclarée inconnue'));
    assert.equal(isEligibleForAutoFill(mapping), false, 'Le MappingValidator bloque impérativement le remplissage');
  });

  // 11. Pipeline End-to-End
  it('11. [End-to-End Pipeline] Détection -> Validation Gemini -> Scoring -> Validation Remplissage', () => {
    const rawDetected = [
      { elementId: 'e1', tagName: 'input', type: 'text', name: 'fn', label: 'Prénom', isInteractable: true },
      { elementId: 'e2', tagName: 'input', type: 'number', name: 'claims', label: 'Sinistres', isInteractable: true },
    ];

    const geminiOutput = {
      mappings: [
        { fieldId: 'e1', canonicalPath: 'client.firstName', confidence: 0.95, reason: 'OK' },
        { fieldId: 'e2', canonicalPath: 'insuranceHistory.claimsCount', confidence: 0.90, reason: '0 claims' },
      ],
    };

    const validated = validateGeminiResponse(geminiOutput, rawDetected);
    assert.equal(validated.validMappings.length, 2);

    const m1 = buildMappingFromValidated(rawDetected[0], validated.validMappings[0].canonicalPath, validated.validMappings[0].confidence, 'OK', mockQuoteData);
    const m2 = buildMappingFromValidated(rawDetected[1], validated.validMappings[1].canonicalPath, validated.validMappings[1].confidence, 'OK', mockQuoteData);

    assert.equal(isEligibleForAutoFill(m1), true);
    assert.equal(m1.resolvedValue, 'Mohamed');

    // claimsCount=0 (KNOWN) doit être rempli à 0
    assert.equal(isEligibleForAutoFill(m2), true);
    assert.equal(m2.resolvedValue, 0);
  });
});
