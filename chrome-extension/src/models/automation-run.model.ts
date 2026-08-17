import { FieldMapping } from './field-mapping.model';

export interface FieldFillResult {
  elementId: string;
  selector: string;
  canonicalPath: string;
  valueFilled: unknown;
  success: boolean;
  errorMessage?: string;
}

/**
 * Métriques de performance internes (mode debug uniquement — jamais affichées
 * dans l'interface normale du courtier).
 */
export interface AutomationRunMetrics {
  fingerprintDuration: number;
  cacheLookupDuration: number;
  geminiDuration: number;
  totalAnalysisDuration: number;
  cacheHit: boolean;
  geminiCalled: boolean;
  analysisStartedAt: string;
  analysisCompletedAt: string;
}

/** Information d'étape simplifiée, exposée au Side Panel (jamais de détail technique). */
export interface AutomationRunStepInfo {
  currentStep: number;
  totalSteps: number | null;
  label: string | null;
  nextButtonFound: boolean;
}

export interface AutomationRun {
  runId: string;
  timestamp: string;
  url: string;
  hostname: string;
  mappings: FieldMapping[];
  fillResults?: FieldFillResult[];
  totalDetected: number;
  totalMatched: number;
  totalNeedsConfirmation: number;
  totalUnmatched: number;
  totalFilled?: number;
  /** Métriques de performance internes (debug uniquement) */
  metrics?: AutomationRunMetrics;
  /** Identifiant de la session de devis associée à cette analyse */
  sessionId?: string;
  /** Position dans le parcours multi-page (si détectable) */
  stepInfo?: AutomationRunStepInfo;
}
