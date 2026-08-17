// src/models/field-knowledge.model.ts
var FieldKnowledge = /* @__PURE__ */ ((FieldKnowledge2) => {
  FieldKnowledge2["KNOWN"] = "KNOWN";
  FieldKnowledge2["UNKNOWN"] = "UNKNOWN";
  FieldKnowledge2["DECLARED_UNKNOWN"] = "DECLARED_UNKNOWN";
  FieldKnowledge2["NEEDS_CONFIRMATION"] = "NEEDS_CONFIRMATION";
  return FieldKnowledge2;
})(FieldKnowledge || {});
function declaredUnknownField() {
  return { value: null, knowledge: "DECLARED_UNKNOWN" /* DECLARED_UNKNOWN */ };
}
function knownField(value) {
  return { value, knowledge: "KNOWN" /* KNOWN */ };
}

// src/providers/mock-data-provider.ts
var MockDataProvider = class {
  defaultData = {
    client: {
      firstName: "Mohamed",
      lastName: "Mzoughi",
      nationalId: "12345678",
      birthDate: "1998-05-12",
      phone: "+21698123456",
      email: "mohamed.mzoughi@example.com",
      address: {
        street: "15 Avenue Habib Bourguiba",
        postalCode: "1000",
        city: "Tunis",
        country: "Tunisie"
      },
      street: "15 Avenue Habib Bourguiba",
      postalCode: "1000",
      city: "Tunis",
      country: "Tunisie"
    },
    vehicle: {
      registration: "123 TN 4567",
      brand: "Yamaha",
      model: "MT-07",
      version: "689cc ABS",
      firstRegistrationDate: "2021-06-15",
      fiscalPower: 7,
      vehicleValue: 7500,
      vehicleType: "Moto",
      usage: "PRIVATE" /* PRIVATE */,
      purchaseDate: "2022-03-10",
      // Intentionnellement absent pour tester la question interactive :
      parkingType: null
    },
    driver: {
      sameAsClient: true,
      firstName: "Mohamed",
      lastName: "Mzoughi",
      birthDate: "1998-05-12",
      licenseDate: "2017-09-20",
      licenseType: "A2",
      profession: "Ing\xE9nieur",
      phone: "+21698123456"
    },
    insuranceHistory: {
      previousInsurer: "STAR Assurances",
      previousContractStartDate: "2023-01-01",
      previousContractEndDate: "2024-01-01",
      seniority: knownField(3),
      bonusMalus: knownField(0.8),
      // Exemple de sinistre : 0 sinistre connu (RÈGLE ABSOLUE : doit être rempli 0)
      claimsCount: knownField(0),
      responsibleClaimsCount: knownField(0),
      // Exemple d'un champ déclaré inconnu par le courtier (RÈGLE ABSOLUE : ne jamais remplir)
      nonResponsibleClaimsCount: declaredUnknownField(),
      wasTerminated: false,
      terminatedByInsurer: false,
      terminationReason: null,
      terminationDate: null
    }
  };
  async getQuoteRequest() {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData)));
  }
  async getCurrentCustomer() {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.client)));
  }
  async getCustomerById(id) {
    if (id === this.defaultData.client.nationalId) {
      return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.client)));
    }
    return Promise.resolve(null);
  }
  async getVehicle() {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.vehicle)));
  }
  async getInsuranceHistory() {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.insuranceHistory)));
  }
};

