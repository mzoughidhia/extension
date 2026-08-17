import { FieldFillResult } from '../models/automation-run.model';
import { FieldMapping } from '../models/field-mapping.model';
import { normalizeText } from '../shared/utils/text.utils';

/**
 * Framework détecté sur l'élément.
 */
type DetectedFramework = 'react' | 'angular' | 'vue' | 'native';

export class FormFiller {
  /**
   * Remplit un ensemble de champs mappés.
   */
  static fillFields(mappings: FieldMapping[]): FieldFillResult[] {
    console.log(`[FormAgent][Fill] Début du remplissage pour ${mappings.length} champ(s)...`);
    const results = mappings.map((m) => this.fillSingleField(m));
    const successCount = results.filter((r) => r.success).length;
    console.log(`[FormAgent][Fill] Remplissage terminé : ${successCount}/${results.length} succès.`);
    return results;
  }

  /**
   * Point d'entrée principal pour remplir un champ unique.
   * Stratégie : détecter le framework → appliquer la méthode adaptée.
   */
  static fillSingleField(mapping: FieldMapping): FieldFillResult {
    const base = {
      elementId: mapping.field.elementId,
      selector: mapping.field.selector,
      canonicalPath: mapping.canonicalPath || '',
    };

    const element = this.resolveElement(mapping);
    if (!element) {
      return { ...base, valueFilled: null, success: false, errorMessage: 'Élément introuvable dans le DOM' };
    }

    const value = mapping.resolvedValue;
    if (value === null || value === undefined) {
      return { ...base, valueFilled: null, success: false, errorMessage: 'Aucune valeur à injecter' };
    }

    try {
      const tagName = element.tagName.toLowerCase();
      const fw = this.detectFramework(element);

      if (tagName === 'select') {
        this.fillNativeSelect(element as HTMLSelectElement, String(value));
      } else if (this.isPseudoSelect(element)) {
        this.fillPseudoSelect(element, String(value));
      } else if (tagName === 'textarea') {
        this.fillTextLike(element as HTMLTextAreaElement, String(value), fw);
      } else if (tagName === 'input') {
        const input = element as HTMLInputElement;
        const type = (input.getAttribute('type') || 'text').toLowerCase();
        if (type === 'checkbox') {
          this.fillCheckbox(input, Boolean(value));
        } else if (type === 'radio') {
          this.fillRadioGroup(element, String(value));
        } else {
          this.fillTextLike(input, String(value), fw);
        }
      }

      this.applyFeedback(element);

      return { ...base, valueFilled: value, success: true };
    } catch (err: any) {
      return { ...base, valueFilled: value, success: false, errorMessage: err?.message || 'Erreur interne' };
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
  private static resolveElement(mapping: FieldMapping): HTMLElement | null {
    const f = mapping.field;

    // Stratégie 1 : data-autofill-id
    if (f.elementId) {
      const el = document.querySelector<HTMLElement>(`[data-autofill-id="${CSS.escape(f.elementId)}"]`);
      if (el) return el;
    }

    // Stratégie 2 : id HTML stable
    if (f.id) {
      const el = document.getElementById(f.id);
      if (el) return el;
    }

    // Stratégie 3 : name + tagName + type combinés
    if (f.name && f.tagName) {
      const typeAttr = f.type && f.type !== f.tagName ? `[type="${f.type}"]` : '';
      const selector = `${f.tagName}[name="${CSS.escape(f.name)}"]${typeAttr}`;
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el;
    }

    // Stratégie 4 : data-autofill-id posé directement sur l'élément (fallback)
    const el = document.querySelector<HTMLElement>(f.selector);
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
  static detectFramework(element: HTMLElement): DetectedFramework {
    // React (16+ utilise __reactFiber, React 17+ utilise __reactInternals)
    const keys = Object.keys(element);
    if (keys.some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternals') || k.startsWith('__reactProps'))) {
      return 'react';
    }

    // Angular (ng-reflect-*, ou __ngContext)
    if ((element as any).__ngContext !== undefined ||
        Array.from(element.attributes).some((a) => a.name.startsWith('ng-reflect') || a.name.startsWith('_nghost') || a.name.startsWith('_ngcontent'))) {
      return 'angular';
    }

    // Vue 3 (_vei = Vue Event Internals) / Vue 2 (__vue__)
    if ((element as any).__vue__ !== undefined ||
        (element as any).__vueParentComponent !== undefined ||
        (element as any)._vei !== undefined) {
      return 'vue';
    }

    return 'native';
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
  private static fillTextLike(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
    framework: DetectedFramework
  ): void {
    const isTextArea = element.tagName.toLowerCase() === 'textarea';

    // Focus toujours en premier
    element.focus();
    element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    // Setter natif — contourne les getters/setters des frameworks
    const proto = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    // Séquence d'événements adaptée au framework
    switch (framework) {
      case 'react':
        // React écoute InputEvent avec nativeEvent.data
        element.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: 'insertText',
          })
        );
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        break;

      case 'angular':
        // Angular ControlValueAccessor réagit à 'input' puis 'change' puis 'blur'
        element.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: 'insertText',
            composed: true, // Important pour traverser les Shadow DOM
          })
        );
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        break;

