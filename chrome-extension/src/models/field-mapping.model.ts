import { CanonicalPath } from './canonical-paths';
import { DetectedField } from './detected-field.model';

export enum MappingStatus {
  /** Confiance >= 0.90 — Mapping solide prêt pour remplissage */
  MATCHED = 'MATCHED',
  /** 0.70 <= Confiance < 0.90 — Nécessite une confirmation de l'utilisateur */
  NEEDS_CONFIRMATION = 'NEEDS_CONFIRMATION',
  /** Confiance < 0.70 ou aucun chemin canonique correspondant */
  UNMATCHED = 'UNMATCHED',
  /** Ignoré manuellement par l'utilisateur */
  IGNORED = 'IGNORED',
  /** Confirmé manuellement par l'utilisateur */
  CONFIRMED = 'CONFIRMED',
}

export interface FieldMapping {
  /** Le champ HTML détecté dans la page */
  field: DetectedField;
  /** Le chemin canonique identifié (ou null si aucun mapping) */
  canonicalPath: CanonicalPath | null;
  /** Score de confiance calculé (0.00 à 1.00) */
  confidence: number;
  /** Liste des signaux explicatifs ayant motivé ce score */
  reasons: string[];
  /** Statut actuel du mapping */
  status: MappingStatus;
  /** Valeur canonique résolue (prête à être injectée) */
  resolvedValue?: unknown;
  /** Si la valeur est marquée inconnue (FieldKnowledge != KNOWN), description du motif */
  epistemicBlockReason?: string;
  /** Source du mapping : IA Gemini, fallback local déterministe, mémoire de formulaire (cache), ou réponse déjà fournie par le courtier (session) */
  source?: 'gemini' | 'local-fallback' | 'form-memory' | 'user-answer';
  /** Indique si le champ nécessite une question interactive posée à l'utilisateur */
  needsUserInput?: boolean;
  /** Question naturelle formulée pour l'utilisateur */
  userQuestion?: string;
  /** Choix interactifs proposés (boutons) */
  questionChoices?: string[];
  /** Valeur fournie interactivement par l'utilisateur lors de la conversation */
  userProvidedValue?: unknown;
}
