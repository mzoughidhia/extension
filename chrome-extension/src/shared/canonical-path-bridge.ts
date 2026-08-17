import { CanonicalQuoteRequest } from '../models/canonical-data.model';
import { CanonicalPath } from '../models/canonical-paths';
import { FieldKnowledge, KnowledgeField } from '../models/field-knowledge.model';
import { AngularQuoteRequest } from './external-messages';

/**
 * Traduction entre le catalogue canonique de l'extension (`CanonicalPath`,
 * 32 chemins, `client.address.*` imbriqué) et celui d'Angular
 * (`QuoteRequestCanonicalPath`, `client.address` à plat, `vehicle.parkingType`
 * commun aux deux).
 *
 * RÈGLE : un seul catalogue canonique par côté — ce fichier ne définit PAS un
 * troisième catalogue, seulement la correspondance entre les deux existants.
 *
 * Différences relevées à l'audit :
 *   - adresse : imbriquée côté extension (`client.address.street`), à plat
 *     côté Angular (`client.address`) → table de correspondance ci-dessous.
 *   - `vehicle.purchaseDate`, `driver.licenseType`,
 *     `insuranceHistory.currentlyInsured` : connus de l'extension, absents du
 *     modèle Angular actuel → jamais transmis (silencieusement filtrés),
 *     plutôt que d'inventer un troisième format ou de casser Angular.
 */
const EXTENSION_TO_ANGULAR_PATH: Partial<Record<CanonicalPath, string>> = {
  'client.address.street': 'client.address',
  'client.address.postalCode': 'client.postalCode',
  'client.address.city': 'client.city',
  'client.address.country': 'client.country',
};

const UNSUPPORTED_ON_ANGULAR: ReadonlySet<CanonicalPath> = new Set([
  'vehicle.purchaseDate',
  'driver.licenseType',
  'insuranceHistory.currentlyInsured',
]);

/**
 * Convertit un chemin canonique de l'extension vers son équivalent Angular,
 * ou `null` si Angular ne modélise pas encore ce champ (jamais transmis).
 */
export function toAngularCanonicalPath(extensionPath: CanonicalPath): string | null {
  if (UNSUPPORTED_ON_ANGULAR.has(extensionPath)) return null;
  return EXTENSION_TO_ANGULAR_PATH[extensionPath] ?? extensionPath;
}

function toKnowledgeField(field: { value: number | null; knowledge: string } | undefined): KnowledgeField<number> {
  if (!field) return { value: null, knowledge: FieldKnowledge.UNKNOWN };
  const knowledge = Object.values(FieldKnowledge).includes(field.knowledge as FieldKnowledge)
    ? (field.knowledge as FieldKnowledge)
    : FieldKnowledge.UNKNOWN;
  return { value: field.value, knowledge };
}

/**
 * Convertit le `QuoteRequest` reçu d'Angular (adresse à plat, champs en
 * moins) vers le `CanonicalQuoteRequest` attendu par le pipeline existant
 * (Gemini / FieldMapper / ConfidenceScorer — inchangés).
 */
export function toExtensionCanonicalQuoteRequest(angular: AngularQuoteRequest): CanonicalQuoteRequest {
  return {
    client: {
      firstName: angular.client.firstName,
      lastName: angular.client.lastName,
      nationalId: angular.client.nationalId,
      birthDate: angular.client.birthDate,
      phone: angular.client.phone,
      email: angular.client.email,
      address: {
        street: angular.client.address,
        postalCode: angular.client.postalCode,
        city: angular.client.city,
        country: angular.client.country,
      },
    },
    vehicle: {
      registration: angular.vehicle.registration,
      brand: angular.vehicle.brand,
      model: angular.vehicle.model,
      version: angular.vehicle.version,
      firstRegistrationDate: angular.vehicle.firstRegistrationDate,
      fiscalPower: angular.vehicle.fiscalPower,
      vehicleValue: angular.vehicle.vehicleValue,
      vehicleType: angular.vehicle.vehicleType,
      usage: angular.vehicle.usage,
      parkingType: angular.vehicle.parkingType,
    },
    driver: {
      sameAsClient: angular.driver.sameAsClient,
      firstName: angular.driver.firstName,
      lastName: angular.driver.lastName,
      birthDate: angular.driver.birthDate,
      licenseDate: angular.driver.licenseDate,
      profession: angular.driver.profession,
      phone: angular.driver.phone,
    },
    insuranceHistory: {
      previousInsurer: angular.insuranceHistory.previousInsurer,
      previousContractStartDate: angular.insuranceHistory.previousContractStartDate,
      previousContractEndDate: angular.insuranceHistory.previousContractEndDate,
      seniority: toKnowledgeField(angular.insuranceHistory.seniority),
      bonusMalus: toKnowledgeField(angular.insuranceHistory.bonusMalus),
      claimsCount: toKnowledgeField(angular.insuranceHistory.claimsCount),
      responsibleClaimsCount: toKnowledgeField(angular.insuranceHistory.responsibleClaimsCount),
      nonResponsibleClaimsCount: toKnowledgeField(angular.insuranceHistory.nonResponsibleClaimsCount),
      wasTerminated: angular.insuranceHistory.wasTerminated,
      terminatedByInsurer: angular.insuranceHistory.terminatedByInsurer,
      terminationReason: angular.insuranceHistory.terminationReason,
      terminationDate: angular.insuranceHistory.terminationDate,
    },
  };
}
