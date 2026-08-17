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

// src/models/form-memory.model.ts
var FORM_MEMORY_VERSION = 1;
var FORM_MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1e3;

// src/shared/session-context.ts
var PRODUCT_QUERY_KEYS = ["name", "product", "produit", "oid"];
var COMBINING_DIACRITICS_START = 768;
var COMBINING_DIACRITICS_END = 879;
function stripDiacritics(value) {
  let result = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) || 0;
    if (code >= COMBINING_DIACRITICS_START && code <= COMBINING_DIACRITICS_END) {
      continue;
    }
    result += ch;
  }
  return result;
}
function normalizeProductToken(value) {
  const decomposed = value.toLowerCase().normalize("NFD");
  const withoutDiacritics = stripDiacritics(decomposed);
  const token = withoutDiacritics.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return token || "default";
}
function identifySessionContext(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { origin: "unknown", product: "default" };
  }
  const origin = url.hostname || "unknown";
  for (const key of PRODUCT_QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value) {
      return { origin, product: normalizeProductToken(value) };
    }
  }
  const pathSegment = url.pathname.split("/").filter(Boolean)[0];
  if (pathSegment) {
    return { origin, product: normalizeProductToken(pathSegment) };
  }
  return { origin, product: "default" };
}
function buildSessionKey(context) {
  return `${context.origin}::${context.product}`;
}

// src/models/canonical-data.model.ts
function getCanonicalValue(data, canonicalPath) {
  const parts = canonicalPath.split(".");
  let current = data;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (current === null || current === void 0) {
      return { value: null, knowledge: "UNKNOWN" /* UNKNOWN */ };
    }
    if (key === "street" && !current.street && current.address?.street) {
      current = current.address.street;
      continue;
    }
    if (key === "postalCode" && !current.postalCode && current.address?.postalCode) {
      current = current.address.postalCode;
      continue;
    }
    if (key === "city" && !current.city && current.address?.city) {
      current = current.address.city;
      continue;
    }
    if (key === "country" && !current.country && current.address?.country) {
      current = current.address.country;
      continue;
    }
    current = current[key];
  }
  if (current === null || current === void 0) {
    return { value: null, knowledge: "UNKNOWN" /* UNKNOWN */ };
  }
  if (typeof current === "object" && "knowledge" in current) {
    return {
      value: current.value,
      knowledge: current.knowledge
    };
  }
  return {
    value: current,
    knowledge: "KNOWN" /* KNOWN */
  };
}

// src/shared/constants/synonyms.constants.ts
var FIELD_SYNONYMS = [
  // ─── Client ─────────────────────────────────────────────────────────────
  {
    canonicalPath: "client.firstName",
    exactKeywords: ["prenom", "first name", "given name", "prenom client", "prenom assure", "prenom souscripteur"],
    partialKeywords: ["prenom", "firstname"],
    technicalNames: ["firstname", "first_name", "fname", "prenom", "client_prenom", "assure_prenom"],
    expectedTypes: ["text"]
  },
  {
    canonicalPath: "client.lastName",
    exactKeywords: ["nom", "last name", "family name", "nom client", "nom assure", "nom de famille", "nom souscripteur"],
    partialKeywords: ["nom", "lastname", "famille"],
    technicalNames: ["lastname", "last_name", "lname", "nom", "client_nom", "assure_nom"],
    expectedTypes: ["text"]
  },
  {
    canonicalPath: "client.nationalId",
    exactKeywords: ["cin", "identifiant national", "numero identite", "num identite", "carte identite", "cni", "national id"],
    partialKeywords: ["cin", "identite", "cni", "nationalid"],
    technicalNames: ["cin", "national_id", "cni", "identity_number", "num_cin"],
    expectedTypes: ["text", "number"]
  },
  {
    canonicalPath: "client.birthDate",
    exactKeywords: ["date de naissance", "date naissance", "birth date", "ne le", "nee le", "date de naissance souscripteur"],
    partialKeywords: ["naissance", "birthdate", "dob"],
    technicalNames: ["birthdate", "birth_date", "date_naissance", "datenaissance", "dob"],
    expectedTypes: ["date", "text"]
  },
  {
    canonicalPath: "client.phone",
    exactKeywords: ["telephone", "numero de telephone", "mobile", "portable", "tel", "phone", "gsm"],
    partialKeywords: ["telephone", "phone", "mobile", "portable", "tel"],
    technicalNames: ["phone", "tel", "telephone", "mobile", "cellphone", "gsm"],
    expectedTypes: ["tel", "text", "number"]
  },
  {
    canonicalPath: "client.email",
    exactKeywords: ["email", "e mail", "adresse email", "adresse electronique", "courriel", "mail"],
    partialKeywords: ["email", "mail", "courriel"],
    technicalNames: ["email", "e_mail", "mail", "courriel", "user_email"],
    expectedTypes: ["email", "text"]
  },
  {
    canonicalPath: "client.address.street",
    exactKeywords: ["adresse", "adresse postale", "rue", "voie", "adresse ligne 1", "street address", "address"],
    partialKeywords: ["adresse", "street", "rue"],
    technicalNames: ["address", "street", "adresse", "rue", "address_line1"],
    expectedTypes: ["text"]
  },
  {
    canonicalPath: "client.address.postalCode",
    exactKeywords: ["code postal", "code postal client", "cp", "zip code", "postal code", "zipcode"],
    partialKeywords: ["code postal", "cp", "zipcode", "postalcode"],
    technicalNames: ["postalcode", "postal_code", "zip", "zipcode", "cp", "code_postal"],
    expectedTypes: ["text", "number"]
  },
  {
    canonicalPath: "client.address.city",
    exactKeywords: ["ville", "commune", "localite", "city", "town"],
    partialKeywords: ["ville", "city", "commune"],
    technicalNames: ["city", "ville", "town", "commune"],
    expectedTypes: ["text"]
  },
  {
    canonicalPath: "client.address.country",
    exactKeywords: ["pays", "country", "pays de residence"],
    partialKeywords: ["pays", "country"],
    technicalNames: ["country", "pays", "nation"],
    expectedTypes: ["text", "select"]
  },
  // ─── Véhicule ───────────────────────────────────────────────────────────
  {
    canonicalPath: "vehicle.registration",
    exactKeywords: ["immatriculation", "numero immatriculation", "plaque", "matricule", "registration number", "license plate"],
    partialKeywords: ["immatriculation", "matricule", "plaque", "registration"],
    technicalNames: ["registration", "immatriculation", "matricule", "license_plate", "plaque_immat"],
    expectedTypes: ["text"]
  },
  {
    canonicalPath: "vehicle.brand",
    exactKeywords: ["marque", "constructeur", "marque du vehicule", "marque auto", "brand", "make"],
    partialKeywords: ["marque", "constructeur", "brand", "make"],
    technicalNames: ["brand", "marque", "make", "constructeur", "vehicle_brand"],
    expectedTypes: ["text", "select"]
  },
  {
    canonicalPath: "vehicle.model",
    exactKeywords: ["modele", "modele du vehicule", "modele auto", "model"],
    partialKeywords: ["modele", "model"],
    technicalNames: ["model", "modele", "vehicle_model"],
    expectedTypes: ["text", "select"]
  },
  {
    canonicalPath: "vehicle.version",
    exactKeywords: ["version", "finition", "version du vehicule", "finition vehicule", "trim"],
    partialKeywords: ["version", "finition", "trim"],
    technicalNames: ["version", "finition", "trim", "vehicle_version"],
    expectedTypes: ["text", "select"]
  },
  {
    canonicalPath: "vehicle.firstRegistrationDate",
    exactKeywords: ["date de premiere mise en circulation", "1ere mise en circulation", "premiere immatriculation", "date mise en circulation", "date immat"],
    partialKeywords: ["circulation", "premiere mise", "1ere immat"],
    technicalNames: ["first_registration_date", "date_circulation", "date_1ere_immat", "reg_date"],
    expectedTypes: ["date", "text"]
  },
  {
    canonicalPath: "vehicle.fiscalPower",
    exactKeywords: ["puissance fiscale", "chevaux fiscaux", "cv", "puissance cv", "fiscal power", "puissance"],
    partialKeywords: ["puissance fiscale", "chevaux fiscaux", "fiscal power"],
    technicalNames: ["fiscal_power", "puissance_fiscale", "puissance", "cv", "fiscalpower"],
    expectedTypes: ["number", "text"]
  },
  {
    canonicalPath: "vehicle.vehicleValue",
    exactKeywords: ["valeur du vehicule", "valeur a neuf", "valeur venale", "prix d achat", "prix vehicule", "vehicle value"],
    partialKeywords: ["valeur", "prix vehicule", "prix"],
    technicalNames: ["vehicle_value", "valeur_vehicule", "valeur", "valeur_a_neuf", "car_value"],
    expectedTypes: ["number", "text"]
  },
  {
    canonicalPath: "vehicle.vehicleType",
    exactKeywords: ["type de vehicule", "categorie de vehicule", "genre", "carrosserie", "vehicle type"],
    partialKeywords: ["type vehicule", "categorie vehicule", "genre"],
    technicalNames: ["vehicle_type", "type_vehicule", "genre", "category"],
    expectedTypes: ["select", "text"]
  },
  {
    canonicalPath: "vehicle.usage",
    exactKeywords: ["usage", "usage du vehicule", "utilisation du vehicule", "type d usage", "vehicle usage"],
    partialKeywords: ["usage", "utilisation"],
    technicalNames: ["usage", "vehicle_usage", "usage_vehicule"],
    expectedTypes: ["select", "radio", "text"]
  },
  // ─── Conducteur ─────────────────────────────────────────────────────────
  {
    canonicalPath: "driver.licenseDate",
    exactKeywords: ["date d obtention du permis", "date permis", "date d obtention permis", "permis de conduire le", "license date"],
    partialKeywords: ["permis", "license date"],
    technicalNames: ["license_date", "date_permis", "date_obtention_permis", "driver_license_date"],
    expectedTypes: ["date", "text"]
  },
  {
    canonicalPath: "driver.profession",
    exactKeywords: ["profession", "profession du conducteur", "metier", "activite professionnelle", "occupation", "job"],
    partialKeywords: ["profession", "metier", "occupation"],
    technicalNames: ["profession", "metier", "occupation", "job", "driver_profession"],
    expectedTypes: ["text", "select"]
  },
  // ─── Historique ─────────────────────────────────────────────────────────
  {
    canonicalPath: "insuranceHistory.previousInsurer",
    exactKeywords: ["assureur precedent", "compagnie precedente", "precedente compagnie", "ancien assureur", "previous insurer"],
    partialKeywords: ["assureur precedent", "compagnie precedente", "ancien assureur"],
    technicalNames: ["previous_insurer", "compagnie_precedente", "assureur_precedent", "ancien_assureur"],
    expectedTypes: ["text", "select"]
  },
  {
    canonicalPath: "insuranceHistory.seniority",
    exactKeywords: ["anciennete", "anciennete d assurance", "annees d assurance", "duree d assurance"],
    partialKeywords: ["anciennete"],
    technicalNames: ["seniority", "anciennete", "years_insured"],
    expectedTypes: ["number", "text"]
  },
  {
    canonicalPath: "insuranceHistory.bonusMalus",
    exactKeywords: ["bonus malus", "coefficient bonus malus", "crm", "bonus", "malus", "coefficient crm"],
    partialKeywords: ["bonus", "malus", "bonusmalus"],
    technicalNames: ["bonus_malus", "bonusmalus", "coefficient_bonus_malus", "crm_coefficient", "bonus"],
    expectedTypes: ["number", "text"]
  },
  {
    canonicalPath: "insuranceHistory.claimsCount",
    exactKeywords: ["nombre de sinistres", "nombre total de sinistres", "nombre sinistres declares", "total sinistres", "claims count"],
    partialKeywords: ["nombre de sinistres", "sinistres declares", "nb sinistres"],
    technicalNames: ["claims_count", "nb_sinistres", "nombre_sinistres", "total_claims"],
    expectedTypes: ["number", "text"]
  },
  {
    canonicalPath: "insuranceHistory.responsibleClaimsCount",
    exactKeywords: ["sinistres responsables", "nombre de sinistres responsables", "nb sinistres responsables", "responsible claims"],
    partialKeywords: ["sinistres responsables", "responsables"],
    technicalNames: ["responsible_claims", "sinistres_responsables", "nb_sinistres_responsables"],
    expectedTypes: ["number", "text"]
  },
  {
    canonicalPath: "insuranceHistory.nonResponsibleClaimsCount",
    exactKeywords: ["sinistres non responsables", "nombre de sinistres non responsables", "non responsible claims"],
    partialKeywords: ["non responsables"],
    technicalNames: ["non_responsible_claims", "sinistres_non_responsables"],
    expectedTypes: ["number", "text"]
  }
];