// src/shared/canonical-path-bridge.ts
var EXTENSION_TO_ANGULAR_PATH = {
  "client.address.street": "client.address",
  "client.address.postalCode": "client.postalCode",
  "client.address.city": "client.city",
  "client.address.country": "client.country"
};
var UNSUPPORTED_ON_ANGULAR = /* @__PURE__ */ new Set([
  "vehicle.purchaseDate",
  "driver.licenseType",
  "insuranceHistory.currentlyInsured"
]);
function toAngularCanonicalPath(extensionPath) {
  if (UNSUPPORTED_ON_ANGULAR.has(extensionPath)) return null;
  return EXTENSION_TO_ANGULAR_PATH[extensionPath] ?? extensionPath;
}
function toKnowledgeField(field) {
  if (!field) return { value: null, knowledge: "UNKNOWN" /* UNKNOWN */ };
  const knowledge = Object.values(FieldKnowledge).includes(field.knowledge) ? field.knowledge : "UNKNOWN" /* UNKNOWN */;
  return { value: field.value, knowledge };
}
function toExtensionCanonicalQuoteRequest(angular) {
  return {
    client: {
      firstName: angular.client.firstName,
      lastName: angular.client.lastName,
      nationalId: angular.client.nationalId,
      birthDate: angular.client.birthDate,
      phone: angular.client.phone,
      email: angular.client.email,
      address: {
        street: angular.client.address,
        postalCode: angular.client.postalCode,
        city: angular.client.city,
        country: angular.client.country
      }
    },
    vehicle: {
      registration: angular.vehicle.registration,
      brand: angular.vehicle.brand,
      model: angular.vehicle.model,
      version: angular.vehicle.version,
      firstRegistrationDate: angular.vehicle.firstRegistrationDate,
      fiscalPower: angular.vehicle.fiscalPower,
      vehicleValue: angular.vehicle.vehicleValue,
      vehicleType: angular.vehicle.vehicleType,
      usage: angular.vehicle.usage,
      parkingType: angular.vehicle.parkingType
    },
    driver: {
      sameAsClient: angular.driver.sameAsClient,
      firstName: angular.driver.firstName,
      lastName: angular.driver.lastName,
      birthDate: angular.driver.birthDate,
      licenseDate: angular.driver.licenseDate,
      profession: angular.driver.profession,
      phone: angular.driver.phone
    },
    insuranceHistory: {
      previousInsurer: angular.insuranceHistory.previousInsurer,
      previousContractStartDate: angular.insuranceHistory.previousContractStartDate,
      previousContractEndDate: angular.insuranceHistory.previousContractEndDate,
      seniority: toKnowledgeField(angular.insuranceHistory.seniority),
      bonusMalus: toKnowledgeField(angular.insuranceHistory.bonusMalus),
      claimsCount: toKnowledgeField(angular.insuranceHistory.claimsCount),
      responsibleClaimsCount: toKnowledgeField(angular.insuranceHistory.responsibleClaimsCount),
      nonResponsibleClaimsCount: toKnowledgeField(angular.insuranceHistory.nonResponsibleClaimsCount),
      wasTerminated: angular.insuranceHistory.wasTerminated,
      terminatedByInsurer: angular.insuranceHistory.terminatedByInsurer,
      terminationReason: angular.insuranceHistory.terminationReason,
      terminationDate: angular.insuranceHistory.terminationDate
    }
  };
}

