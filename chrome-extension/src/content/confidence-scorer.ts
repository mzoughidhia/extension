import { CanonicalQuoteRequest, getCanonicalValue } from '../models/canonical-data.model';
import { DetectedField } from '../models/detected-field.model';
import { FieldKnowledge } from '../models/field-knowledge.model';
import { FieldMapping, MappingStatus } from '../models/field-mapping.model';
import { FieldMapper } from './field-mapper';

export interface ConfidenceThresholds {
  /** >= seuil : remplissage automatique (HIGH confidence) */
  autoMatch: number;
  /** >= seuil et < autoMatch : demander confirmation (MEDIUM confidence) */
  needsConfirm: number;
}

/**
 * Seuils de confiance — calibrés selon les exigences métier :
 * >= 0.85 → MATCHED (remplissage auto)
 * >= 0.60 → NEEDS_CONFIRMATION (demander l'avis du courtier)
 * <  0.60 → UNMATCHED (ignorer silencieusement)
 */
export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoMatch: 0.85,
  needsConfirm: 0.60,
};

export class ConfidenceScorer {
  /**
   * Évalue un champ détecté et produit le `FieldMapping` enrichi avec valeur canonique résolue.
   *
   * @param field         Champ détecté dans le DOM
   * @param quoteData     Données canoniques disponibles (optionnel)
   * @param fieldIndex    Position du champ dans la liste (pour désambiguïsation)
   * @param thresholds    Seuils personnalisables (par défaut 0.85 / 0.60)
   */
  static scoreField(
    field: DetectedField,
    quoteData?: CanonicalQuoteRequest,
    fieldIndex?: number,
    thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS
  ): FieldMapping {
    const candidates = FieldMapper.findCandidates(field, fieldIndex);

    if (candidates.length === 0) {
      return {
        field,
        canonicalPath: null,
        confidence: 0.0,
        reasons: ['Aucune correspondance dans le dictionnaire canonique'],
        status: MappingStatus.UNMATCHED,
      };
    }

    const best = candidates[0];

    // Vérification : si les deux premiers candidats sont très proches (< 0.05 d'écart)
    // et appartiennent à des domaines différents, descendre à NEEDS_CONFIRMATION
    let status: MappingStatus;
    if (candidates.length >= 2 && (best.confidence - candidates[1].confidence) < 0.05) {
      // Ambiguïté forte entre deux candidats
      if (best.confidence >= thresholds.autoMatch) {
        status = MappingStatus.NEEDS_CONFIRMATION; // Dégrader par prudence
      } else if (best.confidence >= thresholds.needsConfirm) {
        status = MappingStatus.NEEDS_CONFIRMATION;
      } else {
        status = MappingStatus.UNMATCHED;
      }
      best.reasons.push(`⚠ Ambiguïté avec "${candidates[1].canonicalPath}" (Δ ${Math.round((best.confidence - candidates[1].confidence) * 100)}%)`);
    } else {
      if (best.confidence >= thresholds.autoMatch) {
        status = MappingStatus.MATCHED;
      } else if (best.confidence >= thresholds.needsConfirm) {
        status = MappingStatus.NEEDS_CONFIRMATION;
      } else {
        status = MappingStatus.UNMATCHED;
      }
    }

    // Résolution de la valeur canonique avec protection épistémique
    let resolvedValue: unknown = undefined;
    let epistemicBlockReason: string | undefined = undefined;

    if (quoteData && best.canonicalPath) {
      const access = getCanonicalValue(quoteData, best.canonicalPath);

      if (access.knowledge === FieldKnowledge.DECLARED_UNKNOWN) {
        epistemicBlockReason = 'Information explicitement déclarée inconnue — ne pas remplir.';
      } else if (
        access.knowledge === FieldKnowledge.NEEDS_CONFIRMATION
      ) {
        epistemicBlockReason = 'Information marquée "à confirmer" — validation manuelle requise.';
        // On expose la valeur potentielle pour que l'utilisateur puisse confirmer
        resolvedValue = access.value;
        if (status === MappingStatus.MATCHED) {
          status = MappingStatus.NEEDS_CONFIRMATION;
        }
      } else if (access.knowledge === FieldKnowledge.UNKNOWN || access.value === null || access.value === undefined) {
        epistemicBlockReason = 'Information non renseignée dans le dossier.';
      } else if (access.knowledge === FieldKnowledge.KNOWN) {
        // RÈGLE ABSOLUE : 0 KNOWN est une vraie valeur (ex: 0 sinistre = connu)
        resolvedValue = access.value;
      }
    }

    return {
      field,
      canonicalPath: best.canonicalPath,
      confidence: best.confidence,
      reasons: best.reasons,
      status,
      resolvedValue,
      epistemicBlockReason,
      source: 'local-fallback',
    };
  }

  /**
   * Évalue un mapping validé provenant de l'IA (Gemini) et applique la sécurité épistémique
   * ainsi que les seuils de confiance standards.
   */
  static buildMappingFromValidated(
    field: DetectedField,
    canonicalPath: import('../models/canonical-paths').CanonicalPath | null,
    confidence: number,
    reason: string,
    quoteData?: CanonicalQuoteRequest,
    thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS,
    source: 'gemini' | 'local-fallback' | 'form-memory' | 'user-answer' = 'gemini'
  ): FieldMapping {
    const clampedConfidence = Math.max(0, Math.min(1.0, confidence));
    let status: MappingStatus = MappingStatus.UNMATCHED;

    if (canonicalPath) {
      if (clampedConfidence >= thresholds.autoMatch) {
        status = MappingStatus.MATCHED;
      } else if (clampedConfidence >= thresholds.needsConfirm) {
        status = MappingStatus.NEEDS_CONFIRMATION;
      } else {
        status = MappingStatus.UNMATCHED;
      }
    } else {
      status = MappingStatus.UNMATCHED;
    }

    let resolvedValue: unknown = undefined;
    let epistemicBlockReason: string | undefined = undefined;

    if (quoteData && canonicalPath) {
      const access = getCanonicalValue(quoteData, canonicalPath);

      if (access.knowledge === FieldKnowledge.DECLARED_UNKNOWN) {
        epistemicBlockReason = 'Information explicitement déclarée inconnue — ne pas remplir.';
      } else if (access.knowledge === FieldKnowledge.NEEDS_CONFIRMATION) {
        epistemicBlockReason = 'Information marquée "à confirmer" — validation manuelle requise.';
        resolvedValue = access.value;
        if (status === MappingStatus.MATCHED) {
          status = MappingStatus.NEEDS_CONFIRMATION;
        }
      } else if (access.knowledge === FieldKnowledge.UNKNOWN || access.value === null || access.value === undefined) {
        epistemicBlockReason = 'Information non renseignée dans le dossier.';
      } else if (access.knowledge === FieldKnowledge.KNOWN) {
        resolvedValue = access.value;
      }
    }

    return {
      field,
      canonicalPath,
      confidence: clampedConfidence,
      reasons: [reason],
      status,
      resolvedValue,
      epistemicBlockReason,
      source,
    };
  }

  /**
   * Score un tableau de champs en transmettant l'index (pour désambiguïsation positionnelle).
   */
  static scoreFields(
    fields: DetectedField[],
    quoteData?: CanonicalQuoteRequest,
    thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS
  ): FieldMapping[] {
    return fields.map((field, index) => this.scoreField(field, quoteData, index, thresholds));
  }
}
