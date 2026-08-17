/**
 * État épistémique d'un champ canonique.
 *
 * KNOWN              → La valeur est connue et fiable.
 * UNKNOWN            → L'information est manquante (ne jamais remplir).
 * DECLARED_UNKNOWN   → Le courtier a explicitement déclaré ne pas savoir (ne jamais remplir).
 * NEEDS_CONFIRMATION → La valeur est incertaine ou nécessite validation.
 */
export enum FieldKnowledge {
  KNOWN = 'KNOWN',
  UNKNOWN = 'UNKNOWN',
  DECLARED_UNKNOWN = 'DECLARED_UNKNOWN',
  NEEDS_CONFIRMATION = 'NEEDS_CONFIRMATION',
}

export interface KnowledgeField<T> {
  value: T | null;
  knowledge: FieldKnowledge;
}

export function unknownField<T>(): KnowledgeField<T> {
  return { value: null, knowledge: FieldKnowledge.UNKNOWN };
}

export function declaredUnknownField<T>(): KnowledgeField<T> {
  return { value: null, knowledge: FieldKnowledge.DECLARED_UNKNOWN };
}

export function knownField<T>(value: T): KnowledgeField<T> {
  return { value, knowledge: FieldKnowledge.KNOWN };
}

/**
 * Détermine si une valeur canonique est sûre pour le remplissage.
 *
 * RÈGLE ABSOLUE : Si l'état n'est pas KNOWN, le champ ne doit JAMAIS être rempli.
 */
export function isFillable<T>(field: KnowledgeField<T> | T | null | undefined): boolean {
  if (field === null || field === undefined) {
    return false;
  }
  if (typeof field === 'object' && 'knowledge' in field) {
    const kf = field as KnowledgeField<T>;
    return kf.knowledge === FieldKnowledge.KNOWN && kf.value !== null && kf.value !== undefined;
  }
  return true;
}

/**
 * Extrait la valeur brute sécurisée (ou null si inconnu).
 */
export function extractValue<T>(field: KnowledgeField<T> | T | null | undefined): T | null {
  if (field === null || field === undefined) {
    return null;
  }
  if (typeof field === 'object' && 'knowledge' in field) {
    const kf = field as KnowledgeField<T>;
    return kf.knowledge === FieldKnowledge.KNOWN ? kf.value : null;
  }
  return field as T;
}
