import { QuoteRequestCanonicalPath } from '../../quote-request-module/models/quote-request-canonical.util';

/**
 * Fiabilité déclarée par le fournisseur OCR pour un champ extrait.
 *
 * `high`  → peut être appliqué automatiquement si le dossier ne connaît pas
 *           encore la valeur.
 * `low`   → doit toujours être soumis à confirmation, même si le dossier ne
 *           connaît pas encore la valeur.
 */
export type OcrConfidence = 'high' | 'low';

export interface OcrExtractedField {
  canonicalPath: QuoteRequestCanonicalPath;
  value: unknown;
  confidence: OcrConfidence;
}

/** Résultat d'une extraction OCR pour un document donné. */
export interface OcrExtractionResult {
  documentId: string;
  /** Identifie le fournisseur ayant produit le résultat (ex : `'mock-ocr'`). */
  provider: string;
  extractedAt: number;
  fields: OcrExtractedField[];
}
