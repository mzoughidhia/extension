import { CanonicalQuoteRequest } from './canonical-data.model';
import { CanonicalPath, CANONICAL_PATHS } from './canonical-paths';
import { MappingStatus } from './field-mapping.model';

/**
 * Option simplifiée pour les champs de type select ou radio.
 */
export interface CompactFieldOption {
  value: string;
  label: string;
}

/**
 * Représentation compacte et sémantique d'un champ du formulaire.
 */
export interface CompactField {
  /** Identifiant unique de référence dans la session (correspond à DetectedField.elementId) */
  id: string;
  /** Libellé principal associé au champ (ou null) */
  label: string | null;
  /** Attribut technique 'name' de l'élément (ou null) */
  name: string | null;
  /** Type fonctionnel (text, number, date, select, radio, checkbox, textarea, etc.) */
  type: string;
  /** Placeholder indicatif (ou null) */
  placeholder?: string | null;
  /** Nom de la section / du fieldset / du groupe parent (ou null) */
  section?: string | null;
  /** Options disponibles si le champ propose une liste finie (select, radio group) */
  options?: CompactFieldOption[];
  /** Le champ est-il marqué comme requis (required) ? */
  required?: boolean;
  /** Texte d'aide ou aria-label accessible */
  ariaLabel?: string | null;
  /** Contexte textuel proche (en-tête de colonne, texte d'aide) */
  surroundingText?: string | null;
}

/**
 * Métadonnées contextuelles légères sur la page en cours.
 */
export interface CompactPageContext {
  title?: string;
  url?: string;
  hostname?: string;
}

/**
 * Schéma compact complet du formulaire à envoyer au moteur IA.
 */
export interface CompactFormSchema {
  page?: CompactPageContext;
  fields: CompactField[];
}

/**
 * Contrat de requête transmis au moteur de mapping IA (Gemini).
 */
export interface GeminiMappingRequest {
  /** Schéma compact extrait du formulaire */
  formSchema: CompactFormSchema;
  /** Données canoniques disponibles pour le client / dossier */
  availableData: CanonicalQuoteRequest;
  /** Catalogue fermé des chemins canoniques autorisés */
  allowedCanonicalPaths: readonly CanonicalPath[];
}

/**
 * Résultat de mapping unitaire proposé par l'IA pour un champ.
 */
export interface GeminiFieldMapping {
  /** Identifiant du champ correspondant dans CompactFormSchema */
  fieldId: string;
  /** Chemin canonique validé (doit appartenir au catalogue fermé, ou null si non reconnu) */
  canonicalPath: CanonicalPath | null;
  /** Score de confiance estimé par l'IA (entre 0.00 et 1.00) */
  confidence: number;
  /** Explication concise du choix de mapping */
  reason: string;
  /** Statut déduit selon les seuils de confiance */
  status?: MappingStatus;
  /** Valeur suggérée extraite des données disponibles */
  suggestedValue?: unknown;
  /** Indique si une information manque dans les données pour ce champ */
  needsUserInput?: boolean;
  /** Question conversationnelle formulée pour l'utilisateur en cas d'information manquante */
  userQuestion?: string;
  /** Choix suggérés pour l'utilisateur si le champ est un select/radio */
  questionChoices?: string[];
}

/**
 * Réponse structurée renvoyée par le moteur de mapping IA (Gemini).
 */
export interface GeminiMappingResponse {
  /** Liste des correspondances identifiées pour chaque champ du formulaire */
  mappings: GeminiFieldMapping[];
  /** Nom ou version du modèle ayant généré le mapping */
  model?: string;
  /** Résumé général de l'analyse du formulaire */
  summary?: string;
}

export const DEFAULT_ALLOWED_CANONICAL_PATHS: readonly CanonicalPath[] = CANONICAL_PATHS;

/**
 * Contrat de requête pour la lecture d'un document (OCR réel via Gemini) —
 * réutilise le même client/config Gemini que `analyzeForm`, avec un schéma de
 * sortie différent (extraction de champs, pas de mapping de formulaire).
 */
export interface GeminiDocumentExtractionRequest {
  /** Contenu du document encodé en base64 (sans préfixe `data:...;base64,`). */
  documentBase64: string;
  mimeType: string;
  allowedCanonicalPaths: readonly CanonicalPath[];
}

export interface GeminiDocumentExtractedField {
  canonicalPath: CanonicalPath;
  value: string | number | boolean;
  /** Score de confiance estimé par l'IA (entre 0.00 et 1.00). */
  confidence: number;
}

export interface GeminiDocumentExtractionResponse {
  fields: GeminiDocumentExtractedField[];
  model?: string;
}
