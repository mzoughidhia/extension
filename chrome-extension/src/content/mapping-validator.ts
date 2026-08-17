import { FieldMapping, MappingStatus } from '../models/field-mapping.model';

export class MappingValidator {
  /**
   * Vérifie si un mapping est prêt et autorisé pour le remplissage automatique.
   */
  static isEligibleForAutoFill(mapping: FieldMapping): boolean {
    // 1. Statut autorisé (MATCHED ou manuellement CONFIRMED)
    if (mapping.status !== MappingStatus.MATCHED && mapping.status !== MappingStatus.CONFIRMED) {
      return false;
    }

    // 2. Blocage épistémique (UNKNOWN / DECLARED_UNKNOWN)
    if (mapping.epistemicBlockReason) {
      return false;
    }

    // 3. Présence d'une valeur résolue exploitable
    if (mapping.resolvedValue === undefined || mapping.resolvedValue === null) {
      return false;
    }

    // 4. Champ interactif dans le DOM
    if (!mapping.field.isInteractable) {
      return false;
    }

    return true;
  }

  /**
   * Filtre la liste des mappings pour ne conserver que ceux prêts pour l'injection.
   */
  static getFillableMappings(mappings: FieldMapping[]): FieldMapping[] {
    return mappings.filter((m) => this.isEligibleForAutoFill(m));
  }
}