// src/shared/utils/text.utils.ts
function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
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
          // substitution
          matrix[i][j - 1] + 1,
          // insertion
          matrix[i - 1][j] + 1
          // suppression
        );
      }
    }
  }
  return matrix[bn][an];
}
function stringSimilarity(a, b) {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA && !normB) return 1;
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
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

// src/content/field-mapper.ts
var FieldMapper = class {
  /**
   * Analyse un champ détecté et retourne les candidats triés par confiance décroissante.
   *
   * Résolution des ambiguïtés client vs driver :
   * On utilise `fieldIndex` (position du champ dans le formulaire) pour désambiguïser
   * les champs "prénom" / "nom" qui apparaissent plusieurs fois.
   * - Les premiers exemplaires appartiennent généralement au client (souscripteur).
   * - Les exemplaires ultérieurs appartiennent au conducteur si le contexte le confirme.
   */
  static findCandidates(field, fieldIndex) {
    const candidates = [];
    for (const group of FIELD_SYNONYMS) {
      const evaluation = this.evaluateFieldForGroup(field, group, fieldIndex);
      if (evaluation.confidence > 0.3) {
        candidates.push({
          canonicalPath: group.canonicalPath,
          confidence: Math.min(1, Math.round(evaluation.confidence * 100) / 100),
          reasons: evaluation.reasons
        });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates;
  }
  /**
   * Évalue l'adéquation d'un champ pour un groupe de synonymes canoniques.
   * Scoring multi-signal (pondéré, somme possible > 1.0 avant clamp à 1.0) :
   *
   * Signal                  | Bonus max
   * ------------------------|----------
   * Label exact             | +0.65
   * Label partiel           | +0.45
   * Label similarité Lev.   | +0.44
   * Placeholder / aria      | +0.20
   * name / id technique     | +0.35
   * Contexte de section     | +0.15
   * Type HTML compatible    | +0.05
   * Options de select       | +0.40
   * Pénalité type incompatible | -0.20
   * Désambiguïsation pos.   | ±0.10
   */
  static evaluateFieldForGroup(field, group, fieldIndex) {
    let score = 0;
    const reasons = [];
    const normLabel = normalizeText(field.label);
    const normPlaceholder = normalizeText(field.placeholder);
    const normAria = normalizeText(field.ariaLabel);
    const normName = normalizeText(field.name);
    const normId = normalizeText(field.id);
    const normSection = normalizeText(field.sectionName);
    const normSurrounding = normalizeText(field.surroundingText);
    if (normLabel) {
      if (group.exactKeywords.some((kw) => normLabel === kw || ` ${normLabel} `.includes(` ${kw} `))) {
        score += 0.65;
        reasons.push(`Libell\xE9 exact : "${field.label}"`);
      } else {
        const matchedKw = group.partialKeywords.find((kw) => containsKeyword(normLabel, kw));
        if (matchedKw) {
          score += 0.45;
          reasons.push(`Mot-cl\xE9 dans le libell\xE9 : "${matchedKw}"`);
        } else {
          let bestSim = 0;
          for (const kw of group.exactKeywords) {
            const sim = stringSimilarity(normLabel, kw);
            if (sim > bestSim) bestSim = sim;
          }
          if (bestSim > 0.75) {
            score += bestSim * 0.44;
            reasons.push(`Similarit\xE9 libell\xE9 (${Math.round(bestSim * 100)}%) : "${field.label}"`);
          }
        }
      }
    }
    const altTexts = [normPlaceholder, normAria, normSurrounding].filter(Boolean);
    for (const alt of altTexts) {
      if (group.exactKeywords.some((kw) => alt === kw || containsKeyword(alt, kw))) {
        score += 0.2;
        reasons.push(`Indice secondaire : "${alt}"`);
        break;
      }
    }
    const techText = `${normName} ${normId}`.trim();
    if (techText.trim()) {
      const matchTech = group.technicalNames.find((tech) => containsKeyword(techText, tech));
      if (matchTech) {
        score += 0.35;
        reasons.push(`Attribut technique : "${matchTech}"`);
      }
    }
    if (normSection) {
      const sectionMatch = this.getSectionBonus(normSection, group.canonicalPath);
      if (sectionMatch.bonus > 0) {
        score += sectionMatch.bonus;
        reasons.push(sectionMatch.reason);
      }
    }
    if (group.expectedTypes && field.type) {
      if (group.expectedTypes.includes(field.type)) {
        score += 0.05;
      } else if (this.isTypeIncompatible(field.type, group)) {
        score -= 0.2;
        reasons.push(`\u26A0 P\xE9nalit\xE9 : type HTML "${field.type}" incompatible`);
      }
    }
    if (field.tagName === "select" && field.options && field.options.length > 0) {
      const selectBonus = this.analyzeSelectOptions(field.options, group.canonicalPath);
      if (selectBonus.bonus > 0) {
        score += selectBonus.bonus;
        reasons.push(selectBonus.reason);
      }
    }
    if (fieldIndex !== void 0) {
      const disambig = this.disambiguateClientVsDriver(group.canonicalPath, fieldIndex, field);
      if (disambig.adjustment !== 0) {
        score += disambig.adjustment;
        reasons.push(disambig.reason);
      }
    }
    return { confidence: Math.max(0, Math.min(1, score)), reasons };
  }
  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Bonus contextuel selon le nom de la section et le domaine canonique.
   */
  static getSectionBonus(normSection, canonicalPath) {
    const SECTION_RULES = [
      {
        paths: ["client."],
        keywords: ["client", "souscripteur", "assure", "adherent", "contact", "coordonnees", "identification"],
        bonus: 0.15,
        label: "Client / Souscripteur"
      },
      {
        paths: ["driver."],
        keywords: ["conducteur", "pilote", "driver", "chauffeur", "principal"],
        bonus: 0.15,
        label: "Conducteur"
      },
      {
        paths: ["vehicle."],
        keywords: ["vehicule", "voiture", "auto", "automobile", "bien", "objet", "vehicle"],
        bonus: 0.15,
        label: "V\xE9hicule"
      },
      {
        paths: ["insuranceHistory."],
        keywords: ["historique", "sinistre", "antecedent", "assurance precedente", "anciennete", "resiliation"],
        bonus: 0.15,
        label: "Historique / Sinistres"
      }
    ];
    for (const rule of SECTION_RULES) {
      if (rule.paths.some((p) => canonicalPath.startsWith(p))) {
        if (rule.keywords.some((kw) => containsKeyword(normSection, kw))) {
          return { bonus: rule.bonus, reason: `Contexte de section : "${rule.label}"` };
        }
      }
    }
    return { bonus: 0, reason: "" };
  }
  /**
   * Détecte si le type HTML est fondamentalement incompatible avec le canonicalPath.
   * Exemples d'incompatibilités :
   * - type="number" pour client.firstName (un prénom n'est pas un nombre)
   * - type="date" pour vehicle.fiscalPower (une puissance n'est pas une date)
   */
  static isTypeIncompatible(htmlType, group) {
    if (!group.expectedTypes) return false;
    const numericPaths = [
      "vehicle.fiscalPower",
      "vehicle.vehicleValue",
      "insuranceHistory.seniority",
      "insuranceHistory.bonusMalus",
      "insuranceHistory.claimsCount",
      "insuranceHistory.responsibleClaimsCount",
      "insuranceHistory.nonResponsibleClaimsCount"
    ];
    const datePaths = [
      "client.birthDate",
      "driver.birthDate",
      "driver.licenseDate",
      "vehicle.firstRegistrationDate",
      "insuranceHistory.previousContractStartDate",
      "insuranceHistory.previousContractEndDate",
      "insuranceHistory.terminationDate"
    ];
    const textOnlyPaths = ["client.firstName", "client.lastName", "driver.firstName", "driver.lastName"];
    if (textOnlyPaths.includes(group.canonicalPath) && htmlType === "number") return true;
    if (numericPaths.includes(group.canonicalPath) && htmlType === "date") return true;
    if (datePaths.includes(group.canonicalPath) && htmlType === "number") return true;
    return false;
  }
  /**
   * Analyse sémantique des options d'un <select> pour identifier son contenu.
   */
  static analyzeSelectOptions(options, canonicalPath) {
    const normTexts = options.map((o) => normalizeText(o.text));
    if (canonicalPath === "vehicle.brand") {
      const brands = ["peugeot", "renault", "citroen", "volkswagen", "fiat", "toyota", "audi", "bmw", "mercedes", "ford", "opel", "seat", "skoda"];
      const count = normTexts.filter((t) => brands.some((b) => t.includes(b))).length;
      if (count >= 2) return { bonus: 0.4, reason: `Select contient des marques (${count} trouv\xE9es)` };
    }
    if (canonicalPath === "vehicle.usage") {
      const usages = ["prive", "promenade", "travail", "professionnel", "transport", "marchandise", "commute"];
      const count = normTexts.filter((t) => usages.some((u) => t.includes(u))).length;
      if (count >= 2) return { bonus: 0.35, reason: "Select contient des usages de v\xE9hicule" };
    }
    if (canonicalPath === "vehicle.vehicleType") {
      const types = ["voiture", "camion", "moto", "utilitaire", "monospace", "berline", "suv", "break"];
      const count = normTexts.filter((t) => types.some((tp) => t.includes(tp))).length;
      if (count >= 1) return { bonus: 0.3, reason: "Select contient des types de v\xE9hicule" };
    }
    if (canonicalPath === "client.address.country") {
      const countries = ["france", "tunisie", "maroc", "algerie", "belgique", "suisse", "canada"];
      const count = normTexts.filter((t) => countries.some((c) => t.includes(c))).length;
      if (count >= 2) return { bonus: 0.35, reason: "Select contient des pays" };
    }
    return { bonus: 0, reason: "" };
  }
  /**
   * Désambiguïsation client vs driver selon la position du champ dans le formulaire.
   *
   * Logique :
   * - Un formulaire typique place les champs du CLIENT avant ceux du CONDUCTEUR.
   * - Si le champ est parmi les 10 premiers ET qu'on hésiterait entre client.X et driver.X,
   *   on favorise client.X avec un bonus.
   * - Si le champ est dans la moitié basse du formulaire, on favorise driver.X.
   * - Le contexte de section prime toujours sur cet heuristique.
   */
  static disambiguateClientVsDriver(canonicalPath, fieldIndex, field) {
    if (field.sectionName) return { adjustment: 0, reason: "" };
    const isClientPath = canonicalPath.startsWith("client.");
    const isDriverPath = canonicalPath.startsWith("driver.");
    if (!isClientPath && !isDriverPath) return { adjustment: 0, reason: "" };
    if (fieldIndex < 10 && isClientPath) {
      return { adjustment: 0.08, reason: "Heuristique : position pr\xE9coce \u2192 client probable" };
    }
    if (fieldIndex > 12 && isDriverPath) {
      return { adjustment: 0.08, reason: "Heuristique : position tardive \u2192 conducteur probable" };
    }
    if (fieldIndex < 10 && isDriverPath) {
      return { adjustment: -0.05, reason: "Heuristique : position pr\xE9coce \u2192 conducteur moins probable" };
    }
    return { adjustment: 0, reason: "" };
  }
};

// src/content/confidence-scorer.ts
var DEFAULT_THRESHOLDS = {
  autoMatch: 0.85,
  needsConfirm: 0.6
};
var ConfidenceScorer = class {
  /**
   * Évalue un champ détecté et produit le `FieldMapping` enrichi avec valeur canonique résolue.
   *
   * @param field         Champ détecté dans le DOM
   * @param quoteData     Données canoniques disponibles (optionnel)
   * @param fieldIndex    Position du champ dans la liste (pour désambiguïsation)
   * @param thresholds    Seuils personnalisables (par défaut 0.85 / 0.60)
   */
  static scoreField(field, quoteData, fieldIndex, thresholds = DEFAULT_THRESHOLDS) {
    const candidates = FieldMapper.findCandidates(field, fieldIndex);
    if (candidates.length === 0) {
      return {
        field,
        canonicalPath: null,
        confidence: 0,
        reasons: ["Aucune correspondance dans le dictionnaire canonique"],
        status: "UNMATCHED" /* UNMATCHED */
      };
    }
    const best = candidates[0];
    let status;
    if (candidates.length >= 2 && best.confidence - candidates[1].confidence < 0.05) {
      if (best.confidence >= thresholds.autoMatch) {
        status = "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */;
      } else if (best.confidence >= thresholds.needsConfirm) {
        status = "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */;
      } else {
        status = "UNMATCHED" /* UNMATCHED */;
      }
      best.reasons.push(`\u26A0 Ambigu\xEFt\xE9 avec "${candidates[1].canonicalPath}" (\u0394 ${Math.round((best.confidence - candidates[1].confidence) * 100)}%)`);
    } else {
      if (best.confidence >= thresholds.autoMatch) {
        status = "MATCHED" /* MATCHED */;
      } else if (best.confidence >= thresholds.needsConfirm) {
        status = "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */;
      } else {
        status = "UNMATCHED" /* UNMATCHED */;
      }
    }
    let resolvedValue = void 0;
    let epistemicBlockReason = void 0;
    if (quoteData && best.canonicalPath) {
      const access = getCanonicalValue(quoteData, best.canonicalPath);
      if (access.knowledge === "DECLARED_UNKNOWN" /* DECLARED_UNKNOWN */) {
        epistemicBlockReason = "Information explicitement d\xE9clar\xE9e inconnue \u2014 ne pas remplir.";
      } else if (access.knowledge === "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */) {
        epistemicBlockReason = 'Information marqu\xE9e "\xE0 confirmer" \u2014 validation manuelle requise.';
        resolvedValue = access.value;
        if (status === "MATCHED" /* MATCHED */) {
          status = "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */;
        }
      } else if (access.knowledge === "UNKNOWN" /* UNKNOWN */ || access.value === null || access.value === void 0) {
        epistemicBlockReason = "Information non renseign\xE9e dans le dossier.";
      } else if (access.knowledge === "KNOWN" /* KNOWN */) {
        resolvedValue = access.value;
      }
    }
    return {
      field,
      canonicalPath: best.canonicalPath,
      confidence: best.confidence,
      reasons: best.reasons,
      status,
      resolvedValue,
      epistemicBlockReason,
      source: "local-fallback"
    };
  }
  /**
   * Évalue un mapping validé provenant de l'IA (Gemini) et applique la sécurité épistémique
   * ainsi que les seuils de confiance standards.
   */
  static buildMappingFromValidated(field, canonicalPath, confidence, reason, quoteData, thresholds = DEFAULT_THRESHOLDS, source = "gemini") {
    const clampedConfidence = Math.max(0, Math.min(1, confidence));
    let status = "UNMATCHED" /* UNMATCHED */;
    if (canonicalPath) {
      if (clampedConfidence >= thresholds.autoMatch) {
        status = "MATCHED" /* MATCHED */;
      } else if (clampedConfidence >= thresholds.needsConfirm) {
        status = "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */;
      } else {
        status = "UNMATCHED" /* UNMATCHED */;
      }
    } else {
      status = "UNMATCHED" /* UNMATCHED */;
    }
    let resolvedValue = void 0;
    let epistemicBlockReason = void 0;
    if (quoteData && canonicalPath) {
      const access = getCanonicalValue(quoteData, canonicalPath);
      if (access.knowledge === "DECLARED_UNKNOWN" /* DECLARED_UNKNOWN */) {
        epistemicBlockReason = "Information explicitement d\xE9clar\xE9e inconnue \u2014 ne pas remplir.";
      } else if (access.knowledge === "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */) {
        epistemicBlockReason = 'Information marqu\xE9e "\xE0 confirmer" \u2014 validation manuelle requise.';
        resolvedValue = access.value;
        if (status === "MATCHED" /* MATCHED */) {
          status = "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */;
        }
      } else if (access.knowledge === "UNKNOWN" /* UNKNOWN */ || access.value === null || access.value === void 0) {
        epistemicBlockReason = "Information non renseign\xE9e dans le dossier.";
      } else if (access.knowledge === "KNOWN" /* KNOWN */) {
        resolvedValue = access.value;
      }
    }
    return {
      field,
      canonicalPath,
      confidence: clampedConfidence,
      reasons: [reason],
      status,
      resolvedValue,
      epistemicBlockReason,
      source
    };
  }
  /**
   * Score un tableau de champs en transmettant l'index (pour désambiguïsation positionnelle).
   */
  static scoreFields(fields, quoteData, thresholds = DEFAULT_THRESHOLDS) {
    return fields.map((field, index) => this.scoreField(field, quoteData, index, thresholds));
  }
};

// src/content/dom-analyzer.ts
var DOMAnalyzer = class {
  /**
   * Extrait tous les signaux contextuels d'un élément de formulaire.
   */
  static extractSignals(element) {
    return {
      label: this.findAssociatedLabel(element),
      placeholder: element.getAttribute("placeholder") || null,
      ariaLabel: this.findAriaLabel(element),
      surroundingText: this.findSurroundingText(element),
      sectionName: this.findSectionName(element),
      options: element.tagName.toLowerCase() === "select" ? this.extractSelectOptions(element) : void 0,
      dataAttributes: this.extractDataAttributes(element)
    };
  }
  // ─────────────────────────────────────────────────────────────────────────
  // LABEL ASSOCIÉ
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Trouve le label associé via plusieurs stratégies prioritaires.
   *
   * Priorité :
   * 1. aria-labelledby (peut contenir plusieurs IDs)
   * 2. <label for="id">
   * 3. Parent <label> (input imbriqué)
   * 4. Angular Material (mat-label dans mat-form-field)
   * 5. Bootstrap / classes communes (form-group, form-field)
   * 6. Élément frère précédent avec texte
   * 7. Attribut title / aria-label (fallback)
   */
  static findAssociatedLabel(element) {
    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const labelText = ariaLabelledBy.trim().split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" ");
      if (labelText) return labelText;
    }
    if (element.id) {
      const labelElem = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      const text = labelElem?.textContent?.trim();
      if (text) return text;
    }
    const parentLabel = element.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input, select, textarea").forEach((el) => el.remove());
      const text = clone.textContent?.trim();
      if (text) return text;
    }
    const matFormField = element.closest("mat-form-field, .mat-form-field, .mat-mdc-form-field");
    if (matFormField) {
      const matLabel = matFormField.querySelector(
        "mat-label, .mat-form-field-label, .mdc-floating-label, .mat-mdc-floating-label"
      );
      const text = matLabel?.textContent?.trim();
      if (text) return text;
    }
    const formGroup = element.closest(".form-group, .form-field, .field-wrapper, .input-group, .form-item");
    if (formGroup) {
      const labelInGroup = formGroup.querySelector("label, .label, .field-label, .form-label");
      const text = labelInGroup?.textContent?.trim();
      if (text && text.length < 120) return text;
    }
    const TEXT_SIBLINGS = ["LABEL", "SPAN", "DIV", "P", "STRONG", "B", "DT", "TH", "H3", "H4"];
    let prev = element.previousElementSibling;
    for (let i = 0; i < 3 && prev; i++) {
      if (TEXT_SIBLINGS.includes(prev.tagName)) {
        const text = prev.textContent?.trim();
        if (text && text.length > 1 && text.length < 120) {
          if (!prev.querySelector("input, select, textarea")) {
            return text;
          }
        }
      }
      prev = prev.previousElementSibling;
    }
    const parent = element.parentElement;
    if (parent) {
      for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text && text.length > 1 && text.length < 80) {
            return text;
          }
        }
      }
    }
    return null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // ARIA-LABEL
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Extrait le label accessible (aria-label, title).
   */
  static findAriaLabel(element) {
    return element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("data-label") || null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // NOM DE SECTION
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Trouve le nom de la section ou du groupe de formulaire parent.
   *
   * Stratégies :
   * 1. <fieldset><legend>
   * 2. Section avec titre (h1-h4 proche)
   * 3. Carte / Panel avec titre
   * 4. Angular Material mat-card
   * 5. Steppers (Angular Material ou natifs)
   */
  static findSectionName(element) {
    const fieldset = element.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector(":scope > legend");
      const text = legend?.textContent?.trim();
      if (text) return text;
    }
    const step = element.closest('mat-step, [class*="step-"], .wizard-step, .form-step');
    if (step) {
      const header = step.querySelector('[class*="step-label"], mat-step-header, .step-title');
      const text = header?.textContent?.trim();
      if (text) return text;
    }
    const container = element.closest("section, article, .card, .mat-card, .mat-mdc-card, .form-section, .panel, .accordion-item, .step");
    if (container) {
      const titleElem = container.querySelector(
        "h1, h2, h3, h4, h5, mat-panel-title, .card-title, .panel-title, .section-title, .form-section-title"
      );
      const text = titleElem?.textContent?.trim();
      if (text && text.length < 100) return text;
    }
    let ancestor = element.parentElement;
    let depth = 0;
    while (ancestor && depth < 5) {
      const prevSibling = ancestor.previousElementSibling;
      if (prevSibling && /^H[1-6]$/.test(prevSibling.tagName)) {
        const text = prevSibling.textContent?.trim();
        if (text && text.length < 100) return text;
      }
      ancestor = ancestor.parentElement;
      depth++;
    }
    return null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // TEXTE ENVIRONNANT
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Extrait le texte environnant proche (en-tête de colonne de tableau, span proche).
   */
  static findSurroundingText(element) {
    const cell = element.closest("td");
    if (cell && cell.parentElement) {
      const table = cell.closest("table");
      const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
      if (table && cellIndex >= 0) {
        const headerCell = table.querySelector(`thead th:nth-child(${cellIndex + 1}), thead td:nth-child(${cellIndex + 1})`);
        const text = headerCell?.textContent?.trim();
        if (text) return text;
      }
    }
    const row = element.closest("tr");
    if (row) {
      const th = row.querySelector("th");
      const text = th?.textContent?.trim();
      if (text && text.length < 80) return text;
    }
    const parent = element.parentElement;
    if (parent) {
      const hint = parent.querySelector('.hint, .help-text, .field-description, [class*="hint"], [class*="helper"]');
      const text = hint?.textContent?.trim();
      if (text && text.length < 80) return text;
    }
    return null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // OPTIONS SELECT
  // ─────────────────────────────────────────────────────────────────────────
  static extractSelectOptions(select) {
    const options = [];
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      const text = opt.text.trim();
      if (opt.value !== "" || text !== "") {
        options.push({ value: opt.value, text });
      }
    }
    return options;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // DATA-ATTRIBUTES
  // ─────────────────────────────────────────────────────────────────────────
  static extractDataAttributes(element) {
    const result = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.startsWith("data-") && !attr.name.startsWith("data-autofill")) {
        result[attr.name] = attr.value;
      }
    }
    return result;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // TRANSFORMATION EN SCHÉMA COMPACT (POUR L'IA / GEMINI)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Convertit un DetectedField en une représentation sémantique compacte épurée
   * de toute information DOM interne (sélecteurs, scripts, tokens techniques).
   */
  static toCompactField(field) {
    const compact = {
      id: field.elementId,
      label: field.label || null,
      name: field.name || null,
      type: field.type || field.tagName
    };
    if (field.placeholder) {
      compact.placeholder = field.placeholder;
    }
    if (field.sectionName) {
      compact.section = field.sectionName;
    }
    if (field.ariaLabel) {
      compact.ariaLabel = field.ariaLabel;
    }
    if (field.surroundingText) {
      compact.surroundingText = field.surroundingText;
    }
    if (field.options && field.options.length > 0) {
      compact.options = field.options.map((opt) => ({
        value: opt.value,
        label: opt.text
      }));
    }
    return compact;
  }
  /**
   * Convertit une liste de DetectedField en un schéma compact complet pour analyse IA.
   */
  static toCompactSchema(fields, pageContext) {
    return {
      page: pageContext,
      fields: fields.map((f) => this.toCompactField(f))
    };
  }
};

