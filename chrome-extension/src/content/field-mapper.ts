import { CanonicalPath } from '../models/canonical-paths';
import { DetectedField } from '../models/detected-field.model';
import { FIELD_SYNONYMS, FieldSynonymGroup } from '../shared/constants/synonyms.constants';
import { containsKeyword, normalizeText, stringSimilarity } from '../shared/utils/text.utils';

export interface ScoredCandidate {
  canonicalPath: CanonicalPath;
  confidence: number;
  reasons: string[];
}

export class FieldMapper {
  /**
   * Analyse un champ détecté et retourne les candidats triés par confiance décroissante.
   *
   * Résolution des ambiguïtés client vs driver :
   * On utilise `fieldIndex` (position du champ dans le formulaire) pour désambiguïser
   * les champs "prénom" / "nom" qui apparaissent plusieurs fois.
   * - Les premiers exemplaires appartiennent généralement au client (souscripteur).
   * - Les exemplaires ultérieurs appartiennent au conducteur si le contexte le confirme.
   */
  static findCandidates(field: DetectedField, fieldIndex?: number): ScoredCandidate[] {
    const candidates: ScoredCandidate[] = [];

    for (const group of FIELD_SYNONYMS) {
      const evaluation = this.evaluateFieldForGroup(field, group, fieldIndex);
      if (evaluation.confidence > 0.3) {
        candidates.push({
          canonicalPath: group.canonicalPath,
          confidence: Math.min(1.0, Math.round(evaluation.confidence * 100) / 100),
          reasons: evaluation.reasons,
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
  private static evaluateFieldForGroup(
    field: DetectedField,
    group: FieldSynonymGroup,
    fieldIndex?: number
  ): { confidence: number; reasons: string[] } {
    let score = 0.0;
    const reasons: string[] = [];

    const normLabel = normalizeText(field.label);
    const normPlaceholder = normalizeText(field.placeholder);
    const normAria = normalizeText(field.ariaLabel);
    const normName = normalizeText(field.name);
    const normId = normalizeText(field.id);
    const normSection = normalizeText(field.sectionName);
    const normSurrounding = normalizeText(field.surroundingText);

    // ─── 1. Label principal ────────────────────────────────────────────────
    if (normLabel) {
      if (group.exactKeywords.some((kw) => normLabel === kw || ` ${normLabel} `.includes(` ${kw} `))) {
        score += 0.65;
        reasons.push(`Libellé exact : "${field.label}"`);
      } else {
        const matchedKw = group.partialKeywords.find((kw) => containsKeyword(normLabel, kw));
        if (matchedKw) {
          score += 0.45;
          reasons.push(`Mot-clé dans le libellé : "${matchedKw}"`);
        } else {
          let bestSim = 0;
          for (const kw of group.exactKeywords) {
            const sim = stringSimilarity(normLabel, kw);
            if (sim > bestSim) bestSim = sim;
          }
          if (bestSim > 0.75) {
            score += bestSim * 0.44;
            reasons.push(`Similarité libellé (${Math.round(bestSim * 100)}%) : "${field.label}"`);
          }
        }
      }
    }

    // ─── 2. Placeholder et aria-label ─────────────────────────────────────
    const altTexts = [normPlaceholder, normAria, normSurrounding].filter(Boolean) as string[];
    for (const alt of altTexts) {
      if (group.exactKeywords.some((kw) => alt === kw || containsKeyword(alt, kw))) {
        score += 0.20;
        reasons.push(`Indice secondaire : "${alt}"`);
        break; // Un seul bonus pour ce signal
      }
    }

    // ─── 3. Attributs techniques name / id ────────────────────────────────
    const techText = `${normName} ${normId}`.trim();
    if (techText.trim()) {
      const matchTech = group.technicalNames.find((tech) => containsKeyword(techText, tech));
      if (matchTech) {
        score += 0.35;
        reasons.push(`Attribut technique : "${matchTech}"`);
      }
    }

    // ─── 4. Contexte de section ────────────────────────────────────────────
    if (normSection) {
      const sectionMatch = this.getSectionBonus(normSection, group.canonicalPath);
      if (sectionMatch.bonus > 0) {
        score += sectionMatch.bonus;
        reasons.push(sectionMatch.reason);
      }
    }

    // ─── 5. Type HTML — bonus compatibilité / pénalité incompatibilité ────
    if (group.expectedTypes && field.type) {
      if (group.expectedTypes.includes(field.type)) {
        score += 0.05;
      } else if (this.isTypeIncompatible(field.type, group)) {
        score -= 0.20;
        reasons.push(`⚠ Pénalité : type HTML "${field.type}" incompatible`);
      }
    }

    // ─── 6. Options de <select> (analyse sémantique du contenu) ──────────
    if (field.tagName === 'select' && field.options && field.options.length > 0) {
      const selectBonus = this.analyzeSelectOptions(field.options, group.canonicalPath);
      if (selectBonus.bonus > 0) {
        score += selectBonus.bonus;
        reasons.push(selectBonus.reason);
      }
    }

    // ─── 7. Désambiguïsation client vs driver par position ────────────────
    if (fieldIndex !== undefined) {
      const disambig = this.disambiguateClientVsDriver(group.canonicalPath, fieldIndex, field);
      if (disambig.adjustment !== 0) {
        score += disambig.adjustment;
        reasons.push(disambig.reason);
      }
    }

    return { confidence: Math.max(0, Math.min(1.0, score)), reasons };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bonus contextuel selon le nom de la section et le domaine canonique.
   */
  private static getSectionBonus(
    normSection: string,
    canonicalPath: string
  ): { bonus: number; reason: string } {
    const SECTION_RULES: Array<{
      paths: string[];
      keywords: string[];
      bonus: number;
      label: string;
    }> = [
      {
        paths: ['client.'],
        keywords: ['client', 'souscripteur', 'assure', 'adherent', 'contact', 'coordonnees', 'identification'],
        bonus: 0.15,
        label: 'Client / Souscripteur',
      },
      {
        paths: ['driver.'],
        keywords: ['conducteur', 'pilote', 'driver', 'chauffeur', 'principal'],
        bonus: 0.15,
        label: 'Conducteur',
      },
      {
        paths: ['vehicle.'],
        keywords: ['vehicule', 'voiture', 'auto', 'automobile', 'bien', 'objet', 'vehicle'],
        bonus: 0.15,
        label: 'Véhicule',
      },
      {
        paths: ['insuranceHistory.'],
        keywords: ['historique', 'sinistre', 'antecedent', 'assurance precedente', 'anciennete', 'resiliation'],
        bonus: 0.15,
        label: 'Historique / Sinistres',
      },
    ];

    for (const rule of SECTION_RULES) {
      if (rule.paths.some((p) => canonicalPath.startsWith(p))) {
        if (rule.keywords.some((kw) => containsKeyword(normSection, kw))) {
          return { bonus: rule.bonus, reason: `Contexte de section : "${rule.label}"` };
        }
      }
    }

    return { bonus: 0, reason: '' };
  }

  /**
   * Détecte si le type HTML est fondamentalement incompatible avec le canonicalPath.
   * Exemples d'incompatibilités :
   * - type="number" pour client.firstName (un prénom n'est pas un nombre)
   * - type="date" pour vehicle.fiscalPower (une puissance n'est pas une date)
   */
  private static isTypeIncompatible(htmlType: string, group: FieldSynonymGroup): boolean {
    if (!group.expectedTypes) return false;

    const numericPaths = [
      'vehicle.fiscalPower', 'vehicle.vehicleValue',
      'insuranceHistory.seniority', 'insuranceHistory.bonusMalus',
      'insuranceHistory.claimsCount', 'insuranceHistory.responsibleClaimsCount',
      'insuranceHistory.nonResponsibleClaimsCount',
    ];

    const datePaths = [
      'client.birthDate', 'driver.birthDate', 'driver.licenseDate',
      'vehicle.firstRegistrationDate', 'insuranceHistory.previousContractStartDate',
      'insuranceHistory.previousContractEndDate', 'insuranceHistory.terminationDate',
    ];

    const textOnlyPaths = ['client.firstName', 'client.lastName', 'driver.firstName', 'driver.lastName'];

    if (textOnlyPaths.includes(group.canonicalPath) && htmlType === 'number') return true;
    if (numericPaths.includes(group.canonicalPath) && htmlType === 'date') return true;
    if (datePaths.includes(group.canonicalPath) && htmlType === 'number') return true;

    return false;
  }

  /**
   * Analyse sémantique des options d'un <select> pour identifier son contenu.
   */
  private static analyzeSelectOptions(
    options: Array<{ value: string; text: string }>,
    canonicalPath: string
  ): { bonus: number; reason: string } {
    const normTexts = options.map((o) => normalizeText(o.text));

    if (canonicalPath === 'vehicle.brand') {
      const brands = ['peugeot', 'renault', 'citroen', 'volkswagen', 'fiat', 'toyota', 'audi', 'bmw', 'mercedes', 'ford', 'opel', 'seat', 'skoda'];
      const count = normTexts.filter((t) => brands.some((b) => t.includes(b))).length;
      if (count >= 2) return { bonus: 0.40, reason: `Select contient des marques (${count} trouvées)` };
    }

    if (canonicalPath === 'vehicle.usage') {
      const usages = ['prive', 'promenade', 'travail', 'professionnel', 'transport', 'marchandise', 'commute'];
      const count = normTexts.filter((t) => usages.some((u) => t.includes(u))).length;
      if (count >= 2) return { bonus: 0.35, reason: 'Select contient des usages de véhicule' };
    }

    if (canonicalPath === 'vehicle.vehicleType') {
      const types = ['voiture', 'camion', 'moto', 'utilitaire', 'monospace', 'berline', 'suv', 'break'];
      const count = normTexts.filter((t) => types.some((tp) => t.includes(tp))).length;
      if (count >= 1) return { bonus: 0.30, reason: 'Select contient des types de véhicule' };
    }

    if (canonicalPath === 'client.address.country') {
      const countries = ['france', 'tunisie', 'maroc', 'algerie', 'belgique', 'suisse', 'canada'];
      const count = normTexts.filter((t) => countries.some((c) => t.includes(c))).length;
      if (count >= 2) return { bonus: 0.35, reason: 'Select contient des pays' };
    }

    return { bonus: 0, reason: '' };
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
  private static disambiguateClientVsDriver(
    canonicalPath: string,
    fieldIndex: number,
    field: DetectedField
  ): { adjustment: number; reason: string } {
    // Si la section est déjà identifiée, pas besoin d'heuristique
    if (field.sectionName) return { adjustment: 0, reason: '' };

    const isClientPath = canonicalPath.startsWith('client.');
    const isDriverPath = canonicalPath.startsWith('driver.');

    if (!isClientPath && !isDriverPath) return { adjustment: 0, reason: '' };

    // Heuristique : champ parmi les 10 premiers → favorise client
    if (fieldIndex < 10 && isClientPath) {
      return { adjustment: 0.08, reason: 'Heuristique : position précoce → client probable' };
    }

    // Heuristique : champ après le 12ème → favorise driver
    if (fieldIndex > 12 && isDriverPath) {
      return { adjustment: 0.08, reason: 'Heuristique : position tardive → conducteur probable' };
    }

    // Légère pénalité pour éviter les doublons
    if (fieldIndex < 10 && isDriverPath) {
      return { adjustment: -0.05, reason: 'Heuristique : position précoce → conducteur moins probable' };
    }

    return { adjustment: 0, reason: '' };
  }
}
