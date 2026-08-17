/**
 * Identité logique d'une session de devis : site (origin) + produit.
 *
 * Ne dépend PAS uniquement de l'URL complète (les extranets SPA gardent
 * souvent la même URL entre plusieurs étapes) ni d'une donnée client.
 */
export interface SessionContext {
  origin: string;
  product: string;
}

/** Paramètres de requête généralement utilisés par les extranets pour désigner le produit. */
const PRODUCT_QUERY_KEYS = ['name', 'product', 'produit', 'oid'];

const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripDiacritics(value: string): string {
  let result = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) || 0;
    if (code >= COMBINING_DIACRITICS_START && code <= COMBINING_DIACRITICS_END) {
      continue;
    }
    result += ch;
  }
  return result;
}

function normalizeProductToken(value: string): string {
  const decomposed = value.toLowerCase().normalize('NFD');
  const withoutDiacritics = stripDiacritics(decomposed);
  const token = withoutDiacritics.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return token || 'default';
}

/**
 * Dérive une identité logique de session à partir d'une URL, réutilisable
 * telle quelle depuis le Content Script (window.location.href) ou le Side
 * Panel (tab.url), sans dépendre du DOM.
 */
export function identifySessionContext(rawUrl: string): SessionContext {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { origin: 'unknown', product: 'default' };
  }

  const origin = url.hostname || 'unknown';

  for (const key of PRODUCT_QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value) {
      return { origin, product: normalizeProductToken(value) };
    }
  }

  const pathSegment = url.pathname.split('/').filter(Boolean)[0];
  if (pathSegment) {
    return { origin, product: normalizeProductToken(pathSegment) };
  }

  return { origin, product: 'default' };
}

/** Clé de session stable : identité du parcours, jamais une donnée client. */
export function buildSessionKey(context: SessionContext): string {
  return `${context.origin}::${context.product}`;
}
