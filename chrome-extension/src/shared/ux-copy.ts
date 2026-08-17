import { QuoteSession } from '../models/quote-session.model';

/**
 * Logique de présentation du Side Panel, séparée du rendu DOM pour rester
 * testable sans navigateur. Ne contient AUCUN terme technique (canonicalPath,
 * confidence, MATCHED, fingerprint, sessionId, etc.) — uniquement du texte
 * naturel destiné au courtier.
 */

export type ScanButtonState = 'idle' | 'busy' | 'cache-hit' | 'analyzed';

const SCAN_BUTTON_LABELS: Record<ScanButtonState, string> = {
  idle: 'Analyser le formulaire',
  busy: 'Analyse en cours…',
  'cache-hit': '✓ Formulaire reconnu',
  analyzed: '✓ Formulaire analysé',
};

export function getScanButtonLabel(state: ScanButtonState): string {
  return SCAN_BUTTON_LABELS[state];
}

/** Types de champs pour lesquels un input natif dédié est plus naturel qu'un simple texte. */
const TYPED_INPUT_TYPES = new Set(['date', 'number']);

export function resolveQuestionInputType(fieldType: string): 'date' | 'number' | 'text' {
  return TYPED_INPUT_TYPES.has(fieldType) ? (fieldType as 'date' | 'number') : 'text';
}

/** Transforme le libellé d'un champ en question naturelle (jamais le nom technique du champ). */
export function buildQuestionLine(fieldLabel: string): string {
  const trimmed = fieldLabel.trim();
  return /[?!.]$/.test(trimmed) ? trimmed : `${trimmed} ?`;
}

export interface AnalysisOutcomeInput {
  cacheHit: boolean;
  usedLocalAnalysis: boolean;
  autoReadyCount: number;
  pendingCount: number;
}

/**
 * Détermine les messages que l'assistant doit afficher après une analyse,
 * sans jamais mentionner Gemini, le cache, ou un score de confiance.
 */
export function describeAnalysisOutcome(input: AnalysisOutcomeInput): string[] {
  const lines: string[] = [];

  if (input.cacheHit) {
    lines.push('✓ Formulaire reconnu.');
  } else if (input.usedLocalAnalysis) {
    lines.push('Le mode intelligent est momentanément indisponible. Je continue avec une analyse locale.');
  }

  if (input.pendingCount === 0) {
    lines.push(`✓ ${input.autoReadyCount} information(s) prête(s).`);
  } else {
    lines.push(`✓ ${input.autoReadyCount} information(s) prête(s)<br>⚠️ ${input.pendingCount} information(s) manquante(s)`);
  }

  return lines;
}

export interface StepLike {
  currentStep: number;
  totalSteps: number | null;
}

export function formatStepLabel(step: StepLike): string {
  return step.totalSteps ? `Étape ${step.currentStep} sur ${step.totalSteps}` : `Étape ${step.currentStep}`;
}

/** Pourcentage de progression (0-100), ou null si le nombre total d'étapes est inconnu. */
export function computeProgressPercent(step: StepLike): number | null {
  if (!step.totalSteps) return null;
  return Math.max(0, Math.min(100, Math.round((step.currentStep / step.totalSteps) * 100)));
}

export type SessionPresentationMode = 'none' | 'single' | 'multiple';

export interface SessionPresentation {
  mode: SessionPresentationMode;
  sessions: QuoteSession[];
}

/**
 * Détermine comment présenter les sessions trouvées au démarrage du Side
 * Panel. Ne choisit JAMAIS une session à la place du courtier : une seule
 * session se propose directement, plusieurs se présentent toutes.
 */
export function pickSessionPresentation(sessions: QuoteSession[]): SessionPresentation {
  if (sessions.length === 0) return { mode: 'none', sessions: [] };
  if (sessions.length === 1) return { mode: 'single', sessions };
  return { mode: 'multiple', sessions };
}
