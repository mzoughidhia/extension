import {
  QuoteRequest,
} from '../../quote-request-module/models/quote-request.model';
import {
  getQuoteRequestValue,
  setQuoteRequestValue,
} from '../../quote-request-module/models/quote-request-canonical.util';
import { OcrConfidence, OcrExtractedField, OcrExtractionResult } from '../models/ocr-extraction.model';

/**
 * Résultat de la fusion d'un champ OCR unique dans le dossier.
 *
 * - `auto_filled` : le dossier ne connaissait pas la valeur, l'OCR est fiable
 *   → appliqué automatiquement, aucune confirmation nécessaire.
 * - `unchanged`    : le dossier connaît déjà exactement la même valeur.
 * - `conflict`     : nécessite une décision du courtier — soit le dossier
 *   connaît une valeur différente, soit l'OCR est peu fiable.
 */
export type MergeFieldStatus = 'auto_filled' | 'unchanged' | 'conflict';

export interface MergeFieldResult {
  canonicalPath: OcrExtractedField['canonicalPath'];
  status: MergeFieldStatus;
  currentValue: unknown;
  currentIsKnown: boolean;
  ocrValue: unknown;
  ocrConfidence: OcrConfidence;
}

export interface MergeResult {
  /** Le dossier mis à jour (champs `auto_filled` appliqués, le reste inchangé). */
  quote: QuoteRequest;
  results: MergeFieldResult[];
}

function valuesAreEquivalent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

/**
 * Fusionne un champ extrait par OCR dans le dossier — règles :
 *
 * | Dossier   | OCR                | Résultat      |
 * |-----------|---------------------|---------------|
 * | connu     | absent              | (non appelé)  |
 * | inconnu   | trouvé, fiable      | auto_filled   |
 * | inconnu   | trouvé, peu fiable  | conflict      |
 * | connu     | même valeur         | unchanged     |
 * | connu     | valeur différente   | conflict      |
 */
export function mergeOcrField(quote: QuoteRequest, field: OcrExtractedField): MergeFieldResult {
  const { value: currentValue, isKnown } = getQuoteRequestValue(quote, field.canonicalPath);

  if (!isKnown) {
    return {
      canonicalPath: field.canonicalPath,
      status: field.confidence === 'high' ? 'auto_filled' : 'conflict',
      currentValue,
      currentIsKnown: false,
      ocrValue: field.value,
      ocrConfidence: field.confidence,
    };
  }

  const status = valuesAreEquivalent(currentValue, field.value) ? 'unchanged' : 'conflict';
  return {
    canonicalPath: field.canonicalPath,
    status,
    currentValue,
    currentIsKnown: true,
    ocrValue: field.value,
    ocrConfidence: field.confidence,
  };
}

/**
 * Fusionne l'ensemble des champs d'un résultat OCR dans le dossier.
 * Applique immédiatement les champs `auto_filled` ; les `conflict` restent à
 * la charge de l'appelant (transformés en `PendingConfirmation`).
 */
export function mergeOcrResult(quote: QuoteRequest, result: OcrExtractionResult): MergeResult {
  let updatedQuote = quote;
  const results: MergeFieldResult[] = [];

  for (const field of result.fields) {
    const outcome = mergeOcrField(updatedQuote, field);
    results.push(outcome);

    if (outcome.status === 'auto_filled') {
      updatedQuote = setQuoteRequestValue(updatedQuote, field.canonicalPath, field.value);
    }
  }

  return { quote: updatedQuote, results };
}
