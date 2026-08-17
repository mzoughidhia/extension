import { Injectable, inject } from '@angular/core';
import { StorageProvider } from '@karma-solutions-org/ngx-sg';

import { QuoteFileModel } from '../../quote-request-module/models/quote-file.model';
import { QuoteRequestCanonicalPath } from '../../quote-request-module/models/quote-request-canonical.util';
import { QuoteFileService } from '../../quote-request-module/services/quote-file.service';
import { DOCUMENT_TYPE_LABELS, DocumentRef, DocumentType, createDocumentRef } from '../models/document-ref.model';
import {
  PendingConfirmation,
  createPendingConfirmationId,
} from '../models/pending-confirmation.model';
import { setQuoteRequestValue, QUOTE_REQUEST_CANONICAL_LABELS } from '../../quote-request-module/models/quote-request-canonical.util';
import { OcrProvider } from './ocr-provider';
import { mergeOcrResult } from './quote-file-merge.util';

/**
 * Orchestration "document → OCR → fusion → dossier".
 *
 * N'accède jamais à Firestore directement — toutes les écritures du dossier
 * passent par `QuoteFileService` (point d'accès unique déjà en place).
 * L'upload du fichier lui-même passe par `StorageProvider` (abstraction déjà
 * câblée sur Firebase Storage, voir `app.config.ts`).
 */
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly storageProvider = inject(StorageProvider);
  private readonly ocrProvider = inject(OcrProvider);
  private readonly quoteFileService = inject(QuoteFileService);

  /** Upload le fichier dans Storage et ajoute sa référence au dossier. */
  async addDocument(
    quoteFileId: string,
    quoteFile: QuoteFileModel,
    type: DocumentType,
    file: File
  ): Promise<DocumentRef> {
    const storagePath = `quoteFiles/${quoteFileId}/documents/${Date.now()}_${file.name}`;
    await this.storageProvider.upload([{ filePath: storagePath, file }]);

    const documentRef = createDocumentRef(type, file.name, storagePath);
    await this.quoteFileService.addDocument(quoteFileId, quoteFile, documentRef);

    return documentRef;
  }

  /**
   * Lance (ou relance) l'OCR sur un document et fusionne le résultat dans le
   * dossier : champs fiables et jusqu'ici inconnus appliqués automatiquement,
   * conflits transformés en confirmations à soumettre au courtier.
   */
  async runOcr(quoteFileId: string, quoteFile: QuoteFileModel, documentRef: DocumentRef, file: File): Promise<void> {
    await this.quoteFileService.updateDocumentStatus(quoteFileId, quoteFile, documentRef.id, 'processing');

    try {
      const extraction = await this.ocrProvider.extract(documentRef, file);
      const { quote: mergedQuote, results } = mergeOcrResult(quoteFile.quote, extraction);

      const newConfirmations: PendingConfirmation[] = results
        .filter((result) => result.status === 'conflict')
        .map((result) => ({
          id: createPendingConfirmationId(),
          documentId: documentRef.id,
          canonicalPath: result.canonicalPath as QuoteRequestCanonicalPath,
          label: QUOTE_REQUEST_CANONICAL_LABELS[result.canonicalPath as QuoteRequestCanonicalPath],
          currentValue: result.currentValue,
          currentIsKnown: result.currentIsKnown,
          ocrValue: result.ocrValue,
          ocrConfidence: result.ocrConfidence,
          createdAt: Date.now(),
        }));

      await this.quoteFileService.applyOcrResult(quoteFileId, quoteFile, {
        documentId: documentRef.id,
        quote: mergedQuote,
        extractedFieldCount: extraction.fields.length,
        newConfirmations,
      });
    } catch (err) {
      await this.quoteFileService.updateDocumentStatus(quoteFileId, quoteFile, documentRef.id, 'error');
      throw err;
    }
  }

  /**
   * Résout une confirmation en attente : `useOcr` applique la valeur du
   * document, `keepCurrent` la rejette et conserve la valeur du dossier.
   */
  async resolveConfirmation(
    quoteFileId: string,
    quoteFile: QuoteFileModel,
    confirmation: PendingConfirmation,
    decision: 'keepCurrent' | 'useOcr'
  ): Promise<void> {
    const updatedQuote =
      decision === 'useOcr'
        ? setQuoteRequestValue(quoteFile.quote, confirmation.canonicalPath, confirmation.ocrValue)
        : quoteFile.quote;

    await this.quoteFileService.resolveConfirmation(
      quoteFileId,
      quoteFile,
      confirmation.id,
      updatedQuote,
      decision
    );
  }

  documentTypeLabel(type: DocumentType): string {
    return DOCUMENT_TYPE_LABELS[type];
  }
}