// src/background/external-message-handler.ts
function inferQuestionType(field) {
  if (field.options && field.options.length > 0) return "choice";
  if (field.type === "checkbox") return "boolean";
  if (field.type === "number") return "number";
  if (field.type === "date") return "date";
  return "text";
}
function toExternalRequiredFields(mappings) {
  const byCanonicalPath = /* @__PURE__ */ new Map();
  for (const mapping of mappings) {
    if (!mapping.canonicalPath) continue;
    const angularPath = toAngularCanonicalPath(mapping.canonicalPath);
    if (!angularPath) continue;
    if (byCanonicalPath.has(angularPath)) continue;
    const field = mapping.field;
    const label = field.label || field.placeholder || field.ariaLabel || field.name || angularPath;
    byCanonicalPath.set(angularPath, {
      canonicalPath: angularPath,
      label,
      type: inferQuestionType(field),
      choices: field.options?.map((o) => ({ value: o.value, label: o.text || o.value })),
      required: true,
      reason: mapping.status === "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */ ? "Confirmation recommand\xE9e" : void 0
    });
  }
  return Array.from(byCanonicalPath.values());
}
async function findOrOpenExtranetTab(url) {
  const origin = new URL(url).origin;
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url?.startsWith(origin));
  if (existing?.id !== void 0) {
    await chrome.tabs.update(existing.id, { active: true });
    return existing;
  }
  return chrome.tabs.create({ url, active: true });
}
function waitForTabComplete(tabId, timeoutMs = 15e3) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Le chargement de l'extranet a expir\xE9."));
    }, timeoutMs);
    function listener(updatedTabId, info) {
      if (settled || updatedTabId !== tabId || info.status !== "complete") return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.get(tabId, (tab) => {
      if (settled) return;
      if (tab.status === "complete") {
        settled = true;
        clearTimeout(timer);
        resolve();
        return;
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}
function requestDetectFieldsFromTab(tabId, quoteData) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "DETECT_FIELDS", quoteData }, (response) => {
      if (chrome.runtime.lastError || !response?.success || !response.run) {
        reject(
          new Error(
            response?.error || chrome.runtime.lastError?.message || "Le formulaire n'a pas pu \xEAtre analys\xE9 sur cette page."
          )
        );
        return;
      }
      resolve(response.run);
    });
  });
}
async function handlePrepareExtranetQuote(message) {
  const quoteData = toExtensionCanonicalQuoteRequest(message.quoteData);
  const tab = await findOrOpenExtranetTab(message.extranetUrl);
  if (tab.id === void 0) {
    throw new Error("Impossible d'ouvrir l'extranet.");
  }
  await waitForTabComplete(tab.id);
  const run = await requestDetectFieldsFromTab(tab.id, quoteData);
  return toExternalRequiredFields(run.mappings);
}
function requestExecuteFillFromTab(tabId, mappings) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "EXECUTE_FILL", mappings }, (response) => {
      if (chrome.runtime.lastError || !response?.success || !response.run) {
        reject(
          new Error(
            response?.error || chrome.runtime.lastError?.message || "Le remplissage a \xE9chou\xE9 sur cette page."
          )
        );
        return;
      }
      resolve(response.run.fillResults ?? []);
    });
  });
}
function computeFillOutcome(mappings, fillResults) {
  const filledCanonicalPaths = new Set(
    fillResults.filter((result) => result.success).map((result) => result.canonicalPath)
  );
  const filledFieldsCount = filledCanonicalPaths.size;
  const stillMissingMappings = mappings.filter(
    (mapping) => mapping.canonicalPath && !filledCanonicalPaths.has(mapping.canonicalPath)
  );
  const missingFields = toExternalRequiredFields(stillMissingMappings);
  let status;
  if (missingFields.length === 0) {
    status = "ready";
  } else if (filledFieldsCount > 0) {
    status = "partially_filled";
  } else {
    status = "blocked";
  }
  return { status, filledFieldsCount, missingFields };
}
async function handleFillExtranetQuote(message) {
  const quoteData = toExtensionCanonicalQuoteRequest(message.quoteData);
  const tab = await findOrOpenExtranetTab(message.extranetUrl);
  if (tab.id === void 0) {
    throw new Error("Impossible d'ouvrir l'extranet.");
  }
  await waitForTabComplete(tab.id);
  const run = await requestDetectFieldsFromTab(tab.id, quoteData);
  const fillResults = await requestExecuteFillFromTab(tab.id, run.mappings);
  return {
    ...computeFillOutcome(run.mappings, fillResults),
    lastStepReached: run.stepInfo?.currentStep ?? null
  };
}

// src/models/form-memory.model.ts
var FORM_MEMORY_VERSION = 1;
var FORM_MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1e3;

