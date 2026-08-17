import { FieldKnowledge, knownField } from './field-knowledge.model';
import { QuoteRequest } from './quote-request.model';

/**
 * Catalogue fermé des chemins canoniques du `QuoteRequest` existant
 * (client/véhicule/conducteur/historique assurance — AUCUN nouveau champ).
 *
 * Sert de base commune pour :
 *   - la fusion des informations extraites par OCR dans le dossier,
 *   - le calcul de la progression du dossier,
 *   - le futur questionnaire dynamique (qui ne demandera que les chemins
 *     réellement absents ET requis par l'extranet analysé).
 */
export const QUOTE_REQUEST_CANONICAL_PATHS = [
  'client.firstName',
  'client.lastName',
  'client.nationalId',
  'client.birthDate',
  'client.phone',
  'client.email',
  'client.address',
  'client.postalCode',
  'client.city',
  'client.country',

  'vehicle.registration',
  'vehicle.brand',
  'vehicle.model',
  'vehicle.version',
  'vehicle.firstRegistrationDate',
  'vehicle.fiscalPower',
  'vehicle.vehicleValue',
  'vehicle.vehicleType',
  'vehicle.usage',
  'vehicle.parkingType',

  'driver.firstName',
  'driver.lastName',
  'driver.birthDate',
  'driver.licenseDate',
  'driver.profession',
  'driver.phone',

  'insuranceHistory.previousInsurer',
  'insuranceHistory.previousContractStartDate',
  'insuranceHistory.previousContractEndDate',
  'insuranceHistory.seniority',
  'insuranceHistory.bonusMalus',
  'insuranceHistory.claimsCount',
  'insuranceHistory.responsibleClaimsCount',
  'insuranceHistory.nonResponsibleClaimsCount',
  'insuranceHistory.wasTerminated',
  'insuranceHistory.terminatedByInsurer',
  'insuranceHistory.terminationReason',
  'insuranceHistory.terminationDate',
] as const;

export type QuoteRequestCanonicalPath = (typeof QUOTE_REQUEST_CANONICAL_PATHS)[number];

export function isQuoteRequestCanonicalPath(value: string): value is QuoteRequestCanonicalPath {
  return (QUOTE_REQUEST_CANONICAL_PATHS as readonly string[]).includes(value);
}

/** Libellés français — réutilisent le vocabulaire déjà utilisé dans les formulaires existants. */
export const QUOTE_REQUEST_CANONICAL_LABELS: Record<QuoteRequestCanonicalPath, string> = {
  'client.firstName': 'Prénom du client',
  'client.lastName': 'Nom du client',
  'client.nationalId': 'CIN / Identifiant national',
  'client.birthDate': 'Date de naissance du client',
  'client.phone': 'Téléphone du client',
  'client.email': 'E-mail du client',
  'client.address': 'Adresse',
  'client.postalCode': 'Code postal',
  'client.city': 'Ville',
  'client.country': 'Pays',

  'vehicle.registration': 'Immatriculation',
  'vehicle.brand': 'Marque',
  'vehicle.model': 'Modèle',
  'vehicle.version': 'Version / finition',
  'vehicle.firstRegistrationDate': '1ère mise en circulation',
  'vehicle.fiscalPower': 'Puissance fiscale',
  'vehicle.vehicleValue': 'Valeur du véhicule',
  'vehicle.vehicleType': 'Type de véhicule',
  'vehicle.usage': 'Usage du véhicule',
  'vehicle.parkingType': 'Mode de stationnement habituel',

  'driver.firstName': 'Prénom du conducteur',
  'driver.lastName': 'Nom du conducteur',
  'driver.birthDate': 'Date de naissance du conducteur',
  'driver.licenseDate': "Date d'obtention du permis",
  'driver.profession': 'Profession',
  'driver.phone': 'Téléphone du conducteur',

  'insuranceHistory.previousInsurer': 'Compagnie précédente',
  'insuranceHistory.previousContractStartDate': 'Début du contrat précédent',
  'insuranceHistory.previousContractEndDate': 'Fin du contrat précédent',
  'insuranceHistory.seniority': "Ancienneté d'assurance",
  'insuranceHistory.bonusMalus': 'Coefficient bonus/malus',
  'insuranceHistory.claimsCount': 'Nombre de sinistres',
  'insuranceHistory.responsibleClaimsCount': 'Sinistres responsables',
  'insuranceHistory.nonResponsibleClaimsCount': 'Sinistres non responsables',
  'insuranceHistory.wasTerminated': 'Contrat précédent résilié',
  'insuranceHistory.terminatedByInsurer': 'Résilié par la compagnie',
  'insuranceHistory.terminationReason': 'Motif de résiliation',
  'insuranceHistory.terminationDate': 'Date de résiliation',
};

export interface QuoteRequestValueAccess {
  value: unknown;
  /** `true` si la donnée est réellement connue (KNOWN, ou valeur non vide pour un champ simple). */
  isKnown: boolean;
}

function isKnowledgeField(value: unknown): value is { value: unknown; knowledge: FieldKnowledge } {
  return typeof value === 'object' && value !== null && 'knowledge' in value;
}

/** Lit une valeur du dossier via son chemin canonique, sans jamais interpréter UNKNOWN comme une valeur réelle. */
export function getQuoteRequestValue(
  quote: QuoteRequest,
  path: QuoteRequestCanonicalPath
): QuoteRequestValueAccess {
  const [section, key] = path.split('.') as [keyof QuoteRequest, string];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (quote[section] as any)[key];

  if (isKnowledgeField(raw)) {
    return { value: raw.value, isKnown: raw.knowledge === FieldKnowledge.KNOWN };
  }

  const isKnown = raw !== null && raw !== undefined && raw !== '';
  return { value: raw, isKnown };
}

/**
 * Écrit une valeur dans le dossier via son chemin canonique et retourne un
 * nouveau `QuoteRequest` (immutable). Si le champ cible est un `KnowledgeField`,
 * la valeur est enveloppée en `KNOWN` — jamais écrite en dehors de ce contrat.
 */
export function setQuoteRequestValue(
  quote: QuoteRequest,
  path: QuoteRequestCanonicalPath,
  value: unknown
): QuoteRequest {
  const [section, key] = path.split('.') as [keyof QuoteRequest, string];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSection = quote[section] as any;
  const currentField = currentSection[key];

  const nextValue = isKnowledgeField(currentField) ? knownField(value) : value;

  return { ...quote, [section]: { ...currentSection, [key]: nextValue } };
}

/** Les chemins canoniques dont la valeur n'est pas encore connue dans ce dossier. */
export function computeMissingCanonicalPaths(quote: QuoteRequest): QuoteRequestCanonicalPath[] {
  return QUOTE_REQUEST_CANONICAL_PATHS.filter((path) => !getQuoteRequestValue(quote, path).isKnown);
}

/** Pourcentage de complétude du dossier (0-100), basé sur le catalogue canonique. */
export function computeQuoteRequestCompleteness(quote: QuoteRequest): number {
  const known = QUOTE_REQUEST_CANONICAL_PATHS.length - computeMissingCanonicalPaths(quote).length;
  return Math.round((known / QUOTE_REQUEST_CANONICAL_PATHS.length) * 100);
}
