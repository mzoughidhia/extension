/**
 * Modèle canonique du client (souscripteur).
 *
 * Les noms des propriétés constituent le vocabulaire canonique de l'application.
 * Ils sont stables et indépendants de toute compagnie d'assurance.
 *
 * Ces noms seront la référence lors du mapping vers les extranets :
 *   client.firstName  ↔  "Prénom" / "First name" / "prénom assuré" …
 */
export interface Client {
  /** Prénom */
  firstName: string;
  /** Nom de famille */
  lastName: string;
  /** CIN / Identifiant national */
  nationalId: string | null;
  /** Date de naissance (ISO 8601 : YYYY-MM-DD) */
  birthDate: string | null;
  /** Téléphone */
  phone: string | null;
  /** Adresse e-mail */
  email: string | null;
  /** Adresse postale */
  address: string | null;
  /** Code postal */
  postalCode: string | null;
  /** Ville */
  city: string | null;
  /** Pays */
  country: string | null;
}

/** Valeur initiale vide — toutes les propriétés obligatoires ont une valeur neutre. */
export function createEmptyClient(): Client {
  return {
    firstName: '',
    lastName: '',
    nationalId: null,
    birthDate: null,
    phone: null,
    email: null,
    address: null,
    postalCode: null,
    city: null,
    country: null,
  };
}
