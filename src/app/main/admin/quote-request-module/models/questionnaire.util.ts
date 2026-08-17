import { QuoteFileModel } from './quote-file.model';
import { getQuoteRequestValue, setQuoteRequestValue } from './quote-request-canonical.util';
import { QuestionnaireQuestion, RequiredField } from './questionnaire.model';
import { QuoteRequest } from './quote-request.model';

/**
 * Calcule les questions restantes pour un extranet donné : uniquement les
 * champs qu'il demande réellement (`requiredFields`), jamais l'intégralité
 * du modèle canonique.
 *
 * Règles :
 *   - champ en attente de confirmation (OCR)      → question de confirmation
 *   - champ obligatoire et inconnu du dossier     → question
 *   - champ non obligatoire et inconnu            → aucune question (jamais posée par anticipation)
 *   - champ déjà connu (répondu ou non)           → aucune question
 *   - champ non demandé par cet extranet          → ignoré (n'apparaît même pas dans `requiredFields`)
 */
export function getMissingQuestions(
  requiredFields: RequiredField[],
  quoteFile: QuoteFileModel
): QuestionnaireQuestion[] {
  const questions: QuestionnaireQuestion[] = [];

  for (const field of requiredFields) {
    const { value, isKnown } = getQuoteRequestValue(quoteFile.quote, field.canonicalPath);
    const pendingConfirmation = quoteFile.pendingConfirmations.find(
      (confirmation) => confirmation.canonicalPath === field.canonicalPath
    );

    if (pendingConfirmation) {
      questions.push({
        id: `q_${field.canonicalPath}`,
        canonicalPath: field.canonicalPath,
        label: field.label,
        type: field.type,
        choices: field.choices,
        required: field.required,
        currentValue: value,
        source: 'needs_confirmation',
      });
      continue;
    }

    if (!isKnown && field.required) {
      questions.push({
        id: `q_${field.canonicalPath}`,
        canonicalPath: field.canonicalPath,
        label: field.label,
        type: field.type,
        choices: field.choices,
        required: field.required,
        currentValue: value,
        source: 'missing',
      });
    }
  }

  return questions;
}

/** `true` si toutes les informations requises par cet extranet sont connues et validées. */
export function isQuoteFileCompleteForExtranet(requiredFields: RequiredField[], quoteFile: QuoteFileModel): boolean {
  return getMissingQuestions(requiredFields, quoteFile).length === 0;
}

/**
 * Applique la réponse du courtier directement dans le modèle canonique du
 * dossier (jamais une copie séparée) et retire toute confirmation OCR en
 * attente pour ce même champ.
 */
export function applyQuestionAnswer(
  quoteFile: QuoteFileModel,
  question: QuestionnaireQuestion,
  value: unknown
): { quote: QuoteRequest; pendingConfirmations: QuoteFileModel['pendingConfirmations'] } {
  const quote = setQuoteRequestValue(quoteFile.quote, question.canonicalPath, value);
  const pendingConfirmations = quoteFile.pendingConfirmations.filter(
    (confirmation) => confirmation.canonicalPath !== question.canonicalPath
  );
  return { quote, pendingConfirmations };
}