// src/background/form-memory-store.ts
var STORAGE_KEY_FORM_MEMORY = "form_memory";
function readTable() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_FORM_MEMORY], (result) => {
      resolve(result[STORAGE_KEY_FORM_MEMORY] || {});
    });
  });
}
function writeTable(table) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_FORM_MEMORY]: table }, () => resolve());
  });
}
function isFormMemoryExpired(memory, ttlMs = FORM_MEMORY_TTL_MS, now = Date.now()) {
  const lastUsed = Date.parse(memory.lastUsedAt);
  if (Number.isNaN(lastUsed)) return true;
  return now - lastUsed > ttlMs;
}
var FormMemoryStore = class {
  static async get(memoryKey) {
    const table = await readTable();
    const memory = table[memoryKey];
    if (!memory) return null;
    if (memory.version !== FORM_MEMORY_VERSION) return null;
    if (!memory.formFingerprint || !Array.isArray(memory.validatedMappings)) return null;
    if (isFormMemoryExpired(memory)) return null;
    return memory;
  }
  static async set(memory) {
    const table = await readTable();
    table[memory.memoryKey] = memory;
    await writeTable(table);
  }
  static async delete(memoryKey) {
    const table = await readTable();
    delete table[memoryKey];
    await writeTable(table);
  }
  static async clear() {
    await writeTable({});
  }
  static async find(predicate) {
    const table = await readTable();
    return Object.values(table).filter(predicate);
  }
  /** Met à jour la date de dernière utilisation sans modifier le mapping. */
  static async touch(memoryKey) {
    const table = await readTable();
    const memory = table[memoryKey];
    if (memory) {
      memory.lastUsedAt = (/* @__PURE__ */ new Date()).toISOString();
      await writeTable(table);
    }
  }
};

// src/background/session-store.ts
var STORAGE_KEY_QUOTE_SESSIONS = "form_agent_quote_sessions";
var QUOTE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
function readTable2() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_QUOTE_SESSIONS], (result) => {
      resolve(result[STORAGE_KEY_QUOTE_SESSIONS] || {});
    });
  });
}
function writeTable2(table) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_QUOTE_SESSIONS]: table }, () => resolve());
  });
}
function isQuoteSessionStale(session, ttlMs = QUOTE_SESSION_TTL_MS, now = Date.now()) {
  const lastVisited = Date.parse(session.lastVisitedAt);
  if (Number.isNaN(lastVisited)) return true;
  return now - lastVisited > ttlMs;
}
var SessionStore = class _SessionStore {
  static async get(sessionId) {
    const table = await readTable2();
    return table[sessionId] || null;
  }
  static async set(session) {
    const table = await readTable2();
    table[session.sessionId] = session;
    await writeTable2(table);
  }
  static async delete(sessionId) {
    const table = await readTable2();
    delete table[sessionId];
    await writeTable2(table);
  }
  static async clear() {
    await writeTable2({});
  }
  static async find(predicate) {
    const table = await readTable2();
    return Object.values(table).filter(predicate);
  }
  /**
   * Sessions actives (non expirées) pour une identité de parcours donnée
   * (origin::product), triées de la plus récente à la plus ancienne.
   */
  static async findBySessionKey(sessionKey) {
    const sessions = await _SessionStore.find(
      (s) => s.sessionKey === sessionKey && s.status === "in_progress" && !isQuoteSessionStale(s)
    );
    return sessions.sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt));
  }
  static async touch(sessionId) {
    const table = await readTable2();
    const session = table[sessionId];
    if (session) {
      session.lastVisitedAt = (/* @__PURE__ */ new Date()).toISOString();
      await writeTable2(table);
    }
  }
};

