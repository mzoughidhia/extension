import { DetectedField } from '../models/detected-field.model';
import { FormMemoryFieldStructureEntry } from '../models/form-memory.model';
import { normalizeText } from '../shared/utils/text.utils';

/**
 * Calcule l'empreinte structurelle d'un formulaire, de façon déterministe.
 *
 * L'empreinte ne dépend QUE de caractéristiques structurelles utiles au mapping :
 * id, name, label, type, placeholder, section, options, ordre des champs.
 *
 * Elle exclut délibérément : la valeur actuelle des champs, les tokens/cookies,
 * les données personnelles, et tout contenu DOM non pertinent.
 */

/** Hash déterministe FNV-1a 32 bits, encodé en hexadécimal. */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Construit la charge utile structurelle d'un champ (sans valeur ni donnée sensible).
 */
function buildFieldSignaturePayload(field: DetectedField): string {
  const optionsSignature = (field.options || [])
    .map((option) => `${normalizeText(option.text)}:${normalizeText(option.value)}`)
    .join('|');

  return JSON.stringify({
    id: field.id || '',
    name: field.name || '',
    label: normalizeText(field.label),
    type: field.type || '',
    placeholder: normalizeText(field.placeholder),
    section: normalizeText(field.sectionName),
    options: optionsSignature,
  });
}

/**
 * Clé structurelle stable d'un champ, combinant sa position et sa signature.
 * Permet de retrouver le mapping mémorisé d'un champ précis, y compris lorsque
 * l'identifiant de session (elementId) change d'une analyse à l'autre.
 */
export function computeFieldKey(field: DetectedField, order: number): string {
  return `${order}_${fnv1aHash(buildFieldSignaturePayload(field))}`;
}

/**
 * Empreinte globale et déterministe du formulaire.
 *
 * Deux formulaires structurellement identiques (mêmes champs, mêmes types,
 * mêmes labels, même ordre) produisent la même empreinte.
 * Toute différence structurelle (champ ajouté/retiré, label modifié, type
 * modifié, option modifiée, ordre modifié) produit une empreinte différente.
 */
export function computeFormFingerprint(fields: DetectedField[]): string {
  const combined = fields
    .map((field, index) => `${index}:${buildFieldSignaturePayload(field)}`)
    .join('§');
  return fnv1aHash(combined);
}

/**
 * Construit la description structurelle du formulaire (sans valeur, sans donnée
 * personnelle) destinée à être stockée dans FormMemory.
 */
export function buildFieldStructure(fields: DetectedField[]): FormMemoryFieldStructureEntry[] {
  return fields.map((field, index) => ({
    fieldKey: computeFieldKey(field, index),
    name: field.name,
    label: field.label,
    type: field.type,
    section: field.sectionName,
    order: index,
  }));
}

/**
 * Construit la clé de mémoire (memoryKey) associant une origine (site) à une
 * empreinte de formulaire. Réutilisable par n'importe quel client.
 */
export function buildFormMemoryKey(origin: string, formFingerprint: string): string {
  return `${origin}::${formFingerprint}`;
}
