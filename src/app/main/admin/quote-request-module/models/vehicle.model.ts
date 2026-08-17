/**
 * Usage du véhicule — enum canonique.
 *
 * Ces valeurs seront plus tard mappées vers les valeurs spécifiques de chaque compagnie.
 * Exemple : VehicleUsage.PRIVATE ↔ "Usage privé" / "Privé" / "Private" …
 */
export enum VehicleUsage {
  PRIVATE = 'PRIVATE',
  COMMUTE = 'COMMUTE',
  PROFESSIONAL = 'PROFESSIONAL',
  TRANSPORT = 'TRANSPORT',
}

/** Labels français pour l'affichage dans les selects. */
export const VEHICLE_USAGE_LABELS: Record<VehicleUsage, string> = {
  [VehicleUsage.PRIVATE]: 'Privé',
  [VehicleUsage.COMMUTE]: 'Trajet domicile-travail',
  [VehicleUsage.PROFESSIONAL]: 'Professionnel',
  [VehicleUsage.TRANSPORT]: 'Transport',
};

/**
 * Modèle canonique du véhicule.
 */
export interface Vehicle {
  /** Numéro d'immatriculation */
  registration: string | null;
  /** Marque (ex : Renault, Peugeot) */
  brand: string | null;
  /** Modèle (ex : Clio, 308) */
  model: string | null;
  /** Version / finition */
  version: string | null;
  /** Date de première mise en circulation (ISO 8601 : YYYY-MM-DD) */
  firstRegistrationDate: string | null;
  /** Puissance fiscale (en CV) */
  fiscalPower: number | null;
  /** Valeur du véhicule (en devise locale) */
  vehicleValue: number | null;
  /** Type de véhicule (ex : Berline, SUV, Utilitaire…) */
  vehicleType: string | null;
  /** Usage */
  usage: VehicleUsage | null;
  /** Mode de stationnement habituel (ex : garage fermé, parking collectif, voie publique) */
  parkingType: string | null;
}

/** Valeur initiale vide. */
export function createEmptyVehicle(): Vehicle {
  return {
    registration: null,
    brand: null,
    model: null,
    version: null,
    firstRegistrationDate: null,
    fiscalPower: null,
    vehicleValue: null,
    vehicleType: null,
    usage: null,
    parkingType: null,
  };
}
