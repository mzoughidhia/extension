import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { QuoteFileHistoryEntry } from '../models/quote-file.model';
import { QuoteRequest, createEmptyQuoteRequest } from '../models/quote-request.model';
import { QuoteFileService } from '../services/quote-file.service';

/** Index de l'étape active dans le stepper (0-based). */
export type StepIndex = 0 | 1 | 2 | 3 | 4;

export interface QuoteRequestState {
  draft: QuoteRequest;
  activeStep: StepIndex;
  isSubmitted: boolean;
  successMessage: string | null;
  /** Id du dossier persisté (Firestore) associé à ce brouillon, ou `null` si non authentifié / pas encore créé. */
  quoteFileId: string | null;
  /** Timeline minimale du dossier (miroir de `QuoteFileModel.history`). */
  history: QuoteFileHistoryEntry[];
  /** `true` pendant le chargement d'un dossier existant (reprise). */
  isResuming: boolean;
}

const initialState: QuoteRequestState = {
  draft: createEmptyQuoteRequest(),
  activeStep: 0,
  isSubmitted: false,
  successMessage: null,
  quoteFileId: null,
  history: [],
  isResuming: false,
};

/**
 * Store NgRx Signals — orchestre le formulaire multi-étapes.
 *
 * Portée `providedIn: 'root'` : le store survit aux navigations internes.
 *
 * Le brouillon est désormais persisté dans un dossier Firestore
 * (`QuoteFileModel`, via `QuoteFileService`) dès qu'un courtier est
 * authentifié — voir `ensureQuoteFile()`/`resumeQuoteFile()`. Sans
 * authentification, le store se comporte exactement comme avant (brouillon
 * local uniquement, `submitDraft()` reste une confirmation locale).
 */
export const QuoteRequestStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ activeStep }) => ({
    isFirstStep: computed(() => activeStep() === 0),
    isLastStep: computed(() => activeStep() === 4),
  })),

  withMethods((store, quoteFileService = inject(QuoteFileService)) => ({
    /** Avance à l'étape suivante. */
    nextStep(): void {
      const current = store.activeStep();
      if (current < 4) {
        patchState(store, { activeStep: (current + 1) as StepIndex });
      }
    },

    /** Recule à l'étape précédente. */
    prevStep(): void {
      const current = store.activeStep();
      if (current > 0) {
        patchState(store, { activeStep: (current - 1) as StepIndex });
      }
    },

    /** Navigue directement vers une étape (utilisé par le récapitulatif "Modifier"). */
    goToStep(step: StepIndex): void {
      patchState(store, { activeStep: step });
    },

    /**
     * Met à jour le brouillon et, si un dossier Firestore existe déjà pour
     * cette session (voir `ensureQuoteFile`), enregistre immédiatement les
     * nouvelles informations — aucune information saisie n'est perdue en cas
     * de fermeture ou de reprise ultérieure.
     */
    patchDraft(partial: Partial<QuoteRequest>): void {
      const updatedDraft = { ...store.draft(), ...partial };
      patchState(store, { draft: updatedDraft });

      const quoteFileId = store.quoteFileId();
      if (quoteFileId) {
        void quoteFileService.save(quoteFileId, updatedDraft);
      }
    },

    /**
     * Crée le dossier Firestore associé à cette session si aucun n'existe
     * encore (idempotent). Sans courtier authentifié, ne fait rien : le
     * formulaire continue de fonctionner en local uniquement, comme avant.
     */
    async ensureQuoteFile(): Promise<void> {
      if (store.quoteFileId()) return;

      const created = await quoteFileService.create(store.draft());
      if (created?.id) {
        patchState(store, { quoteFileId: created.id, history: created.history });
      }
    },

    /** Recharge un dossier existant et reprend exactement où le courtier s'était arrêté. */
    async resumeQuoteFile(quoteFileId: string): Promise<void> {
      patchState(store, { isResuming: true });

      const quoteFile = await quoteFileService.getById(quoteFileId);
      if (!quoteFile) {
        patchState(store, { isResuming: false });
        return;
      }

      patchState(store, {
        draft: quoteFile.quote,
        quoteFileId: quoteFile.id ?? null,
        history: quoteFile.history,
        isSubmitted: quoteFile.status === 'submitted',
        activeStep: quoteFile.status === 'submitted' ? 4 : 0,
        isResuming: false,
      });
    },

    /**
     * Finalise la demande : affiche le message de succès et, si un dossier
     * Firestore existe, l'enregistre comme soumis avec son événement d'historique.
     */
    async submitDraft(): Promise<void> {
      patchState(store, {
        isSubmitted: true,
        successMessage: 'Demande préparée avec succès.',
      });

      const quoteFileId = store.quoteFileId();
      if (quoteFileId) {
        await quoteFileService.markSubmitted(quoteFileId, store.history());
      }
    },

    /** Réinitialise l'ensemble du formulaire (nouveau dossier). */
    reset(): void {
      patchState(store, initialState);
    },

    /** Efface le message de succès. */
    clearSuccess(): void {
      patchState(store, { successMessage: null });
    },
  }))
);
