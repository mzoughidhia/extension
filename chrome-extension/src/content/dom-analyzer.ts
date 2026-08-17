import { DetectedField, SelectOption } from '../models/detected-field.model';
import { CompactField, CompactFormSchema, CompactPageContext } from '../models/gemini-schema.model';

export interface ExtractedSignals {
  label: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  surroundingText: string | null;
  sectionName: string | null;
  options?: SelectOption[];
  dataAttributes?: Record<string, string>;
}

export class DOMAnalyzer {
  /**
   * Extrait tous les signaux contextuels d'un élément de formulaire.
   */
  static extractSignals(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): ExtractedSignals {
    return {
      label: this.findAssociatedLabel(element),
      placeholder: element.getAttribute('placeholder') || null,
      ariaLabel: this.findAriaLabel(element),
      surroundingText: this.findSurroundingText(element),
      sectionName: this.findSectionName(element),
      options:
        element.tagName.toLowerCase() === 'select'
          ? this.extractSelectOptions(element as HTMLSelectElement)
          : undefined,
      dataAttributes: this.extractDataAttributes(element),
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
  static findAssociatedLabel(element: HTMLElement): string | null {
    // 1. aria-labelledby (peut contenir plusieurs IDs séparés par espaces)
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelText = ariaLabelledBy
        .trim()
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(' ');
      if (labelText) return labelText;
    }

    // 2. <label for="id">
    if (element.id) {
      const labelElem = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      const text = labelElem?.textContent?.trim();
      if (text) return text;
    }

    // 3. Parent <label>
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, select, textarea').forEach((el) => el.remove());
      const text = clone.textContent?.trim();
      if (text) return text;
    }

    // 4. Angular Material — mat-form-field avec mat-label
    const matFormField = element.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field');
    if (matFormField) {
      // Angular Material : le label est dans mat-label ou .mat-form-field-label
      const matLabel = matFormField.querySelector(
        'mat-label, .mat-form-field-label, .mdc-floating-label, .mat-mdc-floating-label'
      );
      const text = matLabel?.textContent?.trim();
      if (text) return text;
    }

    // 5. Bootstrap / classes communes
    const formGroup = element.closest('.form-group, .form-field, .field-wrapper, .input-group, .form-item');
    if (formGroup) {
      const labelInGroup = formGroup.querySelector('label, .label, .field-label, .form-label');
      const text = labelInGroup?.textContent?.trim();
      if (text && text.length < 120) return text;
    }

    // 6. Frère précédent avec texte (span, label, div, p, strong, b, dt)
    const TEXT_SIBLINGS = ['LABEL', 'SPAN', 'DIV', 'P', 'STRONG', 'B', 'DT', 'TH', 'H3', 'H4'];
    let prev: Element | null = element.previousElementSibling;
    // Remonter jusqu'à 3 frères en arrière
    for (let i = 0; i < 3 && prev; i++) {
      if (TEXT_SIBLINGS.includes(prev.tagName)) {
        const text = prev.textContent?.trim();
        if (text && text.length > 1 && text.length < 120) {
          // Éviter les éléments qui contiennent eux-mêmes des inputs (faux positifs)
          if (!prev.querySelector('input, select, textarea')) {
            return text;
          }
        }
      }
      prev = prev.previousElementSibling;
    }

    // 7. Chercher dans le parent direct un texte de nœud
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
  static findAriaLabel(element: HTMLElement): string | null {
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.getAttribute('data-label') ||
      null
    );
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
  static findSectionName(element: HTMLElement): string | null {
    // 1. <fieldset><legend>
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector(':scope > legend');
      const text = legend?.textContent?.trim();
      if (text) return text;
    }

    // 2. Stepper step (Angular Material)
    const step = element.closest('mat-step, [class*="step-"], .wizard-step, .form-step');
    if (step) {
      const header = step.querySelector('[class*="step-label"], mat-step-header, .step-title');
      const text = header?.textContent?.trim();
      if (text) return text;
    }

    // 3. Section/article/div avec un titre heading
    const container = element.closest('section, article, .card, .mat-card, .mat-mdc-card, .form-section, .panel, .accordion-item, .step');
    if (container) {
      // Chercher le titre le plus proche (premier heading dans le container)
      const titleElem = container.querySelector(
        'h1, h2, h3, h4, h5, mat-panel-title, .card-title, .panel-title, .section-title, .form-section-title'
      );
      const text = titleElem?.textContent?.trim();
      if (text && text.length < 100) return text;
    }

    // 4. Titre précédant l'élément dans le DOM parent (heading frère)
    let ancestor: HTMLElement | null = element.parentElement;
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
  static findSurroundingText(element: HTMLElement): string | null {
    // 1. En-tête de colonne de tableau
    const cell = element.closest('td');
    if (cell && cell.parentElement) {
      const table = cell.closest('table');
      const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
      if (table && cellIndex >= 0) {
        const headerCell = table.querySelector(`thead th:nth-child(${cellIndex + 1}), thead td:nth-child(${cellIndex + 1})`);
        const text = headerCell?.textContent?.trim();
        if (text) return text;
      }
    }

    // 2. Texte dans un <th> ou <caption> proche
    const row = element.closest('tr');
    if (row) {
      const th = row.querySelector('th');
      const text = th?.textContent?.trim();
      if (text && text.length < 80) return text;
    }

    // 3. Texte d'un <span class="hint|help|description"> proche
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

  static extractSelectOptions(select: HTMLSelectElement): SelectOption[] {
    const options: SelectOption[] = [];
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      const text = opt.text.trim();
      // Ignorer les options placeholder vides comme "-- Choisir --"
      if (opt.value !== '' || text !== '') {
        options.push({ value: opt.value, text });
      }
    }
    return options;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA-ATTRIBUTES
  // ─────────────────────────────────────────────────────────────────────────

  static extractDataAttributes(element: HTMLElement): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.startsWith('data-') && !attr.name.startsWith('data-autofill')) {
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
  static toCompactField(field: DetectedField): CompactField {
    const compact: CompactField = {
      id: field.elementId,
      label: field.label || null,
      name: field.name || null,
      type: field.type || field.tagName,
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
        label: opt.text,
      }));
    }

    return compact;
  }

  /**
   * Convertit une liste de DetectedField en un schéma compact complet pour analyse IA.
   */
  static toCompactSchema(
    fields: DetectedField[],
    pageContext?: CompactPageContext
  ): CompactFormSchema {
    return {
      page: pageContext,
      fields: fields.map((f) => this.toCompactField(f)),
    };
  }
}
