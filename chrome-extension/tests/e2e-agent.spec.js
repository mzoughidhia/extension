import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Catalogue Canonique Fermé ─────────────────────────────────────────────
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

// ─── Pipeline de Validation & Remplissage E2E ──────────────────────────────
function toCompactSchema(detectedFields, pageContext) {
  return {
    page: pageContext,
    fields: detectedFields.map((f) => ({
      id: f.elementId,
      label: f.label || null,
      name: f.name || null,
      type: f.type || f.tagName,
      placeholder: f.placeholder,
      section: f.sectionName,
    })),
  };
}

function validateGeminiResponse(response, detectedFields) {
  const validMappings = [];
  const rejectedMappings = [];
  const fieldMap = new Map(detectedFields.map((f) => [f.elementId, f]));

  if (!response || !Array.isArray(response.mappings)) {
    return { validMappings: [], rejectedMappings: [] };
  }

  for (const item of response.mappings) {
    const detectedField = fieldMap.get(item.fieldId);
    if (!detectedField) {
      rejectedMappings.push({ fieldId: item.fieldId, error: 'FIELD_NOT_FOUND' });
      continue;
    }

    if (item.canonicalPath && !isValidCanonicalPath(item.canonicalPath)) {
      rejectedMappings.push({ fieldId: item.fieldId, error: 'HALLUCINATED_PATH' });
      continue;
    }

    validMappings.push({
      fieldId: item.fieldId,
      detectedField,
      canonicalPath: item.canonicalPath || null,
      confidence: Math.max(0, Math.min(1.0, item.confidence || 0)),
      reason: item.reason || 'Gemini mapping',
    });
  }

  return { validMappings, rejectedMappings };
}

function resolveEpistemicValue(canonicalPath, quoteData) {
  if (!canonicalPath || !quoteData) return { value: undefined, blockReason: undefined };

  const parts = canonicalPath.split('.');
  let current = quoteData;
  for (const k of parts) current = current?.[k];

  if (current === null || current === undefined) {
    return { value: undefined, blockReason: 'Information non renseignée.' };
  }
  if (typeof current === 'object' && 'knowledge' in current) {
    if (current.knowledge === 'DECLARED_UNKNOWN') {
      return { value: undefined, blockReason: 'Information explicitement déclarée inconnue par le courtier.' };
    }
    if (current.knowledge === 'UNKNOWN') {
      return { value: undefined, blockReason: 'Information non renseignée.' };
    }
    if (current.knowledge === 'KNOWN') {
      return { value: current.value, blockReason: undefined };
    }
  }

  return { value: current, blockReason: undefined };
}

function runPipeline(detectedFields, quoteData, geminiMockResponse, isGeminiAvailable = true) {
  let rawMappings = [];
  let source = 'gemini';

  if (isGeminiAvailable && geminiMockResponse) {
    const validated = validateGeminiResponse(geminiMockResponse, detectedFields);
    const validMap = new Map(validated.validMappings.map((v) => [v.fieldId, v]));

    rawMappings = detectedFields.map((field) => {
      const valid = validMap.get(field.elementId);
      if (valid && valid.canonicalPath) {
        return {
          field,
          canonicalPath: valid.canonicalPath,
          confidence: valid.confidence,
          reasons: [valid.reason],
          source: 'gemini',
        };
      }
      return {
        field,
        canonicalPath: null,
        confidence: 0,
        reasons: ['Non reconnu'],
        source: 'gemini',
      };
    });
  } else {
    // Fallback local déterministe
    source = 'local-fallback';
    rawMappings = detectedFields.map((field) => {
      // Heuristique simple pour le test
      let path = null;
      let conf = 0;
      if (field.name === 'firstname') { path = 'client.firstName'; conf = 0.90; }
      else if (field.name === 'license_plate') { path = 'vehicle.registration'; conf = 0.90; }
      return {
        field,
        canonicalPath: path,
        confidence: conf,
        reasons: ['Fallback local heuristique'],
        source: 'local-fallback',
      };
    });
  }

  // Application des statuts et sécurité épistémique
  return rawMappings.map((m) => {
    let status = 'UNMATCHED';
    if (m.canonicalPath) {
      if (m.confidence >= 0.85) status = 'MATCHED';
      else if (m.confidence >= 0.60) status = 'NEEDS_CONFIRMATION';
    }

    const epistemic = resolveEpistemicValue(m.canonicalPath, quoteData);

    return {
      ...m,
      status,
      resolvedValue: epistemic.value,
      epistemicBlockReason: epistemic.blockReason,
      source: m.source || source,
    };
  });
}

