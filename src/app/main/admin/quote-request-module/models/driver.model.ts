/**
 * Modèle canonique du conducteur principal.
 *
 * `sameAsClient` : si true, les propriétés communes doivent être recopiées
 * depuis le `Client` par le container — jamais inventées.
 */
export interface Driver {
  /** Si true : le conducteur principal est le client — les champs communs sont copiés. */
  sameAsClient: boolean;
  /** Prénom */
  firstName: string | null;
  /** Nom de famille */
  lastName: string | null;
  /** Date de naissance (ISO 8601) */
  birthDate: string | null;
  /** Date d'obtention du permis de conduire (ISO 8601) */
  licenseDate: string | null;
  /** Profession déclarée */
  profession: string | null;
  /** Téléphone */
  phone: string | null;
  /** Le conducteur est-il le conducteur principal du véhicule ? */
  isPrimaryDriver: boolean;
}

/** Valeur initiale vide. */
export function createEmptyDriver(): Driver {
  return {
    sameAsClient: false,
    firstName: null,
    lastName: null,
    birthDate: null,
    licenseDate: null,
    profession: null,
    phone: null,
    isPrimaryDriver: true,
  };
}