// src/models/canonical-paths.ts
var CANONICAL_PATHS = [
  // ─── Client ───────────────────────────────────────────────
  "client.firstName",
  "client.lastName",
  "client.nationalId",
  "client.birthDate",
  "client.phone",
  "client.email",
  "client.address.street",
  "client.address.postalCode",
  "client.address.city",
  "client.address.country",
  // ─── Véhicule ─────────────────────────────────────────────
  "vehicle.registration",
  "vehicle.brand",
  "vehicle.model",
  "vehicle.version",
  "vehicle.firstRegistrationDate",
  "vehicle.fiscalPower",
  "vehicle.vehicleValue",
  "vehicle.vehicleType",
  "vehicle.usage",
  "vehicle.parkingType",
  "vehicle.purchaseDate",
  // ─── Conducteur ───────────────────────────────────────────
  "driver.firstName",
  "driver.lastName",
  "driver.birthDate",
  "driver.licenseDate",
  "driver.licenseType",
  "driver.profession",
  "driver.phone",
  // ─── Historique d'assurance ───────────────────────────────
  "insuranceHistory.currentlyInsured",
  "insuranceHistory.previousInsurer",
  "insuranceHistory.previousContractStartDate",
  "insuranceHistory.previousContractEndDate",
  "insuranceHistory.seniority",
  "insuranceHistory.bonusMalus",
  "insuranceHistory.claimsCount",
  "insuranceHistory.responsibleClaimsCount",
  "insuranceHistory.nonResponsibleClaimsCount",
  "insuranceHistory.wasTerminated",
  "insuranceHistory.terminatedByInsurer",
  "insuranceHistory.terminationReason",
  "insuranceHistory.terminationDate"
];
function isValidCanonicalPath(path) {
  return CANONICAL_PATHS.includes(path);
}

