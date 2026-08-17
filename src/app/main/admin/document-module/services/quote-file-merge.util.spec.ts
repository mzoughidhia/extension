import { createEmptyQuoteRequest } from '../../quote-request-module/models/quote-request.model';
import { knownField } from '../../quote-request-module/models/field-knowledge.model';
import { OcrExtractionResult } from '../models/ocr-extraction.model';
import { mergeOcrField, mergeOcrResult } from './quote-file-merge.util';

describe('quote-file-merge.util', () => {
  describe('mergeOcrField', () => {
    it('auto_filled : champ inconnu du dossier + OCR fiable', () => {
      const quote = createEmptyQuoteRequest();

      const result = mergeOcrField(quote, { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' });

      expect(result.status).toBe('auto_filled');
      expect(result.currentIsKnown).toBeFalse();
    });

    it('conflict : champ inconnu du dossier + OCR peu fiable (jamais auto-appliqué)', () => {
      const quote = createEmptyQuoteRequest();

      const result = mergeOcrField(quote, { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'low' });

      expect(result.status).toBe('conflict');
    });

    it('unchanged : le dossier connaît déjà exactement la même valeur', () => {
      const quote = { ...createEmptyQuoteRequest(), vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Yamaha' } };

      const result = mergeOcrField(quote, { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' });

      expect(result.status).toBe('unchanged');
      expect(result.currentIsKnown).toBeTrue();
    });

    it('conflict : le dossier connaît une valeur différente (jamais écrasée silencieusement)', () => {
      const quote = { ...createEmptyQuoteRequest(), client: { ...createEmptyQuoteRequest().client, birthDate: '1998-05-15' } };

      const result = mergeOcrField(quote, { canonicalPath: 'client.birthDate', value: '1999-05-15', confidence: 'high' });

      expect(result.status).toBe('conflict');
      expect(result.currentValue).toBe('1998-05-15');
      expect(result.ocrValue).toBe('1999-05-15');
    });

    it("gère les champs KnowledgeField (ex : bonusMalus) — KNOWN + OCR différent = conflict", () => {
      const quote = {
        ...createEmptyQuoteRequest(),
        insuranceHistory: { ...createEmptyQuoteRequest().insuranceHistory, bonusMalus: knownField(0.9) },
      };

      const result = mergeOcrField(quote, { canonicalPath: 'insuranceHistory.bonusMalus', value: 0.85, confidence: 'high' });

      expect(result.status).toBe('conflict');
    });

    it('un nombre à peu près égal (arrondi flottant) est traité comme identique', () => {
      const quote = {
        ...createEmptyQuoteRequest(),
        insuranceHistory: { ...createEmptyQuoteRequest().insuranceHistory, bonusMalus: knownField(0.85) },
      };

      const result = mergeOcrField(quote, { canonicalPath: 'insuranceHistory.bonusMalus', value: 0.85, confidence: 'high' });

      expect(result.status).toBe('unchanged');
    });
  });

  describe('mergeOcrResult', () => {
    it('applique automatiquement les champs auto_filled dans le dossier retourné', () => {
      const quote = createEmptyQuoteRequest();
      const extraction: OcrExtractionResult = {
        documentId: 'doc-1',
        provider: 'mock-ocr',
        extractedAt: Date.now(),
        fields: [{ canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' }],
      };

      const { quote: updatedQuote, results } = mergeOcrResult(quote, extraction);

      expect(updatedQuote.vehicle.brand).toBe('Yamaha');
      expect(results[0].status).toBe('auto_filled');
    });

    it("n'écrit rien dans le dossier pour un champ en conflit — reste à la charge de l'appelant", () => {
      const quote = { ...createEmptyQuoteRequest(), vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Peugeot' } };
      const extraction: OcrExtractionResult = {
        documentId: 'doc-1',
        provider: 'mock-ocr',
        extractedAt: Date.now(),
        fields: [{ canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' }],
      };

      const { quote: updatedQuote, results } = mergeOcrResult(quote, extraction);

      expect(updatedQuote.vehicle.brand).toBe('Peugeot');
      expect(results[0].status).toBe('conflict');
    });

    it('un champ absent du résultat OCR ne modifie jamais le dossier (donnée manquante laissée telle quelle)', () => {
      const quote = createEmptyQuoteRequest();
      const extraction: OcrExtractionResult = {
        documentId: 'doc-1',
        provider: 'mock-ocr',
        extractedAt: Date.now(),
        fields: [],
      };

      const { quote: updatedQuote, results } = mergeOcrResult(quote, extraction);

      expect(updatedQuote).toEqual(quote);
      expect(results).toEqual([]);
    });
  });
});
