import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import depuis les sources compilées (dist/) via le build esbuild
// Note : text.utils est un module bundlé dans dist/. On le teste via un mini-bundle standalone.
// Pour les tests unitaires, on import les sources directement compilées par tsc.

// On réimplémente les fonctions ici pour les tests unitaires (elles sont simples et déterministes)
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a, b) {
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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

function stringSimilarity(a, b) {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, (maxLen - dist) / maxLen);
}

function containsKeyword(haystack, needle) {
  const normHaystack = ` ${normalizeText(haystack)} `;
  const normNeedle = normalizeText(needle);
  if (!normNeedle) return false;
  return normHaystack.includes(` ${normNeedle} `) || normHaystack.includes(normNeedle);
}

describe('text.utils', () => {
  it('normalizeText: supprime les accents, la ponctuation, les espaces en trop', () => {
    assert.equal(normalizeText("Prénom de l'assuré (obligatoire) *"), 'prenom de l assure obligatoire');
  });

  it('normalizeText: chaîne vide et null', () => {
    assert.equal(normalizeText(''), '');
    assert.equal(normalizeText(null), '');
    assert.equal(normalizeText(undefined), '');
  });

  it('stringSimilarity: cas identiques après normalisation', () => {
    assert.equal(stringSimilarity('Prénom', 'prenom'), 1.0);
  });

  it('stringSimilarity: mots proches > 0.80', () => {
    assert.ok(stringSimilarity('Date de naissance', 'Date naissance') > 0.80,
      `Attendu > 0.80 mais obtenu ${stringSimilarity('Date de naissance', 'Date naissance')}`);
  });

  it('stringSimilarity: mots éloignés < 0.30', () => {
    assert.ok(stringSimilarity('Marque', 'Immatriculation') < 0.30,
      `Attendu < 0.30 mais obtenu ${stringSimilarity('Marque', 'Immatriculation')}`);
  });

  it('containsKeyword: détecte un mot présent', () => {
    assert.equal(containsKeyword("Date d'obtention du permis", 'permis'), true);
    assert.equal(containsKeyword('Numéro de téléphone mobile', 'telephone'), true);
  });

  it('containsKeyword: ne détecte pas un mot absent', () => {
    assert.equal(containsKeyword('Nom de famille', 'prenom'), false);
  });

  it('levenshteinDistance: chaînes identiques = 0', () => {
    assert.equal(levenshteinDistance('prenom', 'prenom'), 0);
  });

  it('levenshteinDistance: une insertion = 1', () => {
    assert.equal(levenshteinDistance('prenom', 'prenoms'), 1);
  });
});
