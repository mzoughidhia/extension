import { FORM_MEMORY_TTL_MS, FORM_MEMORY_VERSION, FormMemory } from '../models/form-memory.model';

const STORAGE_KEY_FORM_MEMORY = 'form_memory';

type FormMemoryTable = Record<string, FormMemory>;

function readTable(): Promise<FormMemoryTable> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_FORM_MEMORY], (result) => {
      resolve((result[STORAGE_KEY_FORM_MEMORY] as FormMemoryTable) || {});
    });
  });
}

function writeTable(table: FormMemoryTable): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_FORM_MEMORY]: table }, () => resolve());
  });
}

/**
 * Détermine si une mémoire de formulaire est expirée (par défaut : 30 jours
 * sans réutilisation).
 */
export function isFormMemoryExpired(
  memory: FormMemory,
  ttlMs: number = FORM_MEMORY_TTL_MS,
  now: number = Date.now()
): boolean {
  const lastUsed = Date.parse(memory.lastUsedAt);
  if (Number.isNaN(lastUsed)) return true;
  return now - lastUsed > ttlMs;
}

/**
 * Stockage exclusif de la mémoire des formulaires (structure + mapping),
 * complètement séparé de `quoteData` (données client) et `gemini_api_key`.
 *
 * Responsable uniquement de : get / set / delete / clear / find.
 * Seul le Service Worker doit manipuler cette classe ; le Content Script
 * passe systématiquement par les messages runtime dédiés.
 */
export class FormMemoryStore {
  static async get(memoryKey: string): Promise<FormMemory | null> {
    const table = await readTable();
    const memory = table[memoryKey];
    if (!memory) return null;

    // Invalidation : version de schéma différente ou mémoire corrompue/expirée
    if (memory.version !== FORM_MEMORY_VERSION) return null;
    if (!memory.formFingerprint || !Array.isArray(memory.validatedMappings)) return null;
    if (isFormMemoryExpired(memory)) return null;

    return memory;
  }

  static async set(memory: FormMemory): Promise<void> {
    const table = await readTable();
    table[memory.memoryKey] = memory;
    await writeTable(table);
  }

  static async delete(memoryKey: string): Promise<void> {
    const table = await readTable();
    delete table[memoryKey];
    await writeTable(table);
  }

  static async clear(): Promise<void> {
    await writeTable({});
  }

  static async find(predicate: (memory: FormMemory) => boolean): Promise<FormMemory[]> {
    const table = await readTable();
    return Object.values(table).filter(predicate);
  }

  /** Met à jour la date de dernière utilisation sans modifier le mapping. */
  static async touch(memoryKey: string): Promise<void> {
    const table = await readTable();
    const memory = table[memoryKey];
    if (memory) {
      memory.lastUsedAt = new Date().toISOString();
      await writeTable(table);
    }
  }
}