// src/background/gemini.service.ts
var GeminiError = class extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "GeminiError";
  }
};
var DEFAULT_GEMINI_CONFIG = {
  model: "gemini-2.5-flash",
  timeoutMs: 15e3,
  apiVersion: "v1beta"
};
var STORAGE_KEY_GEMINI_API_KEY = "gemini_api_key";
async function getStoredApiKey() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY_GEMINI_API_KEY], (result) => {
        resolve(result[STORAGE_KEY_GEMINI_API_KEY] || null);
      });
    } else {
      resolve(null);
    }
  });
}
async function setStoredApiKey(apiKey) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY_GEMINI_API_KEY]: apiKey.trim() }, () => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}
async function clearStoredApiKey() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.remove([STORAGE_KEY_GEMINI_API_KEY], () => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}
var GeminiService = class {
  config;
  constructor(config = {}) {
    this.config = { ...DEFAULT_GEMINI_CONFIG, ...config };
  }
  /**
   * Construit le prompt système d'instructions pour Gemini.
   */
  buildSystemInstruction() {
    return [
      "Tu es un agent IA sp\xE9cialis\xE9 dans l'analyse s\xE9mantique et le mapping de formulaires CRM et extranets d'assurance automobile.",
      "Ton r\xF4le est de faire correspondre chaque champ du formulaire fourni avec un champ de donn\xE9es canoniques disponibles.",
      "",
      "R\xC8GLES STRICTES ET NON N\xC9GOCIABLES :",
      "1. Pour chaque champ du formulaire, d\xE9termine son \xE9quivalent canonique parmi les chemins autoris\xE9s fournis.",
      "2. Tu ne dois JAMAIS inventer un chemin canonique qui ne figure pas dans la liste des chemins autoris\xE9s. Si aucun chemin ne correspond ou si tu as un doute fort, indique canonicalPath: null.",
      '3. Si un champ du formulaire est ambigu (ex: "Nom" dans une section sans titre clair), analyse le contexte global et les autres champs pour d\xE9sambigu\xEFser (client vs conducteur).',
      "4. Indique un score de confiance entre 0.00 et 1.00 pour chaque mapping :",
      "   - 0.85 \xE0 1.00 : Correspondance certaine et \xE9vidente.",
      "   - 0.60 \xE0 0.84 : Correspondance probable n\xE9cessitant confirmation humaine.",
      "   - Moins de 0.60 : Correspondance incertaine ou champ inconnu.",
      "5. Tu ne dois JAMAIS inventer de donn\xE9es utilisateur qui ne sont pas pr\xE9sentes dans les donn\xE9es fournies.",
      "6. Retourne exclusivement un JSON valide respectant le sch\xE9ma demand\xE9, sans texte introductif ni markdown."
    ].join("\n");
  }
  /**
   * Construit le schéma JSON attendu (Structured Output Gemini).
   */
  buildResponseSchema() {
    return {
      type: "OBJECT",
      properties: {
        mappings: {
          type: "ARRAY",
          description: "Liste des correspondances pour chaque champ du formulaire",
          items: {
            type: "OBJECT",
            properties: {
              fieldId: {
                type: "STRING",
                description: "L'identifiant exact du champ du formulaire (id de CompactField)"
              },
              canonicalPath: {
                type: "STRING",
                nullable: true,
                description: "Le chemin canonique exact (ex: client.firstName, vehicle.brand) ou null"
              },
              confidence: {
                type: "NUMBER",
                description: "Score de confiance entre 0.00 et 1.00"
              },
              reason: {
                type: "STRING",
                description: "Explication concise en fran\xE7ais du choix de mapping"
              },
              suggestedValue: {
                type: "STRING",
                nullable: true,
                description: "La valeur extraite des donn\xE9es disponibles correspondant \xE0 ce champ (convertie en texte)"
              }
            },
            required: ["fieldId", "confidence", "reason"]
          }
        },
        summary: {
          type: "STRING",
          nullable: true,
          description: "R\xE9sum\xE9 g\xE9n\xE9ral de l'analyse du formulaire"
        }
      },
      required: ["mappings"]
    };
  }
  /**
   * Envoie la requête de mapping à l'API Google Gemini.
   */
  async analyzeForm(request, customApiKey) {
    const apiKey = customApiKey || await getStoredApiKey();
    if (!apiKey || apiKey.trim() === "") {
      throw new GeminiError(
        "API_KEY_MISSING",
        "Cl\xE9 API Gemini non configur\xE9e. Veuillez renseigner votre cl\xE9 API dans les param\xE8tres de l'extension."
      );
    }
    const endpointUrl = `https://generativelanguage.googleapis.com/${this.config.apiVersion}/models/${encodeURIComponent(this.config.model)}:generateContent`;
    const userPayload = {
      formSchema: request.formSchema,
      availableData: request.availableData,
      allowedCanonicalPaths: request.allowedCanonicalPaths || CANONICAL_PATHS
    };
    const requestBody = {
      systemInstruction: {
        parts: [{ text: this.buildSystemInstruction() }]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Voici le formulaire \xE0 analyser et les donn\xE9es disponibles. D\xE9termine les correspondances :

${JSON.stringify(userPayload, null, 2)}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: this.buildResponseSchema()
      }
    };
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let rawResponse;
    try {
      rawResponse = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey.trim()
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timerId);
      if (err.name === "AbortError") {
        throw new GeminiError(
          "TIMEOUT",
          `La requ\xEAte vers Gemini a expir\xE9 apr\xE8s ${this.config.timeoutMs / 1e3} secondes.`
        );
      }
      throw new GeminiError(
        "NETWORK_ERROR",
        `Erreur r\xE9seau lors de la communication avec Gemini : ${err.message || "Impossible de joindre le serveur"}`
      );
    } finally {
      clearTimeout(timerId);
    }
    if (!rawResponse.ok) {
      let errorDetails = "";
      try {
        const errorJson = await rawResponse.json();
        errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetails = await rawResponse.text().catch(() => "D\xE9tail indisponible");
      }
      if (rawResponse.status === 429) {
        throw new GeminiError(
          "RATE_LIMITED",
          `Quota API Gemini d\xE9pass\xE9 (429) : ${errorDetails}`,
          rawResponse.status
        );
      }
      if (rawResponse.status === 401 || rawResponse.status === 403) {
        throw new GeminiError(
          "HTTP_ERROR",
          `Cl\xE9 API Gemini invalide ou non autoris\xE9e (${rawResponse.status}) : ${errorDetails}`,
          rawResponse.status
        );
      }
      throw new GeminiError(
        "HTTP_ERROR",
        `Erreur HTTP ${rawResponse.status} renvoy\xE9e par Gemini : ${errorDetails}`,
        rawResponse.status
      );
    }
    let responseJson;
    try {
      responseJson = await rawResponse.json();
    } catch (err) {
      throw new GeminiError("PARSE_ERROR", "R\xE9ponse HTTP invalide : contenu non-JSON.");
    }
    const candidateText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new GeminiError(
        "INVALID_RESPONSE",
        "R\xE9ponse Gemini vide ou bloqu\xE9e par les filtres de s\xE9curit\xE9."
      );
    }
    let parsedOutput;
    try {
      parsedOutput = JSON.parse(candidateText);
    } catch (err) {
      throw new GeminiError(
        "PARSE_ERROR",
        `Le contenu retourn\xE9 par Gemini n'est pas un JSON valide : ${candidateText.slice(0, 150)}...`
      );
    }
    if (!parsedOutput || !Array.isArray(parsedOutput.mappings)) {
      throw new GeminiError(
        "INVALID_RESPONSE",
        "Structure de r\xE9ponse invalide : propri\xE9t\xE9 'mappings' absente ou non-tableau."
      );
    }
    const sanitizedMappings = parsedOutput.mappings.map((m) => {
      const fieldId = String(m.fieldId || "");
      let canonicalPath = m.canonicalPath ? String(m.canonicalPath) : null;
      let confidence = typeof m.confidence === "number" ? Math.max(0, Math.min(1, m.confidence)) : 0;
      let reason = String(m.reason || "Correspondance d\xE9termin\xE9e par Gemini");
      if (canonicalPath && !isValidCanonicalPath(canonicalPath)) {
        reason = `Chemin "${canonicalPath}" non pr\xE9sent dans le catalogue ferm\xE9 \u2014 mapping ignor\xE9.`;
        canonicalPath = null;
        confidence = 0;
      }
      return {
        fieldId,
        canonicalPath,
        confidence,
        reason,
        suggestedValue: m.suggestedValue
      };
    });
    return {
      mappings: sanitizedMappings,
      model: this.config.model,
      summary: parsedOutput.summary || void 0
    };
  }
};