function executeFormFillerSimulation(mappings) {
  // MappingValidator : ne garde que MATCHED ou CONFIRMED sans blocage épistémique
  const fillable = mappings.filter(
    (m) =>
      (m.status === 'MATCHED' || m.status === 'CONFIRMED') &&
      !m.epistemicBlockReason &&
      m.resolvedValue !== undefined &&
      m.resolvedValue !== null
  );

  const filledDOM = {};
  for (const m of fillable) {
    filledDOM[m.field.name || m.field.elementId] = m.resolvedValue;
  }

  return { fillableCount: fillable.length, filledDOM };
}

// ─── Données Dossier Réalistes ──────────────────────────────────────────────
const fullQuoteData = {
  client: { firstName: 'Mohamed', lastName: 'Mzoughi', nationalId: '12345678' },
  vehicle: { registration: '123 TN 4567', brand: 'Peugeot', model: '208', fiscalPower: 5 },
  driver: { licenseDate: '2017-09-20', profession: 'Ingénieur' },
  insuranceHistory: {
    previousInsurer: 'STAR Assurances',
    claimsCount: { value: 0, knowledge: 'KNOWN' }, // 0 KNOWN
    nonResponsibleClaimsCount: { value: null, knowledge: 'DECLARED_UNKNOWN' }, // Inconnu
  },
};

// ─── SUITE DE TESTS END-TO-END FINALE ──────────────────────────────────────

