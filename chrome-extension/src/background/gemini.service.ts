import { CanonicalPath, CANONICAL_PATHS, isValidCanonicalPath } from '../models/canonical-paths';
import {
  GeminiDocumentExtractedField,
  GeminiDocumentExtractionRequest,
  GeminiDocumentExtractionResponse,
  GeminiFieldMapping,
  GeminiMappingRequest,
  GeminiMappingResponse,
} from '../models/gemini-schema.model';

export type GeminiErrorCode =
  | 'API_KEY_MISSING'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'PARSE_ERROR';

export class GeminiError extends Error {
  constructor(
    public readonly code: GeminiErrorCode,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface GeminiServiceConfig {
  /** Modèle Gemini cible (ex: 'gemini-2.5-flash', 'gemini-2.0-flash') */
  model: string;
  /** Timeout en millisecondes (par défaut 15000ms) */
  timeoutMs: number;
  /** Version de l'API Google Gemini (par défaut 'v1beta') */
  apiVersion: string;
}

export const DEFAULT_GEMINI_CONFIG: GeminiServiceConfig = {
  model: 'gemini-2.5-flash',
  timeoutMs: 15000,
  apiVersion: 'v1beta',
};

const STORAGE_KEY_GEMINI_API_KEY = 'gemini_api_key';

/**
 * Récupère la clé API Gemini stockée localement dans l'extension.
 */
export async function getStoredApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY_GEMINI_API_KEY], (result) => {
        resolve(result[STORAGE_KEY_GEMINI_API_KEY] || null);
      });
    } else {
      resolve(null);
    }
  });
}

/**
 * Enregistre la clé API Gemini dans le stockage local de l'extension.
 */
export async function setStoredApiKey(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY_GEMINI_API_KEY]: apiKey.trim() }, () => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Supprime la clé API Gemini du stockage local.
 */
