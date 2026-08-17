import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  QuoteRequestCanonicalPath,
  isQuoteRequestCanonicalPath,
} from '../../quote-request-module/models/quote-request-canonical.util';
import { FormAgentBridgeService } from '../../quote-request-module/services/form-agent-bridge.service';
import { DocumentRef } from '../models/document-ref.model';
import { OcrExtractedField, OcrExtractionResult } from '../models/ocr-extraction.model';
import { OcrProvider } from './ocr-provider';

/** Types de fichiers pris en charge pour la lecture automatique — mappés vers leur type MIME normalisé. */
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
};

/**
 * Fournisseur OCR réel : envoie le document à Form Agent (l'extension), qui
 * le fait lire par le même service Gemini que l'analyse de formulaire — la
 * clé API reste dans le stockage de l'extension, jamais accessible depuis
 * Angular. Aucun deuxième moteur OCR/Gemini n'est créé ici : uniquement le
 * pont déjà utilisé pour `PREPARE_EXTRANET_QUOTE`/`FILL_EXTRANET_QUOTE`.
 *
 * Respecte le même contrat `OcrProvider` que `MockOcrProvider` — aucun autre
 * composant n'a à changer pour ce remplacement (voir `app.config.ts`).
 */
@Injectable()
export class GeminiOcrProvider extends OcrProvider {
  private readonly formAgentBridge = inject(FormAgentBridgeService);

  async extract(document: DocumentRef, file: File): Promise<OcrExtractionResult> {
    const mimeType = SUPPORTED_MIME_TYPES[file.type];
    if (!mimeType) {
      throw new Error(
        "Ce type de fichier n'est pas pris en charge pour la lecture automatique (PDF, PNG ou JPG uniquement)."
      );
    }

    const documentBase64 = await this.readAsBase64(file);

    const externalFields = await firstValueFrom(
      this.formAgentBridge.analyzeDocument({ documentId: document.id, documentBase64, mimeType })
    );

    const fields: OcrExtractedField[] = [];
    for (const field of externalFields) {
      if (!isQuoteRequestCanonicalPath(field.canonicalPath)) continue; // catalogue fermé : chemin inconnu ignoré

      fields.push({
        canonicalPath: field.canonicalPath as QuoteRequestCanonicalPath,
        value: field.value,
        confidence: field.confidence,
      });
    }

    return {
      documentId: document.id,
      provider: 'gemini-ocr',
      extractedAt: Date.now(),
      fields,
    };
  }

  private readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Impossible de lire le fichier sélectionné.'));
      reader.readAsDataURL(file);
    });
  }
}