// src/content/field-detector.ts
var FieldDetector = class {
  /** Types d'input ignorés d'office (boutons, tokens techniques, mots de passe) */
  static IGNORED_INPUT_TYPES = /* @__PURE__ */ new Set([
    "submit",
    "button",
    "reset",
    "image",
    "hidden",
    "password",
    "file"
  ]);
  /** Noms techniques fréquemment utilisés pour des tokens CSRF ou non-métier */
  static IGNORED_NAMES = [
    "_token",
    "csrf",
    "csrf_token",
    "authenticity_token",
    "__requestverificationtoken"
  ];
  /**
   * Scanne le DOM (ou un conteneur donné) et retourne la liste de tous les champs détectés.
   */
  static detectFields(root = document) {
    const selector = "input, select, textarea";
    const elements = Array.from(root.querySelectorAll(selector));
    const detected = [];
    let counter = 0;
    for (const el of elements) {
      if (this.shouldIgnoreElement(el)) {
        continue;
      }
      counter++;
      const elementId = `autofill_field_${counter}_${Date.now()}`;
      el.dataset["autofillId"] = elementId;
      const tagName = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || (tagName === "select" ? "select" : tagName === "textarea" ? "textarea" : "text")).toLowerCase();
      const signals = DOMAnalyzer.extractSignals(el);
      const detectedField = {
        elementId,
        selector: `[data-autofill-id="${elementId}"]`,
        tagName,
        type,
        name: el.name || el.getAttribute("name") || null,
        id: el.id || null,
        label: signals.label,
        placeholder: signals.placeholder,
        ariaLabel: signals.ariaLabel,
        surroundingText: signals.surroundingText,
        sectionName: signals.sectionName,
        options: signals.options,
        currentValue: el.value,
        dataAttributes: signals.dataAttributes,
        isInteractable: !el.disabled && !("readOnly" in el && el.readOnly)
      };
      detected.push(detectedField);
    }
    return detected;
  }
  /**
   * Filtre les éléments non pertinents pour le remplissage de données de devis.
   */
  static shouldIgnoreElement(el) {
    const tagName = el.tagName.toLowerCase();
    if (tagName === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (this.IGNORED_INPUT_TYPES.has(type)) {
        return true;
      }
    }
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getClientRects().length) {
      if (el.style.display === "none" || el.style.visibility === "hidden") {
        return true;
      }
    }
    const name = (el.name || el.id || "").toLowerCase();
    if (this.IGNORED_NAMES.some((ign) => name.includes(ign))) {
      return true;
    }
    return false;
  }
};

