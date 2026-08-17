import { KnowledgeField, unknownField } from './field-knowledge.model';

/**
 * Modèle canonique de l'historique d'assurance.
 *
 * Les champs numériques susceptibles d'être "inconnus" sont enveloppés dans
 * `KnowledgeField<T>` afin de distinguer explicitement :
 *   - 0 sinistre   (KNOWN, value: 0)
 *   - pas de réponse (UNKNOWN ou DECLARED_UNKNOWN, value: null)
 *
 * RÈGLE ABSOLUE : ne jamais initialiser ces champs à 0 si l'information
 * est absente. Utiliser `unknownField()`.
 */
export interface InsuranceHistory {
  /** Compagnie précédente */
  previousInsurer: string | null;
  /** Date de début du contrat précédent (ISO 8601) */
  previousContractStartDate: string | null;
  /** Date de fin du contrat précédent (ISO 8601) */
  previousContractEndDate: string | null;

  /**
   * Ancienneté (en années).
   * KnowledgeField car le courtier peut ne pas connaître la valeur exacte.
   */
  seniority: KnowledgeField<number>;

  /**
   * Coefficient bonus/malus.
   * KnowledgeField — ne pas supposer 1.00 si absent.
   */
  bonusMalus: KnowledgeField<number>;

  /**
   * Nombre total de sinistres déclarés.
   * KnowledgeField — 0 sinistre ≠ sinistres inconnus.
   */
  claimsCount: KnowledgeField<number>;

  /**
   * Nombre de sinistres responsables.
   * KnowledgeField.
   */
  responsibleClaimsCount: KnowledgeField<number>;

  /**
   * Nombre de sinistres non responsables.
   * KnowledgeField.
   */
  nonResponsibleClaimsCount: KnowledgeField<number>;

  /** Le contrat précédent a-t-il été résilié ? */
  wasTerminated: boolean;
  /** La résiliation a-t-elle été initiée par la compagnie ? */
  terminatedByInsurer: boolean;
  /** Motif de résiliation */
  terminationReason: string | null;
  /** Date de résiliation (ISO 8601) */
  terminationDate: string | null;
}

/** Valeur initiale vide — tous les KnowledgeField sont UNKNOWN. */
export function createEmptyInsuranceHistory(): InsuranceHistory {
  return {
    previousInsurer: null,
    previousContractStartDate: null,
    previousContractEndDate: null,
    seniority: unknownField<number>(),
    bonusMalus: unknownField<number>(),
    claimsCount: unknownField<number>(),
    responsibleClaimsCount: unknownField<number>(),
    nonResponsibleClaimsCount: unknownField<number>(),
    wasTerminated: false,
    terminatedByInsurer: false,
    terminationReason: null,
    terminationDate: null,
  };
}
