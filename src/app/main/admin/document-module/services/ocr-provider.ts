import { DocumentRef } from '../models/document-ref.model';
import { OcrExtractionResult } from '../models/ocr-extraction.model';

/**
 * Abstraction OCR — même principe que les providers `ngx-sg`
 * (`AuthenticationProvider`, `DatabaseProvider`, `StorageProvider`) : le code
 * métier n'injecte jamais un fournisseur OCR concret, uniquement ce contrat.
 *
 * Phase 2 (cette étape) : lié à `MockOcrProvider` dans `app.config.ts`.
 * Un vrai fournisseur (Google Vision, Document AI, ...) pourra être branché
 * plus tard en remplaçant uniquement ce binding — aucun composant Angular
 * n'a à changer.
 */
export abstract class OcrProvider {
  abstract extract(document: DocumentRef, file: File): Promise<OcrExtractionResult>;
}
