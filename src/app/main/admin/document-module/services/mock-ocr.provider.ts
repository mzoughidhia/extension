import { Injectable } from '@angular/core';

import { DocumentRef, DocumentType } from '../models/document-ref.model';
import { OcrExtractedField, OcrExtractionResult } from '../models/ocr-extraction.model';
import { OcrProvider } from './ocr-provider';

/**
 * ⚠️ MOCK — ne lit AUCUN document réel. Produit des données réalistes pour
 * le dossier moto de démonstration, afin de développer et tester le pipeline
 * "document → OCR → fusion → dossier" sans dépendre d'un fournisseur externe.
 *
 * À remplacer par un vrai fournisseur (Google Vision, Document AI, ...) en
 * changeant uniquement le binding dans `app.config.ts` :
 * `{ provide: OcrProvider, useClass: MockOcrProvider }` → `useClass: <VraiProvider>`.
 * Aucun composant Angular n'a à être modifié pour ce remplacement.
 */
@Injectable()
export class MockOcrProvider extends OcrProvider {
  private static readonly SIMULATED_DELAY_MS = 500;

  private static readonly MOCK_FIELDS_BY_TYPE: Record<DocumentType, OcrExtractedField[]> = {
    carte_grise: [
      { canonicalPath: 'vehicle.registration', value: '123 TUN 4567', confidence: 'high' },
      { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' },
      { canonicalPath: 'vehicle.model', value: 'MT-07', confidence: 'high' },
      { canonicalPath: 'vehicle.firstRegistrationDate', value: '2021-03-15', confidence: 'high' },
      { canonicalPath: 'vehicle.fiscalPower', value: 7, confidence: 'high' },
    ],
    permis: [
      { canonicalPath: 'driver.firstName', value: 'Mohamed', confidence: 'high' },
      { canonicalPath: 'driver.lastName', value: 'Mzoughi', confidence: 'high' },
      { canonicalPath: 'driver.birthDate', value: '1998-05-15', confidence: 'high' },
      { canonicalPath: 'driver.licenseDate', value: '2016-06-01', confidence: 'high' },
    ],
    releve_information: [
      { canonicalPath: 'insuranceHistory.previousInsurer', value: 'AXA', confidence: 'high' },
      { canonicalPath: 'insuranceHistory.bonusMalus', value: 0.85, confidence: 'high' },
      { canonicalPath: 'insuranceHistory.claimsCount', value: 0, confidence: 'high' },
      // Champs volontairement peu fiables (texte flou du document scanné) — à confirmer.
      { canonicalPath: 'insuranceHistory.previousContractStartDate', value: '2020-01-10', confidence: 'low' },
      { canonicalPath: 'insuranceHistory.seniority', value: 4, confidence: 'low' },
    ],
    piece_identite: [
      { canonicalPath: 'client.firstName', value: 'Mohamed', confidence: 'high' },
      { canonicalPath: 'client.lastName', value: 'Mzoughi', confidence: 'high' },
      { canonicalPath: 'client.birthDate', value: '1998-05-15', confidence: 'high' },
      { canonicalPath: 'client.nationalId', value: '08123456', confidence: 'high' },
    ],
    // Type générique : aucun champ connu à en extraire automatiquement.
    autre: [],
  };

  async extract(document: DocumentRef, file: File): Promise<OcrExtractionResult> {
    void file; // le mock ne lit pas réellement le contenu du fichier
    await this.simulateProcessingDelay();

    return {
      documentId: document.id,
      provider: 'mock-ocr',
      extractedAt: Date.now(),
      fields: MockOcrProvider.MOCK_FIELDS_BY_TYPE[document.type] ?? [],
    };
  }

  private simulateProcessingDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, MockOcrProvider.SIMULATED_DELAY_MS));
  }
}
