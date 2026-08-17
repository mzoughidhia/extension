/**
 * QuoteSession — "Où en sommes-nous dans le devis actuel ?"
 *
 * À distinguer strictement de FormMemory ("Comment remplir ce type de
 * formulaire ?"). QuoteSession ne mémorise jamais la structure d'un
 * formulaire ; FormMemory ne mémorise jamais la progression d'un devis.
 *
 * NE JAMAIS stocker : clé Gemini, cookies, tokens, secrets, DOM brut.
 */

export interface DetectedQuote {
  quoteId: string;
  reference?: string;
  clientName?: string;
  product?: string;
  date?: string;
  status?: string;
  premiumAmount?: string;
  resumeSelector?: string;
}

export interface QuoteSessionStep {
  stepIndex: number;
  label: string | null;
  formFingerprint: string;
  completedFieldCount: number;
  timestamp: string;
}

export type QuoteSessionStatus = 'in_progress' | 'completed' | 'paused';

export interface QuoteSession {
  sessionId: string;
  /** Identité logique stable du parcours : `${origin}::${product}` (jamais une donnée client) */
  sessionKey: string;
  origin: string;
  product: string;

  /** Identifiants de devis capturés depuis le DOM si visibles — jamais inventés */
  quoteId?: string | null;
  quoteNumber?: string | null;
  quoteStatus?: string | null;
  quoteDate?: string | null;

  currentStep: number;
  totalSteps: number | null;
  steps: QuoteSessionStep[];

  /** Chemins canoniques déjà remplis à un moment donné (marqueur, pas la valeur) */
  completedFields: Record<string, true>;
  /** Réponses fournies par le courtier pour les questions posées (canonicalPath -> valeur) */
  userAnswers: Record<string, unknown>;

  detectedQuotes: DetectedQuote[];
  status: QuoteSessionStatus;

  createdAt: string;
  updatedAt: string;
  lastVisitedAt: string;
}