export async function clearStoredApiKey(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove([STORAGE_KEY_GEMINI_API_KEY], () => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export class GeminiService {
  private config: GeminiServiceConfig;

  constructor(config: Partial<GeminiServiceConfig> = {}) {
    this.config = { ...DEFAULT_GEMINI_CONFIG, ...config };
  }

  /**
   * Construit le prompt système d'instructions pour Gemini.
   */
  private buildSystemInstruction(): string {
    return [
      "Tu es un agent IA spécialisé dans l'analyse sémantique et le mapping de formulaires CRM et extranets d'assurance automobile.",
      'Ton rôle est de faire correspondre chaque champ du formulaire fourni avec un champ de données canoniques disponibles.',
      '',
      'RÈGLES STRICTES ET NON NÉGOCIABLES :',
      '1. Pour chaque champ du formulaire, détermine son équivalent canonique parmi les chemins autorisés fournis.',
      '2. Tu ne dois JAMAIS inventer un chemin canonique qui ne figure pas dans la liste des chemins autorisés. Si aucun chemin ne correspond ou si tu as un doute fort, indique canonicalPath: null.',
      '3. Si un champ du formulaire est ambigu (ex: "Nom" dans une section sans titre clair), analyse le contexte global et les autres champs pour désambiguïser (client vs conducteur).',
      '4. Indique un score de confiance entre 0.00 et 1.00 pour chaque mapping :',
      '   - 0.85 à 1.00 : Correspondance certaine et évidente.',
      '   - 0.60 à 0.84 : Correspondance probable nécessitant confirmation humaine.',
      '   - Moins de 0.60 : Correspondance incertaine ou champ inconnu.',
      '5. Tu ne dois JAMAIS inventer de données utilisateur qui ne sont pas présentes dans les données fournies.',
      '6. Retourne exclusivement un JSON valide respectant le schéma demandé, sans texte introductif ni markdown.',
    ].join('\n');
  }

  /**
   * Construit le schéma JSON attendu (Structured Output Gemini).
   */
  private buildResponseSchema(): Record<string, unknown> {
    return {
      type: 'OBJECT',
      properties: {
        mappings: {
          type: 'ARRAY',
          description: 'Liste des correspondances pour chaque champ du formulaire',
          items: {
            type: 'OBJECT',
            properties: {
              fieldId: {
                type: 'STRING',
                description: "L'identifiant exact du champ du formulaire (id de CompactField)",
              },
              canonicalPath: {
                type: 'STRING',
                nullable: true,
                description: 'Le chemin canonique exact (ex: client.firstName, vehicle.brand) ou null',
              },
              confidence: {
                type: 'NUMBER',
                description: 'Score de confiance entre 0.00 et 1.00',
              },
              reason: {
                type: 'STRING',
                description: 'Explication concise en français du choix de mapping',
              },
              suggestedValue: {
                type: 'STRING',
                nullable: true,
                description: 'La valeur extraite des données disponibles correspondant à ce champ (convertie en texte)',
              },
            },
            required: ['fieldId', 'confidence', 'reason'],
          },
        },
        summary: {
          type: 'STRING',
          nullable: true,
          description: "Résumé général de l'analyse du formulaire",
        },
      },
      required: ['mappings'],
    };
  }

  /**
   * Envoie la requête de mapping à l'API Google Gemini.
   */
  async analyzeForm(
    request: GeminiMappingRequest,
    customApiKey?: string
  ): Promise<GeminiMappingResponse> {
    const apiKey = await this.resolveApiKey(customApiKey);

    const userPayload = {
      formSchema: request.formSchema,
      availableData: request.availableData,
      allowedCanonicalPaths: request.allowedCanonicalPaths || CANONICAL_PATHS,
    };

    const requestBody = {
      systemInstruction: {
        parts: [{ text: this.buildSystemInstruction() }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Voici le formulaire à analyser et les données disponibles. Détermine les correspondances :\n\n${JSON.stringify(userPayload, null, 2)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: this.buildResponseSchema(),
      },
    };

    const parsedOutput = await this.callGenerateContent(requestBody, apiKey);

    if (!parsedOutput || !Array.isArray(parsedOutput.mappings)) {
      throw new GeminiError(
        'INVALID_RESPONSE',
        "Structure de réponse invalide : propriété 'mappings' absente ou non-tableau."
      );
    }

    // Validation et assainissement contre le catalogue fermé
    const sanitizedMappings: GeminiFieldMapping[] = parsedOutput.mappings.map((m: any) => {
      const fieldId = String(m.fieldId || '');
      let canonicalPath = m.canonicalPath ? String(m.canonicalPath) : null;
      let confidence = typeof m.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : 0;
      let reason = String(m.reason || 'Correspondance déterminée par Gemini');

      // Sécurité : vérification stricte contre le catalogue fermé
      if (canonicalPath && !isValidCanonicalPath(canonicalPath)) {
        reason = `Chemin "${canonicalPath}" non présent dans le catalogue fermé — mapping ignoré.`;
        canonicalPath = null;
        confidence = 0.0;
      }

      return {
        fieldId,
        canonicalPath: canonicalPath as any,
        confidence,
        reason,
        suggestedValue: m.suggestedValue,
      };
    });

    return {
      mappings: sanitizedMappings,
      model: this.config.model,
      summary: parsedOutput.summary || undefined,
    };
  }

  /**
   * Construit le prompt système d'instructions pour la lecture d'un document
   * (carte grise, permis, relevé d'information, pièce d'identité, ...).
   */
  private buildDocumentSystemInstruction(): string {
    return [
      "Tu es un agent IA spécialisé dans la lecture de documents d'assurance automobile.",
      "Ton rôle est d'extraire UNIQUEMENT les informations réellement présentes et lisibles dans le document fourni.",
      '',
      'RÈGLES STRICTES ET NON NÉGOCIABLES :',
      "1. N'extrais que des informations explicitement présentes et lisibles dans le document. N'invente et ne complète JAMAIS un champ absent, illisible ou incertain.",
      '2. Pour chaque information extraite, indique son chemin canonique EXACTEMENT parmi les chemins autorisés fournis. Si aucun chemin ne correspond, ignore cette information (ne la retourne pas).',
      '3. Indique un score de confiance entre 0.00 et 1.00 reflétant la lisibilité et la certitude de la valeur lue (0.85+ = certaine et parfaitement lisible ; en dessous = à confirmer par un humain).',
      '4. Tu ne dois JAMAIS inventer un chemin canonique qui ne figure pas dans la liste des chemins autorisés.',
      '5. Retourne exclusivement un JSON valide respectant le schéma demandé, sans texte introductif ni markdown.',
    ].join('\n');
  }

  /** Schéma JSON attendu pour l'extraction de document (Structured Output Gemini). */
  private buildDocumentResponseSchema(): Record<string, unknown> {
    return {
      type: 'OBJECT',
      properties: {
        fields: {
          type: 'ARRAY',
          description: 'Informations trouvées dans le document',
          items: {
            type: 'OBJECT',
            properties: {
              canonicalPath: {
                type: 'STRING',
                description: 'Le chemin canonique exact (ex: vehicle.registration, client.firstName)',
              },
              value: {
                type: 'STRING',
                description: 'La valeur lue dans le document, sous forme texte',
              },
              confidence: {
                type: 'NUMBER',
                description: 'Score de confiance entre 0.00 et 1.00',
              },
            },
            required: ['canonicalPath', 'value', 'confidence'],
          },
        },
      },
      required: ['fields'],
    };
  }

  /**
   * Envoie un document (PDF/PNG/JPEG, encodé en base64) à Gemini pour en
   * extraire les informations utiles au dossier — réutilise EXACTEMENT le
   * même client HTTP/config/clé que `analyzeForm` (`callGenerateContent`),
   * avec un prompt et un schéma de sortie propres à la lecture de document.
   */
  async analyzeDocument(
    request: GeminiDocumentExtractionRequest,
    customApiKey?: string
  ): Promise<GeminiDocumentExtractionResponse> {
    const apiKey = await this.resolveApiKey(customApiKey);
    const allowedCanonicalPaths = request.allowedCanonicalPaths || CANONICAL_PATHS;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: this.buildDocumentSystemInstruction() }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Chemins canoniques autorisés :\n${JSON.stringify(allowedCanonicalPaths)}\n\nLis ce document et extrais uniquement les informations réellement présentes.`,
            },
            {
              inlineData: {
                mimeType: request.mimeType,
                data: request.documentBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: this.buildDocumentResponseSchema(),
      },
    };

    const parsedOutput = await this.callGenerateContent(requestBody, apiKey);

    if (!parsedOutput || !Array.isArray(parsedOutput.fields)) {
      throw new GeminiError(
        'INVALID_RESPONSE',
        "Structure de réponse invalide : propriété 'fields' absente ou non-tableau."
      );
    }

    // Validation et assainissement contre le catalogue fermé — un chemin
    // inconnu ou une valeur absente est silencieusement ignoré (jamais inventé).
    const sanitizedFields: GeminiDocumentExtractedField[] = [];
    for (const f of parsedOutput.fields) {
      const canonicalPath = f?.canonicalPath ? String(f.canonicalPath) : null;
      if (!canonicalPath || !isValidCanonicalPath(canonicalPath)) continue;
      if (f.value === undefined || f.value === null || f.value === '') continue;

      const confidence = typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0;
      sanitizedFields.push({ canonicalPath: canonicalPath as CanonicalPath, value: f.value, confidence });
    }

    return { fields: sanitizedFields, model: this.config.model };
  }

  /** Résout la clé API à utiliser, ou rejette proprement si aucune n'est configurée. */
  private async resolveApiKey(customApiKey?: string): Promise<string> {
    const apiKey = customApiKey || (await getStoredApiKey());
    if (!apiKey || apiKey.trim() === '') {
      throw new GeminiError(
        'API_KEY_MISSING',
        "Clé API Gemini non configurée. Veuillez renseigner votre clé API dans les paramètres de l'extension."
      );
    }
    return apiKey;
  }

  /**
   * Appel HTTP bas niveau vers `generateContent`, commun à `analyzeForm` et
   * `analyzeDocument` — un seul client Gemini, deux prompts/schémas différents.
   * Retourne le JSON structuré déjà extrait du candidat (non encore validé
   * contre le catalogue fermé : cette étape reste à la charge de l'appelant,
   * qui seul connaît la forme attendue — `mappings` ou `fields`).
   */
  private async callGenerateContent(requestBody: Record<string, unknown>, apiKey: string): Promise<any> {
    const endpointUrl = `https://generativelanguage.googleapis.com/${this.config.apiVersion}/models/${encodeURIComponent(this.config.model)}:generateContent`;

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let rawResponse: Response;
    try {
      rawResponse = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timerId);
      if (err.name === 'AbortError') {
        throw new GeminiError(
          'TIMEOUT',
          `La requête vers Gemini a expiré après ${this.config.timeoutMs / 1000} secondes.`
        );
      }
      throw new GeminiError(
        'NETWORK_ERROR',
        `Erreur réseau lors de la communication avec Gemini : ${err.message || 'Impossible de joindre le serveur'}`
      );
    } finally {
      clearTimeout(timerId);
    }

    // Gestion des codes d'erreur HTTP
    if (!rawResponse.ok) {
      let errorDetails = '';
      try {
        const errorJson = await rawResponse.json();
        errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetails = await rawResponse.text().catch(() => 'Détail indisponible');
      }

      if (rawResponse.status === 429) {
        throw new GeminiError(
          'RATE_LIMITED',
          `Quota API Gemini dépassé (429) : ${errorDetails}`,
          rawResponse.status
        );
      }

      if (rawResponse.status === 401 || rawResponse.status === 403) {
        throw new GeminiError(
          'HTTP_ERROR',
          `Clé API Gemini invalide ou non autorisée (${rawResponse.status}) : ${errorDetails}`,
          rawResponse.status
        );
      }

      throw new GeminiError(
        'HTTP_ERROR',
        `Erreur HTTP ${rawResponse.status} renvoyée par Gemini : ${errorDetails}`,
        rawResponse.status
      );
    }

    // Extraction et validation de la réponse JSON
    let responseJson: any;
    try {
      responseJson = await rawResponse.json();
    } catch (err: any) {
      throw new GeminiError('PARSE_ERROR', 'Réponse HTTP invalide : contenu non-JSON.');
    }

    const candidateText =
      responseJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new GeminiError(
        'INVALID_RESPONSE',
        'Réponse Gemini vide ou bloquée par les filtres de sécurité.'
      );
    }

    try {
      return JSON.parse(candidateText);
    } catch (err: any) {
      throw new GeminiError(
        'PARSE_ERROR',
        `Le contenu retourné par Gemini n'est pas un JSON valide : ${candidateText.slice(0, 150)}...`
      );
    }
  }
}
