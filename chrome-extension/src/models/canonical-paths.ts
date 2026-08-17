/**
 * Catalogue strict et fermé des chemins canoniques.
 *
 * RÈGLE ABSOLUE : L'agent ne doit jamais mapper vers un chemin qui ne figure pas
 * dans cette liste. Si aucun mapping fiable n'existe, canonicalPath = null.
 */
export const CANONICAL_PATHS = [
  // ─── Client ───────────────────────────────────────────────
  'client.firstName',
  'client.lastName',
  'client.nationalId',
  'client.birthDate',
  'client.phone',
  'client.email',
  'client.address.street',
  'client.address.postalCode',
  'client.address.city',
  'client.address.country',

  // ─── Véhicule ─────────────────────────────────────────────
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
  'vehicle.purchaseDate',

  // ─── Conducteur ───────────────────────────────────────────
  'driver.firstName',
  'driver.lastName',
  'driver.birthDate',
  'driver.licenseDate',
  'driver.licenseType',
  'driver.profession',
  'driver.phone',

  // ─── Historique d'assurance ───────────────────────────────
  'insuranceHistory.currentlyInsured',
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

export type CanonicalPath = (typeof CANONICAL_PATHS)[number];

/** Descriptions lisibles en français pour l'affichage dans l'interface utilisateur. */
export const CANONICAL_PATH_LABELS: Record<CanonicalPath, string> = {
  'client.firstName': 'Prénom du client',
  'client.lastName': 'Nom du client',
  'client.nationalId': 'CIN / Identifiant national',
  'client.birthDate': 'Date de naissance du client',
  'client.phone': 'Téléphone du client',
  'client.email': 'Email du client',
  'client.address.street': 'Adresse (rue)',
  'client.address.postalCode': 'Code postal',
  'client.address.city': 'Ville',
  'client.address.country': 'Pays',

  'vehicle.registration': 'Immatriculation du véhicule',
  'vehicle.brand': 'Marque du véhicule',
  'vehicle.model': 'Modèle du véhicule',
  'vehicle.version': 'Version / Finition du véhicule',
  'vehicle.firstRegistrationDate': 'Date de 1ère mise en circulation',
  'vehicle.fiscalPower': 'Puissance fiscale (CV)',
  'vehicle.vehicleValue': 'Valeur du véhicule',
  'vehicle.vehicleType': 'Type de véhicule',
  'vehicle.usage': 'Usage du véhicule',
  'vehicle.parkingType': 'Mode de stationnement',
  'vehicle.purchaseDate': 'Date d\'achat du véhicule',

  'driver.firstName': 'Prénom du conducteur',
  'driver.lastName': 'Nom du conducteur',
  'driver.birthDate': 'Date de naissance du conducteur',
  'driver.licenseDate': 'Date d\'obtention du permis',
  'driver.licenseType': 'Catégorie de permis (A, A2, B...)',
  'driver.profession': 'Profession du conducteur',
  'driver.phone': 'Téléphone du conducteur',

  'insuranceHistory.currentlyInsured': 'Actuellement ou déjà assuré',
  'insuranceHistory.previousInsurer': 'Assureur précédent',
  'insuranceHistory.previousContractStartDate': 'Date début contrat précédent',
  'insuranceHistory.previousContractEndDate': 'Date fin contrat précédent',
  'insuranceHistory.seniority': 'Ancienneté d\'assurance (années)',
  'insuranceHistory.bonusMalus': 'Coefficient Bonus / Malus',
  'insuranceHistory.claimsCount': 'Nombre total de sinistres',
  'insuranceHistory.responsibleClaimsCount': 'Nombre de sinistres responsables',
  'insuranceHistory.nonResponsibleClaimsCount': 'Nombre de sinistres non responsables',
  'insuranceHistory.wasTerminated': 'Contrat précédent résilié (Oui/Non)',
  'insuranceHistory.terminatedByInsurer': 'Résilié par la compagnie (Oui/Non)',
  'insuranceHistory.terminationReason': 'Motif de résiliation',
  'insuranceHistory.terminationDate': 'Date de résiliation',
};

/** Vérifie si un chemin donné appartient au catalogue fermé. */
export function isValidCanonicalPath(path: string): path is CanonicalPath {
  return (CANONICAL_PATHS as readonly string[]).includes(path);
}
