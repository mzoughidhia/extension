import { normalizeText } from '../shared/utils/text.utils';

export interface DetectedStepInfo {
  currentStep: number | null;
  totalSteps: number | null;
  stepLabel: string | null;
  nextButtonFound: boolean;
}

/** Libellés reconnus pour un bouton "étape suivante" (FR + EN, robustesse aux variantes). */
const NEXT_BUTTON_LABELS = [
  'suivant',
  'continuer',
  'etape suivante',
  'valider et continuer',
  'poursuivre',
  'next',
  'continue',
];

/**
 * Ex: "Étape 2 sur 4", "Step 2 of 4", "Étape 2/4".
 * Le séparateur est optionnel car `normalizeText` remplace déjà "/" par un espace.
 */
const STEP_TEXT_REGEX = /(?:etape|step)\s+(\d+)\s*(?:sur|of|de)?\s*(\d+)/;

/** Pure : détecte si le libellé d'un bouton correspond à une action "étape suivante". */
export function isNextButtonLabel(rawText: string): boolean {
  const text = normalizeText(rawText);
  if (!text) return false;
  return NEXT_BUTTON_LABELS.some((label) => text.includes(label));
}

/** Pure : extrait un couple (étape courante, total) d'un texte libre, ou null si absent. */
export function parseStepFromText(rawText: string): { currentStep: number; totalSteps: number } | null {
  const text = normalizeText(rawText);
  const match = text.match(STEP_TEXT_REGEX);
  if (!match) return null;
  return { currentStep: parseInt(match[1], 10), totalSteps: parseInt(match[2], 10) };
}

/**
 * Détection DOM des étapes d'un formulaire multi-page : stepper Angular
 * Material, texte "Étape X sur Y", ou simple présence d'un bouton "suivant".
 *
 * Ne suppose JAMAIS un nombre d'étapes fixe. Si le total est inconnu :
 * totalSteps = null (jamais une valeur inventée).
 */
export class StepDetector {
  static detect(root: ParentNode = document): DetectedStepInfo {
    const matStep = StepDetector.detectAngularMaterialStepper(root);
    if (matStep) {
      return { ...matStep, nextButtonFound: StepDetector.findNextButton(root) !== null };
    }

    const textStep = StepDetector.detectStepFromText(root);
    if (textStep) {
      return { ...textStep, nextButtonFound: StepDetector.findNextButton(root) !== null };
    }

    return {
      currentStep: null,
      totalSteps: null,
      stepLabel: null,
      nextButtonFound: StepDetector.findNextButton(root) !== null,
    };
  }

  private static detectAngularMaterialStepper(root: ParentNode): Omit<DetectedStepInfo, 'nextButtonFound'> | null {
    const headers = Array.from(
      root.querySelectorAll('mat-step-header, .mat-step-header, .mat-horizontal-stepper-header')
    );
    if (headers.length === 0) return null;

    let currentIndex = -1;
    headers.forEach((el, idx) => {
      const isSelected =
        el.getAttribute('aria-selected') === 'true' ||
        el.classList.contains('mat-step-header-selected') ||
        el.classList.contains('cdk-step-selected') ||
        el.classList.contains('mat-step-header-active');
      if (isSelected) currentIndex = idx;
    });

    return {
      currentStep: currentIndex >= 0 ? currentIndex + 1 : null,
      totalSteps: headers.length,
      stepLabel: currentIndex >= 0 ? (headers[currentIndex].textContent || '').trim().slice(0, 80) : null,
    };
  }

  private static detectStepFromText(root: ParentNode): Omit<DetectedStepInfo, 'nextButtonFound'> | null {
    const candidates = Array.from(root.querySelectorAll('h1, h2, h3, [class*="step"], [class*="progress"]'));
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      const parsed = parseStepFromText(text);
      if (parsed) {
        return { ...parsed, stepLabel: text.slice(0, 80) };
      }
    }
    return null;
  }

  static findNextButton(root: ParentNode = document): HTMLElement | null {
    const candidates = Array.from(root.querySelectorAll('button, a, input[type="submit"], input[type="button"]'));
    for (const el of candidates) {
      const text = (el as HTMLElement).textContent || (el as HTMLInputElement).value || '';
      if (isNextButtonLabel(text)) return el as HTMLElement;
    }
    return null;
  }

  /** Déclenche le clic réel sur le bouton "suivant" détecté (jamais de soumission finale/signature). */
  static clickNextButton(root: ParentNode = document): boolean {
    const btn = StepDetector.findNextButton(root);
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }
}
