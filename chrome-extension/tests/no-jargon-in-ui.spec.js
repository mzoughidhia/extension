import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BANNED_TERMS = [
  'gemini mapping',
  'canonicalpath',
  'confidence',
  'matched',
  'needs_confirmation',
  'unmatched',
  'fieldknowledge',
  'fingerprint',
  'formmemory',
  'cache hit',
  'cache miss',
  'fallback local',
  'automation run',
  'épistémique',
  'epistemique',
  'validation canonique',
  'json',
];

/**
 * Extrait uniquement le contenu réellement affiché au courtier : les appels
 * à addAssistantMessage()/addUserMessage() et les blocs innerHTML (gabarits
 * de bulles de conversation). Ignore volontairement les identifiants internes
 * (ids DOM, types de message runtime, noms de propriétés) qui ne sont jamais
 * rendus à l'écran.
 */
function extractStringLiterals(sourceCode) {
  const matches = [];

  const callRegex = /add(?:Assistant|User)Message\(([\s\S]*?)\);/g;
  for (const m of sourceCode.matchAll(callRegex)) matches.push(m[1]);

  const innerHtmlRegex = /\.innerHTML\s*=\s*`([\s\S]*?)`;/g;
  for (const m of sourceCode.matchAll(innerHtmlRegex)) matches.push(m[1]);

  return matches;
}

function findJargon(text) {
  const lower = text.toLowerCase();
  return BANNED_TERMS.filter((term) => lower.includes(term));
}

describe("Absence de jargon technique dans l'interface réelle (Étape 3, fichiers src/ réels)", () => {
  it('1. sidepanel.html (markup réel) ne contient aucun terme technique', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.html'), 'utf8');
    const found = findJargon(html);
    assert.deepEqual(found, [], `Termes techniques trouvés dans sidepanel.html : ${found.join(', ')}`);
  });

  it('2. sidepanel.html ne contient jamais de clé API en clair', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.html'), 'utf8');
    assert.ok(!/AIza[0-9A-Za-z_-]{10,}/.test(html));
  });

  it("3. sidepanel.ts (code réel) : aucune chaîne littérale destinée à l'utilisateur ne contient de jargon", () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.ts'), 'utf8');
    const literals = extractStringLiterals(source);

    const offenders = [];
    for (const literal of literals) {
      const found = findJargon(literal);
      if (found.length > 0) {
        offenders.push({ literal, found });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Chaînes contenant du jargon technique : ${JSON.stringify(offenders)}`
    );
  });

  it("4. sidepanel.ts n'affiche jamais le mot \"Erreur\" accolé à un code d'erreur brut (GeminiError, HTTP 4xx/5xx)", () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.ts'), 'utf8');
    assert.ok(!/GeminiError/.test(source));
    assert.ok(!/HTTP\s*\d{3}/.test(source));
  });

  it("5. La configuration de l'intelligence (Gemini) est reléguée dans une zone secondaire repliée (⚙️ Paramètres)", () => {
    const html = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.html'), 'utf8');
    assert.ok(html.includes('Paramètres'));
    assert.ok(/<details class="settings-accordion">[\s\S]*Intelligence[\s\S]*<\/details>/.test(html));
  });

  it('6. Le Side Panel reste utilisable dans une largeur étroite (min-width déclaré entre 300 et 500px)', () => {
    const css = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.css'), 'utf8');
    assert.ok(/min-width:\s*300px/.test(css));
    assert.ok(/max-width:\s*500px/.test(css));
  });

  it('7. Les boutons de choix peuvent passer sur plusieurs lignes (flex-wrap) pour ne jamais déborder', () => {
    const css = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.css'), 'utf8');
    assert.ok(/\.question-choices\s*\{[^}]*flex-wrap:\s*wrap/.test(css));
  });

  it("8. Message initial simple : accueil + une seule action, pas de long texte explicatif", () => {
    const html = fs.readFileSync(path.join(projectRoot, 'src/sidepanel/sidepanel.html'), 'utf8');
    assert.ok(html.includes('Bonjour'));
    assert.ok(html.includes('Analyser le formulaire'));

    // Le message d'accueil (dans <section class="conversation-feed">...) doit rester court :
    // pas plus de 2 paragraphes de bienvenue avant l'action.
    const feedMatch = html.match(/id="conversation-feed"[^>]*>([\s\S]*?)<\/section>/);
    assert.ok(feedMatch);
    const paragraphCount = (feedMatch[1].match(/<p>/g) || []).length;
    assert.ok(paragraphCount <= 2, `Message d'accueil trop long (${paragraphCount} paragraphes)`);
  });
});