      case 'vue':
        // Vue v-model écoute 'input' sur event.target.value
        element.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: 'insertText',
          })
        );
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        break;

      default:
        // Native HTML / jQuery / formulaires classiques
        element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        break;
    }

    // Blur final toujours — déclenche la validation HTML5 et les dirty-checks
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SELECT NATIF
  // ─────────────────────────────────────────────────────────────────────────

  private static fillNativeSelect(select: HTMLSelectElement, targetValue: string): void {
    select.focus();
    const normTarget = normalizeText(targetValue);
    let matchedIndex = -1;

    // 1. Correspondance exacte de la value HTML
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === targetValue) {
        matchedIndex = i;
        break;
      }
    }

    // 2. Correspondance normalisée sur le texte visible
    if (matchedIndex === -1) {
      for (let i = 0; i < select.options.length; i++) {
        const optText = normalizeText(select.options[i].text);
        if (optText === normTarget || optText.includes(normTarget) || normTarget.includes(optText)) {
          matchedIndex = i;
          break;
        }
      }
    }

    // 3. Correspondance partielle (au moins 50% de chevauchement)
    if (matchedIndex === -1) {
      for (let i = 0; i < select.options.length; i++) {
        const optText = normalizeText(select.options[i].text);
        const words = normTarget.split(' ').filter((w) => w.length > 2);
        if (words.length > 0 && words.every((w) => optText.includes(w))) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex !== -1) {
      // Utiliser le setter natif pour bypasser les wrappers
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'selectedIndex'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(select, matchedIndex);
      } else {
        select.selectedIndex = matchedIndex;
      }

      select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      select.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      select.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PSEUDO-SELECTS (mat-select, ng-select, div[role=listbox], etc.)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Détecte si un élément est un pseudo-select (composant dropdown custom).
   */
  static isPseudoSelect(element: HTMLElement): boolean {
    const role = element.getAttribute('role');
    if (role === 'listbox' || role === 'combobox') return true;

    const tag = element.tagName.toLowerCase();
    if (tag === 'mat-select' || tag === 'ng-select') return true;

    // Angular Material : le vrai input est dans un mat-form-field
    const matFormField = element.closest('mat-form-field');
    if (matFormField && matFormField.querySelector('mat-select')) return true;

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
  private static fillPseudoSelect(element: HTMLElement, targetValue: string): void {
    const normTarget = normalizeText(targetValue);

    // Trouver le trigger (bouton ou élément cliquable du select)
    const trigger =
      element.querySelector<HTMLElement>('.mat-select-trigger, [role="button"], .ng-arrow-wrapper, .dropdown-toggle') ||
      (element.getAttribute('role') === 'combobox' ? element : null) ||
      element;

    if (!trigger) return;

    // Ouvrir le dropdown
    trigger.click();
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // Les options apparaissent dans un overlay global (hors de l'élément)
    // On utilise un MutationObserver ou une petite attente puis on cherche les options
    setTimeout(() => {
      const optionSelectors = [
        'mat-option',
        '[role="option"]',
        '.ng-option',
        '.dropdown-item',
        'li[data-value]',
      ].join(', ');

      const allOptions = Array.from(document.querySelectorAll<HTMLElement>(optionSelectors));

      if (allOptions.length === 0) return;

      // Trouver la meilleure option correspondante
      let bestOption: HTMLElement | null = null;

      // 1. Correspondance exacte
      bestOption = allOptions.find((opt) => {
        const text = normalizeText(opt.textContent || '');
        const val = normalizeText(opt.getAttribute('data-value') || opt.getAttribute('value') || '');
        return text === normTarget || val === normTarget;
      }) || null;

      // 2. Correspondance partielle
      if (!bestOption) {
        bestOption = allOptions.find((opt) => {
          const text = normalizeText(opt.textContent || '');
          return text.includes(normTarget) || normTarget.includes(text);
        }) || null;
      }

      if (bestOption) {
        bestOption.click();
        bestOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        bestOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      } else {
        // Fermer le dropdown si aucune option trouvée (pression Escape)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
    }, 150); // 150ms pour laisser l'overlay s'ouvrir
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHECKBOX
  // ─────────────────────────────────────────────────────────────────────────

  private static fillCheckbox(input: HTMLInputElement, targetState: boolean): void {
    const fw = this.detectFramework(input);

    if (input.checked !== targetState) {
      if (fw === 'react' || fw === 'angular' || fw === 'vue') {
        // Pour les frameworks, utiliser le setter natif puis événement
        const nativeChecker = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'checked'
        )?.set;
        if (nativeChecker) {
          nativeChecker.call(input, targetState);
        }
        input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      } else {
        // Native : .click() déclenche tout naturellement
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
  private static fillRadioGroup(element: HTMLElement, targetValue: string): void {
    const input = element as HTMLInputElement;
    const normTarget = normalizeText(targetValue);

    // Trouver tous les radios du même groupe
    const groupName = input.name;
    const candidates: HTMLInputElement[] = groupName
      ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(groupName)}"]`))
      : [input];

    let matched: HTMLInputElement | null = null;

    // 1. Correspondance exacte sur la value
    matched = candidates.find((r) => r.value === targetValue) || null;

    // 2. Correspondance normalisée
    if (!matched) {
      matched = candidates.find((r) => normalizeText(r.value) === normTarget) || null;
    }

    // 3. Correspondance sur le label associé
    if (!matched) {
      matched = candidates.find((r) => {
        const labelText = r.labels?.[0]?.textContent || '';
        return normalizeText(labelText) === normTarget || normalizeText(labelText).includes(normTarget);
      }) || null;
    }

    if (matched && !matched.checked) {
      const fw = this.detectFramework(matched);
      if (fw !== 'native') {
        const nativeChecker = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'checked'
        )?.set;
        if (nativeChecker) nativeChecker.call(matched, true);
        matched.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        matched.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      } else {
        matched.click();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FEEDBACK VISUEL
  // ─────────────────────────────────────────────────────────────────────────

  private static applyFeedback(element: HTMLElement): void {
    const prev = { outline: element.style.outline, transition: element.style.transition };
    element.style.transition = 'outline 0.3s ease';
    element.style.outline = '2px solid #22c55e';
    setTimeout(() => {
      element.style.outline = prev.outline;
      element.style.transition = prev.transition;
    }, 2500);
  }
}
