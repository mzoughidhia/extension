import { knownField, declaredUnknownField } from './field-knowledge.model';
import { createEmptyQuoteRequest } from './quote-request.model';
import {
  computeMissingCanonicalPaths,
  computeQuoteRequestCompleteness,
  getQuoteRequestValue,
  setQuoteRequestValue,
  QUOTE_REQUEST_CANONICAL_PATHS,
} from './quote-request-canonical.util';

describe('quote-request-canonical.util', () => {
  describe('getQuoteRequestValue', () => {
    it('un champ simple vide (chaîne vide) est considéré non connu', () => {
      const quote = createEmptyQuoteRequest();
      expect(getQuoteRequestValue(quote, 'client.firstName').isKnown).toBeFalse();
    });

    it('un champ simple renseigné est connu', () => {
      const quote = { ...createEmptyQuoteRequest(), vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Yamaha' } };
      const access = getQuoteRequestValue(quote, 'vehicle.brand');
      expect(access.isKnown).toBeTrue();
      expect(access.value).toBe('Yamaha');
    });

    it('un KnowledgeField UNKNOWN est non connu', () => {
      const quote = createEmptyQuoteRequest();
      expect(getQuoteRequestValue(quote, 'insuranceHistory.claimsCount').isKnown).toBeFalse();
    });

    it('un KnowledgeField KNOWN avec la valeur 0 est bien connu (jamais confondu avec absent)', () => {
      const quote = {
        ...createEmptyQuoteRequest(),
        insuranceHistory: { ...createEmptyQuoteRequest().insuranceHistory, claimsCount: knownField(0) },
      };
      const access = getQuoteRequestValue(quote, 'insuranceHistory.claimsCount');
      expect(access.isKnown).toBeTrue();
      expect(access.value).toBe(0);
    });

    it('un KnowledgeField DECLARED_UNKNOWN reste non connu', () => {
      const quote = {
        ...createEmptyQuoteRequest(),
        insuranceHistory: { ...createEmptyQuoteRequest().insuranceHistory, bonusMalus: declaredUnknownField<number>() },
      };
      expect(getQuoteRequestValue(quote, 'insuranceHistory.bonusMalus').isKnown).toBeFalse();
    });
  });

  describe('setQuoteRequestValue', () => {
    it('écrit un champ simple sans muter le dossier original', () => {
      const quote = createEmptyQuoteRequest();
      const updated = setQuoteRequestValue(quote, 'vehicle.brand', 'Yamaha');

      expect(updated.vehicle.brand).toBe('Yamaha');
      expect(quote.vehicle.brand).toBeNull();
    });

    it('écrit un champ KnowledgeField en KNOWN', () => {
      const quote = createEmptyQuoteRequest();
      const updated = setQuoteRequestValue(quote, 'insuranceHistory.claimsCount', 0);

      expect(getQuoteRequestValue(updated, 'insuranceHistory.claimsCount')).toEqual({ value: 0, isKnown: true });
    });
  });

  describe('computeMissingCanonicalPaths / computeQuoteRequestCompleteness', () => {
    it('un dossier vide ne connaît que les booléens par défaut (wasTerminated/terminatedByInsurer = false)', () => {
      const emptyQuote = createEmptyQuoteRequest();
      const missingCount = computeMissingCanonicalPaths(emptyQuote).length;

      expect(missingCount).toBe(QUOTE_REQUEST_CANONICAL_PATHS.length - 2);
      expect(computeMissingCanonicalPaths(emptyQuote)).not.toContain('insuranceHistory.wasTerminated');
    });

    it('renseigner un champ supplémentaire réduit encore le nombre de champs manquants', () => {
      const emptyQuote = createEmptyQuoteRequest();
      const missingBefore = computeMissingCanonicalPaths(emptyQuote).length;

      const quote = { ...emptyQuote, vehicle: { ...emptyQuote.vehicle, brand: 'Yamaha' } };
      expect(computeMissingCanonicalPaths(quote).length).toBe(missingBefore - 1);
      expect(computeQuoteRequestCompleteness(quote)).toBeGreaterThan(computeQuoteRequestCompleteness(emptyQuote));
    });

    it('un dossier complet a 100 % de complétude et aucun champ manquant', () => {
      let quote = createEmptyQuoteRequest();
      for (const path of QUOTE_REQUEST_CANONICAL_PATHS) {
        quote = setQuoteRequestValue(quote, path, 'valeur');
      }
      expect(computeMissingCanonicalPaths(quote).length).toBe(0);
      expect(computeQuoteRequestCompleteness(quote)).toBe(100);
    });
  });
});
