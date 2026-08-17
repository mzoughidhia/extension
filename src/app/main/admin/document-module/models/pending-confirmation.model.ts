import { QuoteRequestCanonicalPath } from '../../quote-request-module/models/quote-request-canonical.util';
import { OcrConfidence } from './ocr-extraction.model';

/**
 * Une information extraite par OCR qui nécessite une décision du courtier :
 * soit un conflit avec une valeur déjà connue dans le dossier, soit une
 * valeur peu fiable trouvée pour un champ jusqu'ici inconnu.
 *
 * Stockée dans `QuoteFileModel.pendingConfirmations` — jamais dans un
 * deuxième système parallèle.
 */
export interface PendingConfirmation {
  id: string;
  documentId: string;
  canonicalPath: QuoteRequestCanonicalPath;
  /** Libellé français capturé à la création — évite de recalculer l'affichage plus tard. */
  label: string;
  currentValue: unknown;
  currentIsKnown: boolean;
  ocrValue: unknown;
  ocrConfidence: OcrConfidence;
  createdAt: number;
}

export function createPendingConfirmationId(): string {
  return `conf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
