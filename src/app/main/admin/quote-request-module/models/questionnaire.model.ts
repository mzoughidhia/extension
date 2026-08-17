import { QuoteRequestCanonicalPath } from './quote-request-canonical.util';

/**
 * Types de réponse pris en charge par le questionnaire dynamique.
 * (Le choix multiple n'est pas encore nécessaire — à ajouter si un extranet
 * réel en a besoin, plutôt que par anticipation.)
 */
export type QuestionAnswerType = 'text' | 'number' | 'date' | 'boolean' | 'choice';

export interface QuestionChoice {
  value: string;
  label: string;
}

/**
 * Un champ demandé par un extranet — reçu sous cette forme depuis l'analyse
 * réelle réalisée par Form Agent (l'extension, via `FormAgentBridgeService`).
 * Angular ne refait jamais cette analyse : il compare uniquement ce tableau
 * au dossier.
 */
export interface RequiredField {
  canonicalPath: QuoteRequestCanonicalPath;
  /** Libellé humain tel que fourni par l'analyse de l'extranet (jamais le chemin canonique). */
  label: string;
  type: QuestionAnswerType;
  choices?: QuestionChoice[];
  required: boolean;
}

/** Pourquoi cette question est posée. Jamais affiché tel quel à l'utilisateur. */
export type QuestionSource = 'missing' | 'needs_confirmation';

/**
 * Une question concrète à poser au courtier — calculée, jamais stockée telle
 * quelle : elle est reconstruite à chaque fois à partir du dossier et des
 * champs requis par l'extranet en cours (voir `questionnaire.util.ts`).
 */
export interface QuestionnaireQuestion {
  id: string;
  canonicalPath: QuoteRequestCanonicalPath;
  label: string;
  type: QuestionAnswerType;
  choices?: QuestionChoice[];
  required: boolean;
  currentValue: unknown;
  source: QuestionSource;
}

export type ExtranetQuestionnaireStatus = 'in_progress' | 'complete';

/**
 * État du questionnaire pour UN extranet donné, persisté dans le dossier
 * (`QuoteFileModel.extranetQuestionnaires`). Le même dossier peut avoir un
 * état différent par extranet ; les réponses, elles, enrichissent toujours
 * le même `QuoteRequest` central.
 */
export interface ExtranetQuestionnaireState {
  extranetId: string;
  /** Instantané des champs demandés au moment du lancement (ne change pas en cours de route). */
  requiredFields: RequiredField[];
  status: ExtranetQuestionnaireStatus;
  startedAt: number;
  completedAt?: number;
}
