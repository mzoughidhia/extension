import { DetectedField } from '../models/detected-field.model';
import { DOMAnalyzer } from './dom-analyzer';

export class FieldDetector {
  /** Types d'input ignorés d'office (boutons, tokens techniques, mots de passe) */
  private static readonly IGNORED_INPUT_TYPES = new Set([
    'submit',
    'button',
    'reset',
    'image',
    'hidden',
    'password',
    'file',
  ]);

  /** Noms techniques fréquemment utilisés pour des tokens CSRF ou non-métier */
  private static readonly IGNORED_NAMES = [
    '_token',
    'csrf',
    'csrf_token',
    'authenticity_token',
    '__requestverificationtoken',
  ];

  /**
   * Scanne le DOM (ou un conteneur donné) et retourne la liste de tous les champs détectés.
   */
  static detectFields(root: Document | HTMLElement = document): DetectedField[] {
    const selector = 'input, select, textarea';
    const elements = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector));

    const detected: DetectedField[] = [];
    let counter = 0;

    for (const el of elements) {
      if (this.shouldIgnoreElement(el)) {
        continue;
      }

      counter++;
      const elementId = `autofill_field_${counter}_${Date.now()}`;
      // Marquer temporairement l'élément avec un dataset pour le retrouver de manière fiable
      el.dataset['autofillId'] = elementId;

      const tagName = el.tagName.toLowerCase() as 'input' | 'select' | 'textarea';
      const type = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();
      const signals = DOMAnalyzer.extractSignals(el);

      const detectedField: DetectedField = {
        elementId,
        selector: `[data-autofill-id="${elementId}"]`,
        tagName,
        type,
        name: el.name || el.getAttribute('name') || null,
        id: el.id || null,
        label: signals.label,
        placeholder: signals.placeholder,
        ariaLabel: signals.ariaLabel,
        surroundingText: signals.surroundingText,
        sectionName: signals.sectionName,
        options: signals.options,
        currentValue: el.value,
        dataAttributes: signals.dataAttributes,
        isInteractable: !el.disabled && !('readOnly' in el && (el as HTMLInputElement).readOnly),
      };

      detected.push(detectedField);
    }

    return detected;
  }

  /**
   * Filtre les éléments non pertinents pour le remplissage de données de devis.
   */
  private static shouldIgnoreElement(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
    const tagName = el.tagName.toLowerCase();

    // 1. Types ignorés
    if (tagName === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (this.IGNORED_INPUT_TYPES.has(type)) {
        return true;
      }
    }

    // 2. Visibilité basique
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getClientRects().length) {
      // Certains selects custom ou radios masqués peuvent avoir une visibilité spéciale, mais les hidden purs sont ignorés
      if (el.style.display === 'none' || el.style.visibility === 'hidden') {
        return true;
      }
    }

    // 3. CSRF et champs techniques
    const name = (el.name || el.id || '').toLowerCase();
    if (this.IGNORED_NAMES.some((ign) => name.includes(ign))) {
      return true;
    }

    return false;
  }
}
