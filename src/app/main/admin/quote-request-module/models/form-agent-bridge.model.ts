import { QuestionAnswerType, RequiredField } from './questionnaire.model';
import { QuoteRequestCanonicalPath, isQuoteRequestCanonicalPath } from './quote-request-canonical.util';

/**
 * Contrat du protocole EXTERNE avec l'extension Chrome "Form Agent"
 * (`chrome.runtime.sendMessage(extensionId, ...)` / `onMessageExternal`).
 *
 * Miroir du contrat côté extension (`chrome-extension/src/shared/external-messages.ts`).
 * Les deux fichiers ne peuvent pas s'importer l'un l'autre (deux builds
 * séparés) : ce sont les DEUX faces d'un même contrat de message, tenues à
 * jour ensemble — pas un troisième catalogue canonique.
 */
export interface FormAgentFieldChoice {
  value: string;
  label: string;
}

export interface FormAgentRequiredField {
  canonicalPath: string;
  label: string;
  type: QuestionAnswerType;
  choices?: FormAgentFieldChoice[];
  required: boolean;
  reason?: string;
}

export interface PrepareExtranetQuoteMessage {
  type: 'PREPARE_EXTRANET_QUOTE';
  quoteFileId: string;
  extranetId: string;
  extranetUrl: string;
  quoteData: unknown;
}

export interface ExtranetFormRequirementsMessage {
  type: 'EXTRANET_FORM_REQUIREMENTS';
  quoteFileId: string;
  extranetId: string;
  fields: FormAgentRequiredField[];
}

export interface ExtranetAnalysisErrorMessage {
  type: 'EXTRANET_ANALYSIS_ERROR';
  quoteFileId: string;
  extranetId: string;
  error: string;
}

export interface FillExtranetQuoteMessage {
  type: 'FILL_EXTRANET_QUOTE';
  quoteFileId: string;
  extranetId: string;
  extranetUrl: string;
  quoteData: unknown;
}

export type FormAgentFillStatus = 'ready' | 'partially_filled' | 'blocked';

export interface FillExtranetResultMessage {
  type: 'FILL_EXTRANET_RESULT';
  quoteFileId: string;
  extranetId: string;
  status: FormAgentFillStatus;
  filledFieldsCount: number;
  missingFields: FormAgentRequiredField[];
  lastStepReached: number | null;
}

export interface FillExtranetErrorMessage {
  type: 'FILL_EXTRANET_ERROR';
  quoteFileId: string;
  extranetId: string;
  error: string;
}

export type FormAgentResponseMessage =
  | ExtranetFormRequirementsMessage
  | ExtranetAnalysisErrorMessage
  | FillExtranetResultMessage
  | FillExtranetErrorMessage;

/** Résultat de remplissage tel qu'exploité par Angular (champs manquants déjà convertis en `RequiredField[]`). */
export interface FillOutcome {
  status: FormAgentFillStatus;
  filledFieldsCount: number;
  missingFields: RequiredField[];
  lastStepReached: number | null;
}

/**
 * Convertit les champs reçus de l'extension en `RequiredField[]` — filtre
 * silencieusement tout chemin canonique qu'Angular ne reconnaît pas (défense
 * en profondeur, même principe que le catalogue fermé côté extension).
 */
export function toRequiredFields(fields: FormAgentRequiredField[]): RequiredField[] {
  const result: RequiredField[] = [];

  for (const field of fields) {
    if (!isQuoteRequestCanonicalPath(field.canonicalPath)) continue;

    result.push({
      canonicalPath: field.canonicalPath as QuoteRequestCanonicalPath,
      label: field.label,
      type: field.type,
      choices: field.choices,
      required: field.required,
    });
  }

  return result;
}