// src/background/service-worker.ts
var mockProvider = new MockDataProvider();
var geminiService = new GeminiService();
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Form Agent] Service Worker initialis\xE9.");
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      console.warn("SidePanel API non disponible :", e);
    }
  }
  const initialData = await mockProvider.getQuoteRequest();
  chrome.storage.local.get(["quoteData"], (result) => {
    if (!result.quoteData) {
      chrome.storage.local.set({ quoteData: initialData });
    }
  });
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_QUOTE_DATA") {
    chrome.storage.local.get(["quoteData"], async (result) => {
      if (result.quoteData) {
        sendResponse({ type: "QUOTE_DATA_RESPONSE", data: result.quoteData });
      } else {
        const fallback = await mockProvider.getQuoteRequest();
        sendResponse({ type: "QUOTE_DATA_RESPONSE", data: fallback });
      }
    });
    return true;
  }
  if (message.type === "SET_QUOTE_DATA") {
    chrome.storage.local.set({ quoteData: message.data }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (message.type === "ANALYZE_WITH_GEMINI") {
    console.log("[FormAgent][Gemini] Service Worker: Requ\xEAte d'analyse re\xE7ue.");
    geminiService.analyzeForm(message.request).then((response) => {
      console.log(`[FormAgent][Gemini] Service Worker: Analyse termin\xE9e avec ${response.mappings?.length || 0} mapping(s).`);
      sendResponse({
        type: "GEMINI_ANALYSIS_RESPONSE",
        success: true,
        response
      });
    }).catch((err) => {
      const errorCode = err instanceof GeminiError ? err.code : "UNKNOWN_ERROR";
      console.warn(`[FormAgent][Gemini] Service Worker: \xC9chec de l'appel (${errorCode}) :`, err.message);
      sendResponse({
        type: "GEMINI_ANALYSIS_RESPONSE",
        success: false,
        error: err.message || "Erreur lors de l'analyse Gemini",
        errorCode
      });
    });
    return true;
  }
  if (message.type === "SET_GEMINI_API_KEY") {
    setStoredApiKey(message.apiKey).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "GET_GEMINI_API_KEY") {
    getStoredApiKey().then((key) => sendResponse({ success: true, hasKey: Boolean(key && key.length > 0) })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "CLEAR_GEMINI_API_KEY") {
    clearStoredApiKey().then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "GET_FORM_MEMORY") {
    FormMemoryStore.get(message.memoryKey).then((memory) => sendResponse({ type: "FORM_MEMORY_RESPONSE", memory })).catch(() => sendResponse({ type: "FORM_MEMORY_RESPONSE", memory: null }));
    return true;
  }
  if (message.type === "SAVE_FORM_MEMORY") {
    FormMemoryStore.set(message.memory).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "DELETE_FORM_MEMORY") {
    FormMemoryStore.delete(message.memoryKey).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "CLEAR_FORM_MEMORY") {
    FormMemoryStore.clear().then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "GET_QUOTE_SESSION") {
    SessionStore.get(message.sessionId).then((session) => sendResponse({ type: "QUOTE_SESSION_RESPONSE", session })).catch(() => sendResponse({ type: "QUOTE_SESSION_RESPONSE", session: null }));
    return true;
  }
  if (message.type === "SAVE_QUOTE_SESSION") {
    SessionStore.set(message.session).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "DELETE_QUOTE_SESSION") {
    SessionStore.delete(message.sessionId).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "LIST_QUOTE_SESSIONS") {
    SessionStore.findBySessionKey(message.sessionKey).then((sessions) => sendResponse({ type: "QUOTE_SESSIONS_LIST_RESPONSE", sessions })).catch(() => sendResponse({ type: "QUOTE_SESSIONS_LIST_RESPONSE", sessions: [] }));
    return true;
  }
});
chrome.runtime.onMessageExternal.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === "PREPARE_EXTRANET_QUOTE") {
      handlePrepareExtranetQuote(message).then(
        (fields) => sendResponse({
          type: "EXTRANET_FORM_REQUIREMENTS",
          quoteFileId: message.quoteFileId,
          extranetId: message.extranetId,
          fields
        })
      ).catch(
        (err) => sendResponse({
          type: "EXTRANET_ANALYSIS_ERROR",
          quoteFileId: message.quoteFileId,
          extranetId: message.extranetId,
          error: err instanceof Error ? err.message : "Erreur lors de l'analyse de l'extranet."
        })
      );
      return true;
    }
    if (message.type === "FILL_EXTRANET_QUOTE") {
      handleFillExtranetQuote(message).then(
        (outcome) => sendResponse({
          type: "FILL_EXTRANET_RESULT",
          quoteFileId: message.quoteFileId,
          extranetId: message.extranetId,
          status: outcome.status,
          filledFieldsCount: outcome.filledFieldsCount,
          missingFields: outcome.missingFields,
          lastStepReached: outcome.lastStepReached
        })
      ).catch(
        (err) => sendResponse({
          type: "FILL_EXTRANET_ERROR",
          quoteFileId: message.quoteFileId,
          extranetId: message.extranetId,
          error: err instanceof Error ? err.message : "Erreur lors du remplissage de l'extranet."
        })
      );
      return true;
    }
    return false;
  }
);
//# sourceMappingURL=service-worker.js.map
