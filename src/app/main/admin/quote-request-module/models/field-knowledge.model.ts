/**
 * État épistémique d'un champ du dossier.
 *
 * Cette enum est la pièce maîtresse de la gestion des informations inconnues.
 *
 * RÈGLE ABSOLUE : ne jamais interpréter UNKNOWN ou DECLARED_UNKNOWN comme une
 * valeur réelle. Le moteur de mapping et l'agent doivent lever une question au
 * courtier si `knowledge !== FieldKnowledge.KNOWN`.
 *
 * KNOWN              → la valeur est connue et fiable.
 * UNKNOWN            → la valeur n'a pas encore été renseignée (état initial).
 * DECLARED_UNKNOWN   → le courtier a explicitement indiqué ne pas connaître.
 * NEEDS_CONFIRMATION → la valeur existe mais doit être confirmée.
 */
export enum FieldKnowledge {
  KNOWN = 'KNOWN',
  UNKNOWN = 'UNKNOWN',
  DECLARED_UNKNOWN = 'DECLARED_UNKNOWN',
  NEEDS_CONFIRMATION = 'NEEDS_CONFIRMATION',
}

/**
 * Enveloppe générique pour tout champ dont la connaissance peut être partielle.
 *
 * Exemple d'usage :
 *   bonusMalus: KnowledgeField<number>
 *
 * État initial recommandé :
 *   { value: null, knowledge: FieldKnowledge.UNKNOWN }
 *
 * Quand le courtier déclare ne pas savoir :
 *   { value: null, knowledge: FieldKnowledge.DECLARED_UNKNOWN }
 *
 * Quand la valeur est saisie :
 *   { value: 0.85, knowledge: FieldKnowledge.KNOWN }
 */
export interface KnowledgeField<T> {
  value: T | null;
  knowledge: FieldKnowledge;
}

/** Fabrique — état initial "non renseigné". */
export function unknownField<T>(): KnowledgeField<T> {
  return { value: null, knowledge: FieldKnowledge.UNKNOWN };
}

/** Fabrique — courtier a explicitement déclaré ne pas savoir. */
export function declaredUnknownField<T>(): KnowledgeField<T> {
  return { value: null, knowledge: FieldKnowledge.DECLARED_UNKNOWN };
}

/** Fabrique — valeur connue. */
export function knownField<T>(value: T): KnowledgeField<T> {
  return { value, knowledge: FieldKnowledge.KNOWN };
}