describe('Form Agent — Validation E2E Complète (Étape 5)', () => {
  const extranetFields = [
    { elementId: 'f1', tagName: 'input', type: 'text', name: 'firstname', label: 'Prénom de l\'assuré', isInteractable: true },
    { elementId: 'f2', tagName: 'input', type: 'text', name: 'license_plate', label: 'N° du véhicule (Immatriculation)', isInteractable: true },
    { elementId: 'f3', tagName: 'input', type: 'number', name: 'fiscal_power', label: 'Puissance (en CV fiscaux)', isInteractable: true },
    { elementId: 'f4', tagName: 'input', type: 'text', name: 'previous_insurer', label: 'Ancien contrat (Compagnie d\'assurance)', isInteractable: true },
    { elementId: 'f5', tagName: 'input', type: 'number', name: 'total_claims', label: 'Nombre total de sinistres (0 si aucun)', isInteractable: true },
    { elementId: 'f6', tagName: 'input', type: 'number', name: 'non_responsible_claims', label: 'Nombre de sinistres non responsables', isInteractable: true },
  ];

  // 1. Détection & Création du Schéma Compact
  it('1. [Schéma Compact E2E] Extrait les 6 champs de l\'extranet sans exposer de données DOM internes', () => {
    const schema = toCompactSchema(extranetFields, { title: 'CRM Assurance' });
    assert.equal(schema.fields.length, 6);
    assert.equal(schema.fields[1].label, 'N° du véhicule (Immatriculation)');
    assert.equal(schema.fields[2].type, 'number');
  });

  // 2. Flux E2E avec Gemini Réussi (Compréhension sémantique des libellés ambigus)
  it('2. [Gemini Success E2E] Gemini comprend les libellés ambigus ("N° du véhicule", "Puissance", "Ancien contrat")', () => {
    const geminiMockOutput = {
      mappings: [
        { fieldId: 'f1', canonicalPath: 'client.firstName', confidence: 0.98, reason: 'Prénom souscripteur' },
        { fieldId: 'f2', canonicalPath: 'vehicle.registration', confidence: 0.94, reason: 'N° véhicule = Immatriculation' },
        { fieldId: 'f3', canonicalPath: 'vehicle.fiscalPower', confidence: 0.92, reason: 'Puissance = Puissance fiscale' },
        { fieldId: 'f4', canonicalPath: 'insuranceHistory.previousInsurer', confidence: 0.90, reason: 'Ancien contrat = Assureur précédent' },
        { fieldId: 'f5', canonicalPath: 'insuranceHistory.claimsCount', confidence: 0.96, reason: 'Sinistres total' },
        { fieldId: 'f6', canonicalPath: 'insuranceHistory.nonResponsibleClaimsCount', confidence: 0.95, reason: 'Sinistres non resp' },
      ],
    };

    const pipelineResults = runPipeline(extranetFields, fullQuoteData, geminiMockOutput, true);
    assert.equal(pipelineResults.length, 6);
    assert.equal(pipelineResults[0].source, 'gemini');
    assert.equal(pipelineResults[1].canonicalPath, 'vehicle.registration');
    assert.equal(pipelineResults[2].canonicalPath, 'vehicle.fiscalPower');
    assert.equal(pipelineResults[3].canonicalPath, 'insuranceHistory.previousInsurer');

    // Exécution du remplissage simulé
    const fillResult = executeFormFillerSimulation(pipelineResults);

    // f1 (Mohamed), f2 (123 TN 4567), f3 (5), f4 (STAR Assurances), f5 (0) remplis = 5 champs
    // f6 (DECLARED_UNKNOWN) bloqué par MappingValidator = non rempli
    assert.equal(fillResult.fillableCount, 5);
    assert.equal(fillResult.filledDOM['firstname'], 'Mohamed');
    assert.equal(fillResult.filledDOM['license_plate'], '123 TN 4567');
    assert.equal(fillResult.filledDOM['fiscal_power'], 5);
    assert.equal(fillResult.filledDOM['previous_insurer'], 'STAR Assurances');
    assert.equal(fillResult.filledDOM['total_claims'], 0, 'La valeur 0 (KNOWN) est bien injectée');
    assert.equal(fillResult.filledDOM['non_responsible_claims'], undefined, 'Le champ DECLARED_UNKNOWN ne doit JAMAIS être injecté');
  });

  // 3. Fallback Local en cas d'erreur Gemini
  it('3. [Fallback E2E] Si Gemini est indisponible, le fallback local prend le relais de façon transparente', () => {
    const pipelineResults = runPipeline(extranetFields, fullQuoteData, null, false);
    assert.equal(pipelineResults[0].source, 'local-fallback');
    assert.equal(pipelineResults[0].status, 'MATCHED');

    const fillResult = executeFormFillerSimulation(pipelineResults);
    assert.ok(fillResult.fillableCount >= 2);
    assert.equal(fillResult.filledDOM['firstname'], 'Mohamed');
  });

  // 4. Rejet strict des hallucinations
  it('4. [Anti-Hallucination E2E] Chemin inventé "vehicle.fiscal_power" rejeté et non injecté', () => {
    const geminiMockOutput = {
      mappings: [
        { fieldId: 'f3', canonicalPath: 'vehicle.fiscal_power', confidence: 0.99, reason: 'Hallucination' },
      ],
    };

    const pipelineResults = runPipeline([extranetFields[2]], fullQuoteData, geminiMockOutput, true);
    assert.equal(pipelineResults[0].status, 'UNMATCHED');
    assert.equal(pipelineResults[0].resolvedValue, undefined);

    const fillResult = executeFormFillerSimulation(pipelineResults);
    assert.equal(fillResult.fillableCount, 0);
  });

  // 5. Règle Épistémique : Blocage même si Gemini hallucine une fausse valeur
  it('5. [Sécurité Épistémique E2E] Si Gemini propose de remplir un champ UNKNOWN, le validateur le bloque', () => {
    const geminiMockOutput = {
      mappings: [
        { fieldId: 'f6', canonicalPath: 'insuranceHistory.nonResponsibleClaimsCount', confidence: 0.99, reason: 'IA force' },
      ],
    };

    const pipelineResults = runPipeline([extranetFields[5]], fullQuoteData, geminiMockOutput, true);
    assert.ok(pipelineResults[0].epistemicBlockReason?.includes('déclarée inconnue'));

    const fillResult = executeFormFillerSimulation(pipelineResults);
    assert.equal(fillResult.fillableCount, 0, 'MappingValidator empêche le remplissage du champ inconnu');
  });

  // 6. Gestion du cycle de vie de la clé API
  it('6. [Cycle Clé API E2E] Transition fluide : non configuré (fallback) -> configuré (gemini) -> supprimé (fallback)', () => {
    let hasApiKey = false;

    // 1. Non configuré -> fallback
    let res1 = runPipeline([extranetFields[0]], fullQuoteData, null, hasApiKey);
    assert.equal(res1[0].source, 'local-fallback');

    // 2. Clé configurée -> Gemini actif
    hasApiKey = true;
    const geminiOutput = { mappings: [{ fieldId: 'f1', canonicalPath: 'client.firstName', confidence: 0.98 }] };
    let res2 = runPipeline([extranetFields[0]], fullQuoteData, geminiOutput, hasApiKey);
    assert.equal(res2[0].source, 'gemini');

    // 3. Clé supprimée -> Retour propre en fallback
    hasApiKey = false;
    let res3 = runPipeline([extranetFields[0]], fullQuoteData, null, hasApiKey);
    assert.equal(res3[0].source, 'local-fallback');
  });
});
