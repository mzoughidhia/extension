/** Types de documents qu'un courtier peut ajouter à un dossier. */
export type DocumentType = 'carte_grise' | 'permis' | 'releve_information' | 'piece_identite' | 'autre';

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'carte_grise',
  'permis',
  'releve_information',
  'piece_identite',
  'autre',
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  carte_grise: 'Carte grise',
  permis: 'Permis de conduire',
  releve_information: "Relevé d'information",
  piece_identite: "Pièce d'identité",
  autre: 'Autre document',
};

export type OcrStatus = 'pending' | 'processing' | 'done' | 'error';

/**
 * Métadonnées d'un document associé à un dossier (`QuoteFileModel.documents`).
 *
 * Le fichier lui-même vit dans Storage (`storagePath`) — jamais son contenu
 * en Firestore.
 */
export interface DocumentRef {
  id: string;
  type: DocumentType;
  fileName: string;
  storagePath: string;
  uploadedAt: number;
  ocrStatus: OcrStatus;
  /** Nombre de champs détectés par l'OCR — connu une fois `ocrStatus === 'done'`. */
  extractedFieldCount?: number;
}

/** Construit la référence d'un nouveau document (id généré côté client, avant upload). */
export function createDocumentRef(type: DocumentType, fileName: string, storagePath: string): DocumentRef {
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    fileName,
    storagePath,
    uploadedAt: Date.now(),
    ocrStatus: 'pending',
  };
}
