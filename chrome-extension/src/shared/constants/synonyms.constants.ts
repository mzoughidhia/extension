import { CanonicalPath } from '../../models/canonical-paths';

export interface FieldSynonymGroup {
  canonicalPath: CanonicalPath;
  /** Mots-clés prioritaires exacts (ex: label, placeholder, name exact) */
  exactKeywords: string[];
  /** Mots-clés partiels / synonymes */
  partialKeywords: string[];
  /** Nom technique attendu (name / id / autocomplete) */
  technicalNames: string[];
  /** Types HTML compatibles */
  expectedTypes?: string[];
  /** Balises attendues */
  expectedTagNames?: Array<'input' | 'select' | 'textarea'>;
}

export const FIELD_SYNONYMS: FieldSynonymGroup[] = [
  // ─── Client ─────────────────────────────────────────────────────────────
  {
    canonicalPath: 'client.firstName',
    exactKeywords: ['prenom', 'first name', 'given name', 'prenom client', 'prenom assure', 'prenom souscripteur'],
    partialKeywords: ['prenom', 'firstname'],
    technicalNames: ['firstname', 'first_name', 'fname', 'prenom', 'client_prenom', 'assure_prenom'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'client.lastName',
    exactKeywords: ['nom', 'last name', 'family name', 'nom client', 'nom assure', 'nom de famille', 'nom souscripteur'],
    partialKeywords: ['nom', 'lastname', 'famille'],
    technicalNames: ['lastname', 'last_name', 'lname', 'nom', 'client_nom', 'assure_nom'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'client.nationalId',
    exactKeywords: ['cin', 'identifiant national', 'numero identite', 'num identite', 'carte identite', 'cni', 'national id'],
    partialKeywords: ['cin', 'identite', 'cni', 'nationalid'],
    technicalNames: ['cin', 'national_id', 'cni', 'identity_number', 'num_cin'],
    expectedTypes: ['text', 'number'],
  },
  {
    canonicalPath: 'client.birthDate',
    exactKeywords: ['date de naissance', 'date naissance', 'birth date', 'ne le', 'nee le', 'date de naissance souscripteur'],
    partialKeywords: ['naissance', 'birthdate', 'dob'],
    technicalNames: ['birthdate', 'birth_date', 'date_naissance', 'datenaissance', 'dob'],
    expectedTypes: ['date', 'text'],
  },
  {
    canonicalPath: 'client.phone',
    exactKeywords: ['telephone', 'numero de telephone', 'mobile', 'portable', 'tel', 'phone', 'gsm'],
    partialKeywords: ['telephone', 'phone', 'mobile', 'portable', 'tel'],
    technicalNames: ['phone', 'tel', 'telephone', 'mobile', 'cellphone', 'gsm'],
    expectedTypes: ['tel', 'text', 'number'],
  },
  {
    canonicalPath: 'client.email',
    exactKeywords: ['email', 'e mail', 'adresse email', 'adresse electronique', 'courriel', 'mail'],
    partialKeywords: ['email', 'mail', 'courriel'],
    technicalNames: ['email', 'e_mail', 'mail', 'courriel', 'user_email'],
    expectedTypes: ['email', 'text'],
  },
  {
    canonicalPath: 'client.address.street',
    exactKeywords: ['adresse', 'adresse postale', 'rue', 'voie', 'adresse ligne 1', 'street address', 'address'],
    partialKeywords: ['adresse', 'street', 'rue'],
    technicalNames: ['address', 'street', 'adresse', 'rue', 'address_line1'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'client.address.postalCode',
    exactKeywords: ['code postal', 'code postal client', 'cp', 'zip code', 'postal code', 'zipcode'],
    partialKeywords: ['code postal', 'cp', 'zipcode', 'postalcode'],
    technicalNames: ['postalcode', 'postal_code', 'zip', 'zipcode', 'cp', 'code_postal'],
    expectedTypes: ['text', 'number'],
  },
  {
    canonicalPath: 'client.address.city',
    exactKeywords: ['ville', 'commune', 'localite', 'city', 'town'],
    partialKeywords: ['ville', 'city', 'commune'],
    technicalNames: ['city', 'ville', 'town', 'commune'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'client.address.country',
    exactKeywords: ['pays', 'country', 'pays de residence'],
    partialKeywords: ['pays', 'country'],
    technicalNames: ['country', 'pays', 'nation'],
    expectedTypes: ['text', 'select'],
  },

  // ─── Véhicule ───────────────────────────────────────────────────────────
  {
    canonicalPath: 'vehicle.registration',
    exactKeywords: ['immatriculation', 'numero immatriculation', 'plaque', 'matricule', 'registration number', 'license plate'],
    partialKeywords: ['immatriculation', 'matricule', 'plaque', 'registration'],
    technicalNames: ['registration', 'immatriculation', 'matricule', 'license_plate', 'plaque_immat'],
    expectedTypes: ['text'],
  },
  {
    canonicalPath: 'vehicle.brand',
    exactKeywords: ['marque', 'constructeur', 'marque du vehicule', 'marque auto', 'brand', 'make'],
    partialKeywords: ['marque', 'constructeur', 'brand', 'make'],
    technicalNames: ['brand', 'marque', 'make', 'constructeur', 'vehicle_brand'],
    expectedTypes: ['text', 'select'],
  },
  {
    canonicalPath: 'vehicle.model',
    exactKeywords: ['modele', 'modele du vehicule', 'modele auto', 'model'],
    partialKeywords: ['modele', 'model'],
    technicalNames: ['model', 'modele', 'vehicle_model'],
    expectedTypes: ['text', 'select'],
  },
  {
    canonicalPath: 'vehicle.version',
    exactKeywords: ['version', 'finition', 'version du vehicule', 'finition vehicule', 'trim'],
    partialKeywords: ['version', 'finition', 'trim'],
    technicalNames: ['version', 'finition', 'trim', 'vehicle_version'],
    expectedTypes: ['text', 'select'],
  },
  {
    canonicalPath: 'vehicle.firstRegistrationDate',
    exactKeywords: ['date de premiere mise en circulation', '1ere mise en circulation', 'premiere immatriculation', 'date mise en circulation', 'date immat'],
    partialKeywords: ['circulation', 'premiere mise', '1ere immat'],
    technicalNames: ['first_registration_date', 'date_circulation', 'date_1ere_immat', 'reg_date'],
    expectedTypes: ['date', 'text'],
  },
  {
    canonicalPath: 'vehicle.fiscalPower',
    exactKeywords: ['puissance fiscale', 'chevaux fiscaux', 'cv', 'puissance cv', 'fiscal power', 'puissance'],
    partialKeywords: ['puissance fiscale', 'chevaux fiscaux', 'fiscal power'],
    technicalNames: ['fiscal_power', 'puissance_fiscale', 'puissance', 'cv', 'fiscalpower'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'vehicle.vehicleValue',
    exactKeywords: ['valeur du vehicule', 'valeur a neuf', 'valeur venale', 'prix d achat', 'prix vehicule', 'vehicle value'],
    partialKeywords: ['valeur', 'prix vehicule', 'prix'],
    technicalNames: ['vehicle_value', 'valeur_vehicule', 'valeur', 'valeur_a_neuf', 'car_value'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'vehicle.vehicleType',
    exactKeywords: ['type de vehicule', 'categorie de vehicule', 'genre', 'carrosserie', 'vehicle type'],
    partialKeywords: ['type vehicule', 'categorie vehicule', 'genre'],
    technicalNames: ['vehicle_type', 'type_vehicule', 'genre', 'category'],
    expectedTypes: ['select', 'text'],
  },
  {
    canonicalPath: 'vehicle.usage',
    exactKeywords: ['usage', 'usage du vehicule', 'utilisation du vehicule', 'type d usage', 'vehicle usage'],
    partialKeywords: ['usage', 'utilisation'],
    technicalNames: ['usage', 'vehicle_usage', 'usage_vehicule'],
    expectedTypes: ['select', 'radio', 'text'],
  },

  // ─── Conducteur ─────────────────────────────────────────────────────────
  {
    canonicalPath: 'driver.licenseDate',
    exactKeywords: ['date d obtention du permis', 'date permis', 'date d obtention permis', 'permis de conduire le', 'license date'],
    partialKeywords: ['permis', 'license date'],
    technicalNames: ['license_date', 'date_permis', 'date_obtention_permis', 'driver_license_date'],
    expectedTypes: ['date', 'text'],
  },
  {
    canonicalPath: 'driver.profession',
    exactKeywords: ['profession', 'profession du conducteur', 'metier', 'activite professionnelle', 'occupation', 'job'],
    partialKeywords: ['profession', 'metier', 'occupation'],
    technicalNames: ['profession', 'metier', 'occupation', 'job', 'driver_profession'],
    expectedTypes: ['text', 'select'],
  },

  // ─── Historique ─────────────────────────────────────────────────────────
  {
    canonicalPath: 'insuranceHistory.previousInsurer',
    exactKeywords: ['assureur precedent', 'compagnie precedente', 'precedente compagnie', 'ancien assureur', 'previous insurer'],
    partialKeywords: ['assureur precedent', 'compagnie precedente', 'ancien assureur'],
    technicalNames: ['previous_insurer', 'compagnie_precedente', 'assureur_precedent', 'ancien_assureur'],
    expectedTypes: ['text', 'select'],
  },
  {
    canonicalPath: 'insuranceHistory.seniority',
    exactKeywords: ['anciennete', 'anciennete d assurance', 'annees d assurance', 'duree d assurance'],
    partialKeywords: ['anciennete'],
    technicalNames: ['seniority', 'anciennete', 'years_insured'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'insuranceHistory.bonusMalus',
    exactKeywords: ['bonus malus', 'coefficient bonus malus', 'crm', 'bonus', 'malus', 'coefficient crm'],
    partialKeywords: ['bonus', 'malus', 'bonusmalus'],
    technicalNames: ['bonus_malus', 'bonusmalus', 'coefficient_bonus_malus', 'crm_coefficient', 'bonus'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'insuranceHistory.claimsCount',
    exactKeywords: ['nombre de sinistres', 'nombre total de sinistres', 'nombre sinistres declares', 'total sinistres', 'claims count'],
    partialKeywords: ['nombre de sinistres', 'sinistres declares', 'nb sinistres'],
    technicalNames: ['claims_count', 'nb_sinistres', 'nombre_sinistres', 'total_claims'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'insuranceHistory.responsibleClaimsCount',
    exactKeywords: ['sinistres responsables', 'nombre de sinistres responsables', 'nb sinistres responsables', 'responsible claims'],
    partialKeywords: ['sinistres responsables', 'responsables'],
    technicalNames: ['responsible_claims', 'sinistres_responsables', 'nb_sinistres_responsables'],
    expectedTypes: ['number', 'text'],
  },
  {
    canonicalPath: 'insuranceHistory.nonResponsibleClaimsCount',
    exactKeywords: ['sinistres non responsables', 'nombre de sinistres non responsables', 'non responsible claims'],
    partialKeywords: ['non responsables'],
    technicalNames: ['non_responsible_claims', 'sinistres_non_responsables'],
    expectedTypes: ['number', 'text'],
  },
];