// src/content/form-fingerprint.ts
function fnv1aHash(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function buildFieldSignaturePayload(field) {
  const optionsSignature = (field.options || []).map((option) => `${normalizeText(option.text)}:${normalizeText(option.value)}`).join("|");
  return JSON.stringify({
    id: field.id || "",
    name: field.name || "",
    label: normalizeText(field.label),
    type: field.type || "",
    placeholder: normalizeText(field.placeholder),
    section: normalizeText(field.sectionName),
    options: optionsSignature
  });
}
function computeFieldKey(field, order) {
  return `${order}_${fnv1aHash(buildFieldSignaturePayload(field))}`;
}
function computeFormFingerprint(fields) {
  const combined = fields.map((field, index) => `${index}:${buildFieldSignaturePayload(field)}`).join("\xA7");
  return fnv1aHash(combined);
}
function buildFieldStructure(fields) {
  return fields.map((field, index) => ({
    fieldKey: computeFieldKey(field, index),
    name: field.name,
    label: field.label,
    type: field.type,
    section: field.sectionName,
    order: index
  }));
}
function buildFormMemoryKey(origin, formFingerprint) {
  return `${origin}::${formFingerprint}`;
}

// src/content/form-filler.ts
var FormFiller = class {
  /**
   * Remplit un ensemble de champs mappés.
   */
  static fillFields(mappings) {
    console.log(`[FormAgent][Fill] D\xE9but du remplissage pour ${mappings.length} champ(s)...`);
    const results = mappings.map((m) => this.fillSingleField(m));
    const successCount = results.filter((r) => r.success).length;
    console.log(`[FormAgent][Fill] Remplissage termin\xE9 : ${successCount}/${results.length} succ\xE8s.`);
    return results;
  }
  /**
   * Point d'entrée principal pour remplir un champ unique.
   * Stratégie : détecter le framework → appliquer la méthode adaptée.
   */
  static fillSingleField(mapping) {
    const base = {
      elementId: mapping.field.elementId,
      selector: mapping.field.selector,
      canonicalPath: mapping.canonicalPath || ""
    };
    const element = this.resolveElement(mapping);
    if (!element) {
      return { ...base, valueFilled: null, success: false, errorMessage: "\xC9l\xE9ment introuvable dans le DOM" };
    }
    const value = mapping.resolvedValue;
    if (value === null || value === void 0) {
      return { ...base, valueFilled: null, success: false, errorMessage: "Aucune valeur \xE0 injecter" };
    }
    try {
      const tagName = element.tagName.toLowerCase();
      const fw = this.detectFramework(element);
      if (tagName === "select") {
        this.fillNativeSelect(element, String(value));
      } else if (this.isPseudoSelect(element)) {
        this.fillPseudoSelect(element, String(value));
      } else if (tagName === "textarea") {
        this.fillTextLike(element, String(value), fw);
      } else if (tagName === "input") {
        const input = element;
        const type = (input.getAttribute("type") || "text").toLowerCase();
        if (type === "checkbox") {
          this.fillCheckbox(input, Boolean(value));
        } else if (type === "radio") {
          this.fillRadioGroup(element, String(value));
        } else {
          this.fillTextLike(input, String(value), fw);
        }
      }
      this.applyFeedback(element);
      return { ...base, valueFilled: value, success: true };
    } catch (err) {
      return { ...base, valueFilled: value, success: false, errorMessage: err?.message || "Erreur interne" };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // RÉSOLUTION DE L'ÉLÉMENT — Stratégie multi-sélecteur
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Résout l'élément DOM depuis le champ mappé via plusieurs stratégies de fallback.
   *
   * Stratégie 1 : data-autofill-id (posé lors de la détection — fiable si pas de rerender)
   * Stratégie 2 : id HTML (stable si l'ID n'est pas dynamique)
   * Stratégie 3 : name + tagName + type (moins précis, mais fonctionne après rerender Angular)
   * Stratégie 4 : position dans le formulaire (nth-input) — dernier recours
   */
  static resolveElement(mapping) {
    const f = mapping.field;
    if (f.elementId) {
      const el2 = document.querySelector(`[data-autofill-id="${CSS.escape(f.elementId)}"]`);
      if (el2) return el2;
    }
    if (f.id) {
      const el2 = document.getElementById(f.id);
      if (el2) return el2;
    }
    if (f.name && f.tagName) {
      const typeAttr = f.type && f.type !== f.tagName ? `[type="${f.type}"]` : "";
      const selector = `${f.tagName}[name="${CSS.escape(f.name)}"]${typeAttr}`;
      const el2 = document.querySelector(selector);
      if (el2) return el2;
    }
    const el = document.querySelector(f.selector);
    if (el) return el;
    return null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // DÉTECTION DU FRAMEWORK
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Détecte le framework SPA utilisé par l'élément.
   *
   * React   : présence de __reactFiber* ou __reactProps* sur l'élément
   * Angular : présence de __ngContext ou ng-reflect-* attributes
   * Vue     : présence de __vue* ou _vei (Vue Event Internals)
   */
  static detectFramework(element) {
    const keys = Object.keys(element);
    if (keys.some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternals") || k.startsWith("__reactProps"))) {
      return "react";
    }
    if (element.__ngContext !== void 0 || Array.from(element.attributes).some((a) => a.name.startsWith("ng-reflect") || a.name.startsWith("_nghost") || a.name.startsWith("_ngcontent"))) {
      return "angular";
    }
    if (element.__vue__ !== void 0 || element.__vueParentComponent !== void 0 || element._vei !== void 0) {
      return "vue";
    }
    return "native";
  }
  // ─────────────────────────────────────────────────────────────────────────
  // REMPLISSAGE TEXTE (input text/number/date/email/tel + textarea)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Remplit un champ texte en utilisant la stratégie adaptée au framework détecté.
   *
   * - Native    : setter natif + Event('input') + Event('change')
   * - Angular   : setter natif + InputEvent(inputType='insertText') + Event('change') + Event('blur')
   * - React     : setter natif via Object.getOwnPropertyDescriptor (bypass React) + InputEvent
   * - Vue       : setter natif + InputEvent (v-model écoute event.target.value)
   */
  static fillTextLike(element, value, framework) {
    const isTextArea = element.tagName.toLowerCase() === "textarea";
    element.focus();
    element.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    const proto = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }
    switch (framework) {
      case "react":
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: "insertText"
          })
        );
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        break;
      case "angular":
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: "insertText",
            composed: true
            // Important pour traverser les Shadow DOM
          })
        );
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
        break;
      case "vue":
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: "insertText"
          })
        );
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        break;
      default:
        element.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: value }));
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        break;
    }
    element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }
  // ─────────────────────────────────────────────────────────────────────────
  // SELECT NATIF
  // ─────────────────────────────────────────────────────────────────────────
  static fillNativeSelect(select, targetValue) {
    select.focus();
    const normTarget = normalizeText(targetValue);
    let matchedIndex = -1;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === targetValue) {
        matchedIndex = i;
        break;
      }
    }
    if (matchedIndex === -1) {
      for (let i = 0; i < select.options.length; i++) {
        const optText = normalizeText(select.options[i].text);
        if (optText === normTarget || optText.includes(normTarget) || normTarget.includes(optText)) {
          matchedIndex = i;
          break;
        }
      }
    }
    if (matchedIndex === -1) {
      for (let i = 0; i < select.options.length; i++) {
        const optText = normalizeText(select.options[i].text);
        const words = normTarget.split(" ").filter((w) => w.length > 2);
        if (words.length > 0 && words.every((w) => optText.includes(w))) {
          matchedIndex = i;
          break;
        }
      }
    }
    if (matchedIndex !== -1) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "selectedIndex"
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(select, matchedIndex);
      } else {
        select.selectedIndex = matchedIndex;
      }
      select.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      select.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      select.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // PSEUDO-SELECTS (mat-select, ng-select, div[role=listbox], etc.)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Détecte si un élément est un pseudo-select (composant dropdown custom).
   */
  static isPseudoSelect(element) {
    const role = element.getAttribute("role");
    if (role === "listbox" || role === "combobox") return true;
    const tag = element.tagName.toLowerCase();
    if (tag === "mat-select" || tag === "ng-select") return true;
    const matFormField = element.closest("mat-form-field");
    if (matFormField && matFormField.querySelector("mat-select")) return true;
    return false;
  }
  /**
   * Remplit un pseudo-select via simulation de clic + navigation clavier.
   *
   * Stratégie :
   * 1. Cliquer sur le déclencheur pour ouvrir le dropdown
   * 2. Attendre l'apparition des options dans le DOM (overlay)
   * 3. Trouver l'option correspondante et la cliquer
   * 4. Fermer si nécessaire
   */
  static fillPseudoSelect(element, targetValue) {
    const normTarget = normalizeText(targetValue);
    const trigger = element.querySelector('.mat-select-trigger, [role="button"], .ng-arrow-wrapper, .dropdown-toggle') || (element.getAttribute("role") === "combobox" ? element : null) || element;
    if (!trigger) return;
    trigger.click();
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    setTimeout(() => {
      const optionSelectors = [
        "mat-option",
        '[role="option"]',
        ".ng-option",
        ".dropdown-item",
        "li[data-value]"
      ].join(", ");
      const allOptions = Array.from(document.querySelectorAll(optionSelectors));
      if (allOptions.length === 0) return;
      let bestOption = null;
      bestOption = allOptions.find((opt) => {
        const text = normalizeText(opt.textContent || "");
        const val = normalizeText(opt.getAttribute("data-value") || opt.getAttribute("value") || "");
        return text === normTarget || val === normTarget;
      }) || null;
      if (!bestOption) {
        bestOption = allOptions.find((opt) => {
          const text = normalizeText(opt.textContent || "");
          return text.includes(normTarget) || normTarget.includes(text);
        }) || null;
      }
      if (bestOption) {
        bestOption.click();
        bestOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        bestOption.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      } else {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
    }, 150);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // CHECKBOX
  // ─────────────────────────────────────────────────────────────────────────
  static fillCheckbox(input, targetState) {
    const fw = this.detectFramework(input);
    if (input.checked !== targetState) {
      if (fw === "react" || fw === "angular" || fw === "vue") {
        const nativeChecker = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "checked"
        )?.set;
        if (nativeChecker) {
          nativeChecker.call(input, targetState);
        }
        input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      } else {
        input.click();
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // RADIO
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Remplit un groupe de radio buttons en cherchant tous les radios avec le même name.
   */
  static fillRadioGroup(element, targetValue) {
    const input = element;
    const normTarget = normalizeText(targetValue);
    const groupName = input.name;
    const candidates = groupName ? Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`)) : [input];
    let matched = null;
    matched = candidates.find((r) => r.value === targetValue) || null;
    if (!matched) {
      matched = candidates.find((r) => normalizeText(r.value) === normTarget) || null;
    }
    if (!matched) {
      matched = candidates.find((r) => {
        const labelText = r.labels?.[0]?.textContent || "";
        return normalizeText(labelText) === normTarget || normalizeText(labelText).includes(normTarget);
      }) || null;
    }
    if (matched && !matched.checked) {
      const fw = this.detectFramework(matched);
      if (fw !== "native") {
        const nativeChecker = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "checked"
        )?.set;
        if (nativeChecker) nativeChecker.call(matched, true);
        matched.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        matched.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      } else {
        matched.click();
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // FEEDBACK VISUEL
  // ─────────────────────────────────────────────────────────────────────────
  static applyFeedback(element) {
    const prev = { outline: element.style.outline, transition: element.style.transition };
    element.style.transition = "outline 0.3s ease";
    element.style.outline = "2px solid #22c55e";
    setTimeout(() => {
      element.style.outline = prev.outline;
      element.style.transition = prev.transition;
    }, 2500);
  }
};

// src/content/gemini-response-validator.ts
var GeminiResponseValidator = class {
  /**
   * Valide rigoureusement la réponse renvoyée par Gemini contre les champs DOM réels
   * et le catalogue fermé de 32 chemins canoniques.
   *
   * RÈGLE : Ne jamais faire confiance aveuglément à Gemini (source non fiable).
   */
  static validate(response, detectedFields) {
    const validMappings = [];
    const rejectedMappings = [];
    const fieldMap = /* @__PURE__ */ new Map();
    for (const field of detectedFields) {
      fieldMap.set(field.elementId, field);
    }
    const processedFieldIds = /* @__PURE__ */ new Set();
    if (!response || typeof response !== "object") {
      return {
        validMappings: [],
        rejectedMappings: [],
        unmappedFields: detectedFields,
        summary: "R\xE9ponse Gemini invalide : contenu non-objet."
      };
    }
    const typedResponse = response;
    const rawMappings = Array.isArray(typedResponse.mappings) ? typedResponse.mappings : [];
    for (const item of rawMappings) {
      if (!item || typeof item !== "object") continue;
      const fieldId = String(item.fieldId || "");
      const detectedField = fieldMap.get(fieldId);
      if (!detectedField) {
        rejectedMappings.push({
          fieldId,
          detectedField: {
            elementId: fieldId,
            selector: "",
            tagName: "input",
            type: "text",
            name: null,
            id: null,
            label: null,
            placeholder: null,
            ariaLabel: null,
            surroundingText: null,
            sectionName: null,
            isInteractable: false
          },
          canonicalPath: null,
          confidence: 0,
          reason: `Champ "${fieldId}" inexistant dans le formulaire analys\xE9.`,
          isValid: false,
          validationError: "FIELD_NOT_FOUND"
        });
        continue;
      }
      processedFieldIds.add(fieldId);
      let canonicalPath = item.canonicalPath;
      let confidence = typeof item.confidence === "number" ? item.confidence : 0;
      confidence = Math.max(0, Math.min(1, confidence));
      const reason = String(item.reason || "Correspondance identifi\xE9e par Gemini");
      const suggestedValue = item.suggestedValue;
      if (canonicalPath !== null && canonicalPath !== void 0 && canonicalPath !== "") {
        const pathStr = String(canonicalPath);
        if (!isValidCanonicalPath(pathStr)) {
          rejectedMappings.push({
            fieldId,
            detectedField,
            canonicalPath: null,
            confidence: 0,
            reason: `Chemin non valide "${pathStr}" rejet\xE9 (hors catalogue ferm\xE9).`,
            isValid: false,
            validationError: "HALLUCINATED_PATH"
          });
          continue;
        }
        canonicalPath = pathStr;
      } else {
        canonicalPath = null;
      }
      validMappings.push({
        fieldId,
        detectedField,
        canonicalPath,
        confidence,
        reason,
        suggestedValue,
        isValid: true
      });
    }
    const unmappedFields = [];
    for (const field of detectedFields) {
      if (!processedFieldIds.has(field.elementId)) {
        unmappedFields.push(field);
      }
    }
    return {
      validMappings,
      rejectedMappings,
      unmappedFields,
      model: typedResponse.model,
      summary: typedResponse.summary
    };
  }
};

// src/content/mapping-validator.ts
var MappingValidator = class {
  /**
   * Vérifie si un mapping est prêt et autorisé pour le remplissage automatique.
   */
  static isEligibleForAutoFill(mapping) {
    if (mapping.status !== "MATCHED" /* MATCHED */ && mapping.status !== "CONFIRMED" /* CONFIRMED */) {
      return false;
    }
    if (mapping.epistemicBlockReason) {
      return false;
    }
    if (mapping.resolvedValue === void 0 || mapping.resolvedValue === null) {
      return false;
    }
    if (!mapping.field.isInteractable) {
      return false;
    }
    return true;
  }
  /**
   * Filtre la liste des mappings pour ne conserver que ceux prêts pour l'injection.
   */
  static getFillableMappings(mappings) {
    return mappings.filter((m) => this.isEligibleForAutoFill(m));
  }
};

// src/content/step-detector.ts
var NEXT_BUTTON_LABELS = [
  "suivant",
  "continuer",
  "etape suivante",
  "valider et continuer",
  "poursuivre",
  "next",
  "continue"
];
var STEP_TEXT_REGEX = /(?:etape|step)\s+(\d+)\s*(?:sur|of|de)?\s*(\d+)/;
function isNextButtonLabel(rawText) {
  const text = normalizeText(rawText);
  if (!text) return false;
  return NEXT_BUTTON_LABELS.some((label) => text.includes(label));
}
function parseStepFromText(rawText) {
  const text = normalizeText(rawText);
  const match = text.match(STEP_TEXT_REGEX);
  if (!match) return null;
  return { currentStep: parseInt(match[1], 10), totalSteps: parseInt(match[2], 10) };
}
var StepDetector = class _StepDetector {
  static detect(root = document) {
    const matStep = _StepDetector.detectAngularMaterialStepper(root);
    if (matStep) {
      return { ...matStep, nextButtonFound: _StepDetector.findNextButton(root) !== null };
    }
    const textStep = _StepDetector.detectStepFromText(root);
    if (textStep) {
      return { ...textStep, nextButtonFound: _StepDetector.findNextButton(root) !== null };
    }
    return {
      currentStep: null,
      totalSteps: null,
      stepLabel: null,
      nextButtonFound: _StepDetector.findNextButton(root) !== null
    };
  }
  static detectAngularMaterialStepper(root) {
    const headers = Array.from(
      root.querySelectorAll("mat-step-header, .mat-step-header, .mat-horizontal-stepper-header")
    );
    if (headers.length === 0) return null;
    let currentIndex = -1;
    headers.forEach((el, idx) => {
      const isSelected = el.getAttribute("aria-selected") === "true" || el.classList.contains("mat-step-header-selected") || el.classList.contains("cdk-step-selected") || el.classList.contains("mat-step-header-active");
      if (isSelected) currentIndex = idx;
    });
    return {
      currentStep: currentIndex >= 0 ? currentIndex + 1 : null,
      totalSteps: headers.length,
      stepLabel: currentIndex >= 0 ? (headers[currentIndex].textContent || "").trim().slice(0, 80) : null
    };
  }
  static detectStepFromText(root) {
    const candidates = Array.from(root.querySelectorAll('h1, h2, h3, [class*="step"], [class*="progress"]'));
    for (const el of candidates) {
      const text = (el.textContent || "").trim();
      const parsed = parseStepFromText(text);
      if (parsed) {
        return { ...parsed, stepLabel: text.slice(0, 80) };
      }
    }
    return null;
  }
  static findNextButton(root = document) {
    const candidates = Array.from(root.querySelectorAll('button, a, input[type="submit"], input[type="button"]'));
    for (const el of candidates) {
      const text = el.textContent || el.value || "";
      if (isNextButtonLabel(text)) return el;
    }
    return null;
  }
  /** Déclenche le clic réel sur le bouton "suivant" détecté (jamais de soumission finale/signature). */
  static clickNextButton(root = document) {
    const btn = _StepDetector.findNextButton(root);
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }
};

// src/content/content-script.ts
var currentRun = null;
var dynamicObserver = null;
var activeSessionId = null;
var lastAnalyzedFingerprint = null;
var now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DETECT_FIELDS") {
    handleDetectFields(message.quoteData).then((run) => sendResponse({ success: true, run })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "EXECUTE_FILL") {
    handleExecuteFill(message.mappings).then((run) => sendResponse({ success: true, run })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "UPDATE_MAPPING_STATUS") {
    if (currentRun) {
      const mapping = currentRun.mappings.find((m) => m.field.elementId === message.elementId);
      if (mapping) {
        mapping.status = message.newStatus;
        if (message.newCanonicalPath) {
          mapping.canonicalPath = message.newCanonicalPath;
        }
      }
      sendResponse({ success: true, run: currentRun });
    }
    return false;
  }
  if (message.type === "RESUME_SESSION") {
    activeSessionId = message.sessionId;
    handleDetectFields().then((run) => sendResponse({ success: true, run })).catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "RESET_SESSION") {
    activeSessionId = null;
    lastAnalyzedFingerprint = null;
    sendResponse({ success: true });
    return false;
  }
  if (message.type === "CLICK_NEXT_STEP") {
    const clicked = StepDetector.clickNextButton();
    sendResponse({ success: clicked });
    return false;
  }
  if (message.type === "PING") {
    sendResponse({ type: "PONG" });
    return false;
  }
});
async function handleDetectFields(quoteDataParam) {
  const analysisStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  const totalStart = now();
  let quoteData = quoteDataParam;
  if (!quoteData) {
    quoteData = await new Promise((resolve) => {
      chrome.storage.local.get(["quoteData"], (result) => {
        resolve(result.quoteData);
      });
    });
  }
  const detected = FieldDetector.detectFields();
  console.log(`[FormAgent][DOM] ${detected.length} champs d\xE9tect\xE9s dans le formulaire.`);
  const fingerprintStart = now();
  const formFingerprint = computeFormFingerprint(detected);
  const fingerprintDuration = now() - fingerprintStart;
  const memoryKey = buildFormMemoryKey(window.location.hostname, formFingerprint);
  const cacheLookupStart = now();
  const cachedMemory = await getFormMemory(memoryKey);
  const cacheLookupDuration = now() - cacheLookupStart;
  let mappings = [];
  let geminiDuration = 0;
  let geminiCalled = false;
  const cacheHit = Boolean(cachedMemory);
  const pageContext = {
    title: document.title || "",
    url: window.location.href,
    hostname: window.location.hostname
  };
  const formSchema = DOMAnalyzer.toCompactSchema(detected, pageContext);
  if (cachedMemory) {
    console.log("[Form Agent] Form memory HIT");
    mappings = applyCachedMemory(detected, cachedMemory, quoteData);
  } else if (quoteData && detected.length > 0) {
    console.log("[Form Agent] Form memory MISS \u2192 Gemini");
    try {
      console.log("[FormAgent][Gemini] Envoi du sch\xE9ma compact au service worker...");
      const geminiRequest = {
        formSchema,
        availableData: quoteData,
        allowedCanonicalPaths: CANONICAL_PATHS
      };
      geminiCalled = true;
      const geminiStart = now();
      const geminiResponse = await callGeminiAnalysis(geminiRequest);
      geminiDuration = now() - geminiStart;
      if (geminiResponse.success && geminiResponse.response) {
        console.log(`[FormAgent][Gemini] R\xE9ponse re\xE7ue avec ${geminiResponse.response.mappings?.length || 0} proposition(s).`);
        const validated = GeminiResponseValidator.validate(geminiResponse.response, detected);
        console.log(`[FormAgent][Validator] Validation r\xE9ussie : ${validated.validMappings.length} valide(s), ${validated.rejectedMappings.length} rejet\xE9(s).`);
        const validatedMap = new Map(validated.validMappings.map((v) => [v.fieldId, v]));
        mappings = detected.map((field) => {
          const validatedItem = validatedMap.get(field.elementId);
          if (validatedItem && validatedItem.canonicalPath) {
            return ConfidenceScorer.buildMappingFromValidated(
              field,
              validatedItem.canonicalPath,
              validatedItem.confidence,
              validatedItem.reason,
              quoteData,
              void 0,
              "gemini"
            );
          } else if (validatedItem && !validatedItem.canonicalPath) {
            return ConfidenceScorer.buildMappingFromValidated(
              field,
              null,
              0,
              validatedItem.reason || "Aucune correspondance identifi\xE9e par Gemini",
              quoteData,
              void 0,
              "gemini"
            );
          } else {
            return ConfidenceScorer.buildMappingFromValidated(
              field,
              null,
              0,
              "Champ non reconnu par Gemini",
              quoteData,
              void 0,
              "gemini"
            );
          }
        });
        console.log("[FormAgent][Mapping] Pipeline Gemini appliqu\xE9 avec succ\xE8s.");
        await saveFormMemory(buildFormMemory(memoryKey, formFingerprint, detected, mappings));
      } else {
        throw new Error(geminiResponse.error || "R\xE9ponse Gemini non concluante");
      }
    } catch (err) {
      console.warn("[FormAgent][Fallback] Basculement sur le moteur local d\xE9terministe :", err?.message || err);
      mappings = ConfidenceScorer.scoreFields(detected, quoteData);
      console.log(`[FormAgent][Fallback] ${mappings.length} champs trait\xE9s par le fallback local.`);
    }
  } else {
    console.log("[FormAgent][Fallback] Traitement via moteur local direct.");
    mappings = ConfidenceScorer.scoreFields(detected, quoteData);
  }
  const sessionContext = identifySessionContext(window.location.href);
  const sessionKey = buildSessionKey(sessionContext);
  const stepInfo = StepDetector.detect();
  const session = await loadOrCreateSession(sessionKey, sessionContext);
  mappings = applySessionAnswers(mappings, session.userAnswers);
  updateSessionProgress(session, stepInfo, formFingerprint, mappings);
  activeSessionId = session.sessionId;
  await saveQuoteSession(session);
  lastAnalyzedFingerprint = formFingerprint;
  const matched = mappings.filter((m) => m.status === "MATCHED" /* MATCHED */).length;
  const needsConfirm = mappings.filter((m) => m.status === "NEEDS_CONFIRMATION" /* NEEDS_CONFIRMATION */).length;
  const unmatched = mappings.filter((m) => m.status === "UNMATCHED" /* UNMATCHED */).length;
  const stepInfoForRun = {
    currentStep: session.currentStep,
    totalSteps: session.totalSteps,
    label: stepInfo.stepLabel,
    nextButtonFound: stepInfo.nextButtonFound
  };
  currentRun = {
    runId: `run_${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: window.location.href,
    hostname: window.location.hostname,
    mappings,
    totalDetected: detected.length,
    totalMatched: matched,
    totalNeedsConfirmation: needsConfirm,
    totalUnmatched: unmatched,
    sessionId: session.sessionId,
    stepInfo: stepInfoForRun,
    metrics: {
      fingerprintDuration,
      cacheLookupDuration,
      geminiDuration,
      totalAnalysisDuration: now() - totalStart,
      cacheHit,
      geminiCalled,
      analysisStartedAt,
      analysisCompletedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
  setupDynamicFieldsObserver();
  return currentRun;
}
function applyCachedMemory(detected, memory, quoteData) {
  const mappingByKey = new Map(memory.validatedMappings.map((m) => [m.fieldKey, m]));
  return detected.map((field, index) => {
    const fieldKey = computeFieldKey(field, index);
    const cachedEntry = mappingByKey.get(fieldKey);
    if (cachedEntry) {
      return ConfidenceScorer.buildMappingFromValidated(
        field,
        cachedEntry.canonicalPath,
        cachedEntry.confidence,
        cachedEntry.reason,
        quoteData,
        void 0,
        "form-memory"
      );
    }
    return ConfidenceScorer.buildMappingFromValidated(
      field,
      null,
      0,
      "Champ absent de la m\xE9moire du formulaire",
      quoteData,
      void 0,
      "form-memory"
    );
  });
}
function buildFormMemory(memoryKey, formFingerprint, detected, mappings) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const validatedMappings = detected.map((field, index) => {
    const mapping = mappings[index];
    return {
      fieldKey: computeFieldKey(field, index),
      canonicalPath: mapping?.canonicalPath ?? null,
      confidence: mapping?.confidence ?? 0,
      reason: mapping?.reasons?.[0] || ""
    };
  });
  return {
    memoryKey,
    origin: window.location.hostname,
    product: null,
    formFingerprint,
    fieldStructure: buildFieldStructure(detected),
    validatedMappings,
    createdAt: timestamp,
    lastUsedAt: timestamp,
    version: FORM_MEMORY_VERSION
  };
}
function applySessionAnswers(mappings, userAnswers) {
  return mappings.map((mapping) => {
    if (!mapping.canonicalPath) return mapping;
    const answer = userAnswers[mapping.canonicalPath];
    if (answer === void 0) return mapping;
    return {
      ...mapping,
      resolvedValue: answer,
      status: "CONFIRMED" /* CONFIRMED */,
      epistemicBlockReason: void 0,
      userProvidedValue: answer,
      source: "user-answer"
    };
  });
}
function createNewSession(sessionKey, context) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionKey,
    origin: context.origin,
    product: context.product,
    quoteId: null,
    quoteNumber: null,
    quoteStatus: null,
    quoteDate: null,
    currentStep: 1,
    totalSteps: null,
    steps: [],
    completedFields: {},
    userAnswers: {},
    detectedQuotes: [],
    status: "in_progress",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastVisitedAt: timestamp
  };
}
function updateSessionProgress(session, stepInfo, formFingerprint, mappings) {
  const stepIndex = stepInfo.currentStep ?? session.steps.length + 1;
  session.currentStep = stepIndex;
  session.totalSteps = stepInfo.totalSteps ?? session.totalSteps;
  const alreadyRecorded = session.steps.some((s) => s.formFingerprint === formFingerprint);
  if (!alreadyRecorded) {
    const completedFieldCount = mappings.filter(
      (m) => m.resolvedValue !== void 0 && m.resolvedValue !== null
    ).length;
    const step = {
      stepIndex,
      label: stepInfo.stepLabel,
      formFingerprint,
      completedFieldCount,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    session.steps.push(step);
  }
  for (const mapping of mappings) {
    if (mapping.canonicalPath && mapping.resolvedValue !== void 0 && mapping.resolvedValue !== null) {
      session.completedFields[mapping.canonicalPath] = true;
    }
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  session.updatedAt = timestamp;
  session.lastVisitedAt = timestamp;
}
async function loadOrCreateSession(sessionKey, context) {
  if (activeSessionId) {
    const existing = await getQuoteSession(activeSessionId);
    if (existing) return existing;
  }
  return createNewSession(sessionKey, context);
}
function getFormMemory(memoryKey) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_FORM_MEMORY", memoryKey },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve(null);
          return;
        }
        resolve(response.memory || null);
      }
    );
  });
}
function saveFormMemory(memory) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SAVE_FORM_MEMORY", memory }, () => resolve());
  });
}
function getQuoteSession(sessionId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_QUOTE_SESSION", sessionId },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve(null);
          return;
        }
        resolve(response.session || null);
      }
    );
  });
}
function saveQuoteSession(session) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SAVE_QUOTE_SESSION", session }, () => resolve());
  });
}
function callGeminiAnalysis(request) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "ANALYZE_WITH_GEMINI", request },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            type: "GEMINI_ANALYSIS_RESPONSE",
            success: false,
            error: chrome.runtime.lastError.message,
            errorCode: "RUNTIME_ERROR"
          });
        } else if (response) {
          resolve(response);
        } else {
          resolve({
            type: "GEMINI_ANALYSIS_RESPONSE",
            success: false,
            error: "Pas de r\xE9ponse du Service Worker",
            errorCode: "NO_RESPONSE"
          });
        }
      }
    );
  });
}
async function handleExecuteFill(mappingsToFill) {
  const mappings = mappingsToFill || currentRun?.mappings || [];
  const fillable = MappingValidator.getFillableMappings(mappings);
  const fillResults = FormFiller.fillFields(fillable);
  if (currentRun) {
    currentRun.fillResults = fillResults;
    currentRun.totalFilled = fillResults.filter((r) => r.success).length;
  }
  return currentRun || {
    runId: `run_${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: window.location.href,
    hostname: window.location.hostname,
    mappings,
    fillResults,
    totalDetected: mappings.length,
    totalMatched: 0,
    totalNeedsConfirmation: 0,
    totalUnmatched: 0,
    totalFilled: fillResults.filter((r) => r.success).length
  };
}
function setupDynamicFieldsObserver() {
  if (dynamicObserver) {
    dynamicObserver.disconnect();
  }
  let debounceTimer;
  dynamicObserver = new MutationObserver((mutations) => {
    const hasFormMutation = mutations.some(
      (m) => Array.from(m.addedNodes).some((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n;
          return el.matches?.("input, select, textarea, mat-form-field, .form-group") || el.querySelector?.("input, select, textarea");
        }
        return false;
      })
    );
    if (hasFormMutation) {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        handlePotentialStepChange();
      }, 600);
    }
  });
  dynamicObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}
async function handlePotentialStepChange() {
  if (!activeSessionId) return;
  const detected = FieldDetector.detectFields();
  if (detected.length === 0) return;
  const fingerprint = computeFormFingerprint(detected);
  if (fingerprint === lastAnalyzedFingerprint) return;
  console.log("[Form Agent] Nouvelle structure de formulaire d\xE9tect\xE9e (changement d'\xE9tape SPA).");
  try {
    const run = await handleDetectFields();
    chrome.runtime.sendMessage({ type: "AUTO_STEP_DETECTED", run }, () => {
      void chrome.runtime.lastError;
    });
  } catch (err) {
    console.warn("[Form Agent] \xC9chec de la r\xE9-analyse automatique :", err);
  }
}
export {
  applySessionAnswers,
  createNewSession,
  updateSessionProgress
};
//# sourceMappingURL=content-script.js.map
