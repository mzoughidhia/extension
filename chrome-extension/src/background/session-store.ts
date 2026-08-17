import { QuoteSession } from '../models/quote-session.model';

const STORAGE_KEY_QUOTE_SESSIONS = 'form_agent_quote_sessions';

/** Une session sans activité depuis 7 jours n'est plus proposée en reprise. */
export const QUOTE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type QuoteSessionTable = Record<string, QuoteSession>;

function readTable(): Promise<QuoteSessionTable> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_QUOTE_SESSIONS], (result) => {
      resolve((result[STORAGE_KEY_QUOTE_SESSIONS] as QuoteSessionTable) || {});
    });
  });
}

function writeTable(table: QuoteSessionTable): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_QUOTE_SESSIONS]: table }, () => resolve());
  });
}

export function isQuoteSessionStale(
  session: QuoteSession,
  ttlMs: number = QUOTE_SESSION_TTL_MS,
  now: number = Date.now()
): boolean {
  const lastVisited = Date.parse(session.lastVisitedAt);
  if (Number.isNaN(lastVisited)) return true;
  return now - lastVisited > ttlMs;
}

/**
 * Stockage exclusif des sessions de devis (progression, réponses du
 * courtier), complètement séparé de `form_memory` (structure des
 * formulaires) et de `quoteData`/`gemini_api_key`.
 *
 * Responsable uniquement de : get / set / delete / clear / find.
 * Seul le Service Worker doit manipuler cette classe.
 */
export class SessionStore {
  static async get(sessionId: string): Promise<QuoteSession | null> {
    const table = await readTable();
    return table[sessionId] || null;
  }

  static async set(session: QuoteSession): Promise<void> {
    const table = await readTable();
    table[session.sessionId] = session;
    await writeTable(table);
  }

  static async delete(sessionId: string): Promise<void> {
    const table = await readTable();
    delete table[sessionId];
    await writeTable(table);
  }

  static async clear(): Promise<void> {
    await writeTable({});
  }

  static async find(predicate: (session: QuoteSession) => boolean): Promise<QuoteSession[]> {
    const table = await readTable();
    return Object.values(table).filter(predicate);
  }

  /**
   * Sessions actives (non expirées) pour une identité de parcours donnée
   * (origin::product), triées de la plus récente à la plus ancienne.
   */
  static async findBySessionKey(sessionKey: string): Promise<QuoteSession[]> {
    const sessions = await SessionStore.find(
      (s) => s.sessionKey === sessionKey && s.status === 'in_progress' && !isQuoteSessionStale(s)
    );
    return sessions.sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt));
  }

  static async touch(sessionId: string): Promise<void> {
    const table = await readTable();
    const session = table[sessionId];
    if (session) {
      session.lastVisitedAt = new Date().toISOString();
      await writeTable(table);
    }
  }
}
