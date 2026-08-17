/**
 * FormMemory — mémoire STRUCTURELLE d'un formulaire déjà analysé.
 *
 * RÈGLE ABSOLUE : FormMemory ne doit JAMAIS contenir de données personnelles
 * du client (nom, email, immatriculation, sinistres, etc.) ni la clé API Gemini.
 * Elle mémorise uniquement la structure du formulaire (labels, types, ordre)
 * et le mapping canonique validé, réutilisable pour n'importe quel client.
 */

/** Version du schéma FormMemory — un changement invalide les mémoires existantes. */
export const FORM_MEMORY_VERSION = 1;

/** Durée de validité d'une mémoire avant expiration (30 jours). */
export const FORM_MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Description structurelle d'un champ (aucune valeur, aucune donnée personnelle).
 */
export interface FormMemoryFieldStructureEntry {
  fieldKey: string;
  name: string | null;
  label: string | null;
  type: string;
  section: string | null;
  order: number;
}

/**
 * Correspondance canonique validée pour un champ (identifié par sa clé structurelle).
 */
export interface FormMemoryFieldMapping {
  fieldKey: string;
  canonicalPath: string | null;
  confidence: number;
  reason: string;
}

/**
 * Mémoire complète d'un formulaire : structure + mapping, indépendante du client.
 */
export interface FormMemory {
  /** Clé unique de la mémoire (dérivée de l'origine + de l'empreinte du formulaire) */
  memoryKey: string;
  /** Nom d'hôte de l'extranet (ex: "www.april-on.fr") */
  origin: string;
  /** Produit détecté si connu (ex: "moto"), sinon null */
  product: string | null;
  /** Empreinte structurelle déterministe du formulaire */
  formFingerprint: string;
  /** Structure des champs (sans valeur, sans donnée personnelle) */
  fieldStructure: FormMemoryFieldStructureEntry[];
  /** Mapping canonique validé, réutilisable pour tout client */
  validatedMappings: FormMemoryFieldMapping[];
  createdAt: string;
  lastUsedAt: string;
  version: number;
}
