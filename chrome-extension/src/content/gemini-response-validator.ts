import { CANONICAL_PATHS, CanonicalPath, isValidCanonicalPath } from '../models/canonical-paths';
import { DetectedField } from '../models/detected-field.model';
import { GeminiFieldMapping, GeminiMappingResponse } from '../models/gemini-schema.model';

export interface ValidatedMappingItem {
  fieldId: string;
  detectedField: DetectedField;
  canonicalPath: CanonicalPath | null;
  confidence: number;
  reason: string;
  suggestedValue?: unknown;
  isValid: boolean;
  validationError?: string;
}

export interface ValidatedGeminiResult {
  validMappings: ValidatedMappingItem[];
  rejectedMappings: ValidatedMappingItem[];
  unmappedFields: DetectedField[];
  model?: string;
  summary?: string;
}

export class GeminiResponseValidator {
  /**
   * Valide rigoureusement la réponse renvoyée par Gemini contre les champs DOM réels
   * et le catalogue fermé de 32 chemins canoniques.
   *
   * RÈGLE : Ne jamais faire confiance aveuglément à Gemini (source non fiable).
   */
  static validate(
    response: unknown,
    detectedFields: DetectedField[]
  ): ValidatedGeminiResult {
    const validMappings: ValidatedMappingItem[] = [];
    const rejectedMappings: ValidatedMappingItem[] = [];

    // Créer un dictionnaire des champs détectés indexés par elementId
    const fieldMap = new Map<string, DetectedField>();
    for (const field of detectedFields) {
      fieldMap.set(field.elementId, field);
    }

    // Ensemble pour suivre les champs qui ont reçu une réponse
    const processedFieldIds = new Set<string>();

    if (!response || typeof response !== 'object') {
      return {
        validMappings: [],
        rejectedMappings: [],
        unmappedFields: detectedFields,
        summary: 'Réponse Gemini invalide : contenu non-objet.',
      };
    }

    const typedResponse = response as Partial<GeminiMappingResponse>;
    const rawMappings = Array.isArray(typedResponse.mappings) ? typedResponse.mappings : [];

    for (const item of rawMappings) {
      if (!item || typeof item !== 'object') continue;

      const fieldId = String((item as any).fieldId || '');
      const detectedField = fieldMap.get(fieldId);

      // 1. Validation de l'existence du champ dans le DOM
      if (!detectedField) {
        rejectedMappings.push({
          fieldId,
          detectedField: {
            elementId: fieldId,
            selector: '',
            tagName: 'input',
            type: 'text',
            name: null,
            id: null,
            label: null,
            placeholder: null,
            ariaLabel: null,
            surroundingText: null,
            sectionName: null,
            isInteractable: false,
          },
          canonicalPath: null,
          confidence: 0,
          reason: `Champ "${fieldId}" inexistant dans le formulaire analysé.`,
          isValid: false,
          validationError: 'FIELD_NOT_FOUND',
        });
        continue;
      }

      processedFieldIds.add(fieldId);

      let canonicalPath = (item as any).canonicalPath;
      let confidence = typeof (item as any).confidence === 'number' ? (item as any).confidence : 0;
      confidence = Math.max(0, Math.min(1.0, confidence));
      const reason = String((item as any).reason || 'Correspondance identifiée par Gemini');
      const suggestedValue = (item as any).suggestedValue;

      // 2. Validation contre le catalogue fermé (détection d'hallucinations)
      if (canonicalPath !== null && canonicalPath !== undefined && canonicalPath !== '') {
        const pathStr = String(canonicalPath);
        if (!isValidCanonicalPath(pathStr)) {
          // Hallucination détectée : rejet du mapping
          rejectedMappings.push({
            fieldId,
            detectedField,
            canonicalPath: null,
            confidence: 0,
            reason: `Chemin non valide "${pathStr}" rejeté (hors catalogue fermé).`,
            isValid: false,
            validationError: 'HALLUCINATED_PATH',
          });
          continue;
        }
        canonicalPath = pathStr as CanonicalPath;
      } else {
        canonicalPath = null;
      }

      // Mapping valide
      validMappings.push({
        fieldId,
        detectedField,
        canonicalPath,
        confidence,
        reason,
        suggestedValue,
        isValid: true,
      });
    }

    // Champs détectés dans le DOM mais absents de la réponse Gemini
    const unmappedFields: DetectedField[] = [];
    for (const field of detectedFields) {
      if (!processedFieldIds.has(field.elementId)) {
        unmappedFields.push(field);
      }
    }

    return {
      validMappings,
      rejectedMappings,
      unmappedFields,
      model: typedResponse.model,
      summary: typedResponse.summary,
    };
  }
}
