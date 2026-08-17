/**
 * Utilitaires pures de normalisation et comparaison de texte.
 */

/**
 * Supprime les accents, la ponctuation et met en minuscules.
 * Ex: "Prénom de l'assuré (obligatoire) *" -> "prenom de l assure obligatoire"
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
    .replace(/[^a-z0-9\s]/g, ' ')   // Remplace caractères spéciaux par espaces
    .replace(/\s+/g, ' ')           // Compresse les espaces multiples
    .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // suppression
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Calcule un score de similarité de 0.00 à 1.00 basé sur Levenshtein.
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Vérifie si l'une des chaînes contient l'autre comme sous-chaîne ou mot entier.
 */
export function containsKeyword(haystack: string, needle: string): boolean {
  const normHaystack = ` ${normalizeText(haystack)} `;
  const normNeedle = normalizeText(needle);
  if (!normNeedle) return false;
  return normHaystack.includes(` ${normNeedle} `) || normHaystack.includes(normNeedle);
}
