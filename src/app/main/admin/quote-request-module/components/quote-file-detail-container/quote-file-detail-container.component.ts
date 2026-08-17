import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { DocumentListComponent } from '../../../document-module/components/document-list/document-list.component';
import {
  ConfirmationDecision,
  PendingConfirmationListComponent,
} from '../../../document-module/components/pending-confirmation-list/pending-confirmation-list.component';
import {
  DocumentUploadComponent,
  DocumentUploadRequest,
} from '../../../document-module/components/document-upload/document-upload.component';
import { DocumentRef } from '../../../document-module/models/document-ref.model';
import { DocumentService } from '../../../document-module/services/document.service';
import { ExtranetLinkModel } from '../../models/extranet-link.model';
import { QuoteFileModel } from '../../models/quote-file.model';
import { QuestionnaireQuestion } from '../../models/questionnaire.model';
import { getMissingQuestions } from '../../models/questionnaire.util';
import { ExtranetLinkService } from '../../services/extranet-link.service';
import {
  FormAgentAnalysisError,
  FormAgentBridgeService,
  FormAgentFillError,
  FormAgentUnavailableError,
  FormAgentUnreachableError,
} from '../../services/form-agent-bridge.service';
import { QuoteFileService } from '../../services/quote-file.service';
import { QuestionnaireComponent } from '../questionnaire/questionnaire.component';
import { QuoteFileDetailComponent } from '../quote-file-detail/quote-file-detail.component';

/** État affiché pendant la préparation du dossier pour un extranet — jamais de jargon technique. */
export type FormAgentConnectionState = 'idle' | 'connecting' | 'error';

/**
 * Composant conteneur de la page "Dossier".
 *
 * Route : /admin/mes-devis/:quoteFileId
 *
 * Charge le dossier en temps réel (le statut OCR se met à jour à l'écran
 * sans action du courtier) et orchestre les composants du module documents —
 * lui-même ne touche jamais Firestore directement.
 */
@Component({
  selector: 'app-quote-file-detail-container',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    RouterLink,
    QuoteFileDetailComponent,
    DocumentUploadComponent,
    DocumentListComponent,
    PendingConfirmationListComponent,
    QuestionnaireComponent,
  ],
  templateUrl: './quote-file-detail-container.component.html',
  styleUrl: './quote-file-detail-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteFileDetailContainerComponent {
  private readonly quoteFileService = inject(QuoteFileService);
  private readonly documentService = inject(DocumentService);
  private readonly formAgentBridge = inject(FormAgentBridgeService);
  private readonly extranetLinkService = inject(ExtranetLinkService);

  readonly quoteFileId = input.required<string>();

  readonly quoteFile = toSignal(
    toObservable(this.quoteFileId).pipe(switchMap((id) => this.quoteFileService.watchById(id))),
    { initialValue: undefined as QuoteFileModel | undefined }
  );

  // ─── Compagnies ("Mes extranets") ────────────────────────────────────────
  // Le même dossier peut être préparé pour n'importe quel extranet actif du
  // courtier — plus aucune compagnie codée en dur ici.
  readonly extranetLinks = toSignal(this.extranetLinkService.listActiveMine(), {
    initialValue: [] as ExtranetLinkModel[],
  });

  readonly selectedExtranetId = signal<string | null>(null);

  readonly selectedExtranet = computed(
    () => this.extranetLinks().find((link) => link.id === this.selectedExtranetId()) ?? null
  );

  // ─── Questionnaire dynamique ─────────────────────────────────────────────
  readonly formAgentState = signal<FormAgentConnectionState>('idle');
  readonly formAgentErrorMessage = signal<string | null>(null);

  readonly activeQuestionnaire = computed(() => {
    const id = this.selectedExtranetId();
    if (!id) return undefined;
    return this.quoteFile()?.extranetQuestionnaires[id];
  });

  readonly missingQuestions = computed<QuestionnaireQuestion[]>(() => {
    const file = this.quoteFile();
    const active = this.activeQuestionnaire();
    if (!file || !active || active.status !== 'in_progress') return [];
    return getMissingQuestions(active.requiredFields, file);
  });

  readonly currentQuestion = computed(() => this.missingQuestions()[0] ?? null);

  // ─── Remplissage réel de l'extranet ──────────────────────────────────────
  readonly fillState = signal<FormAgentConnectionState>('idle');
  readonly fillErrorMessage = signal<string | null>(null);

  readonly lastFillResult = computed(() => {
    const id = this.selectedExtranetId();
    if (!id) return undefined;
    return this.quoteFile()?.extranetResults[id];
  });

  /** Résumé affiché à l'étape "Dossier prêt" — réutilise `getMissingQuestions`, aucun nouveau calcul de complétude. */
  readonly readinessSummary = computed(() => {
    const file = this.quoteFile();
    const active = this.activeQuestionnaire();
    if (!file || !active) return null;

    const missing = getMissingQuestions(active.requiredFields, file);
    const extractedFromDocuments = file.documents.reduce((sum, doc) => sum + (doc.extractedFieldCount ?? 0), 0);

    return {
      requiredCount: active.requiredFields.length,
      missingCount: missing.length,
      knownCount: active.requiredFields.length - missing.length,
      extractedFromDocuments,
    };
  });

  /** Compagnies pour lesquelles un résultat de remplissage existe déjà — indépendants les uns des autres. */
  readonly companiesWithResults = computed(() => {
    const file = this.quoteFile();
    if (!file) return [];
    return this.extranetLinks().filter((link) => link.id && file.extranetResults[link.id]);
  });

  /** Statut visible de chacune des grandes étapes du parcours (page "Dossier"). */
  readonly steps = computed(() => {
    const file = this.quoteFile();
    const active = this.activeQuestionnaire();
    const result = this.lastFillResult();

    const documentsDone = (file?.documents.length ?? 0) > 0;
    const preparationDone = !!active;
    const questionsDone = active?.status === 'complete';
    const readyDone = questionsDone;
    const fillDone = !!result;
    const resultDone = result?.status === 'ready';

    return [
      { label: 'Dossier', status: file ? 'done' : 'pending' } as const,
      { label: 'Documents', status: documentsDone ? 'done' : 'pending' } as const,
      { label: 'Préparation', status: preparationDone ? 'done' : this.selectedExtranet() ? 'current' : 'pending' } as const,
      { label: 'Questions', status: questionsDone ? 'done' : active ? 'current' : 'pending' } as const,
      { label: 'Dossier prêt', status: readyDone ? 'done' : 'pending' } as const,
      { label: 'Remplissage', status: fillDone ? 'done' : readyDone ? 'current' : 'pending' } as const,
      { label: 'Résultat', status: resultDone ? 'done' : fillDone ? 'current' : 'pending' } as const,
    ];
  });

  constructor() {
    // Termine automatiquement le questionnaire dès que la dernière réponse est enregistrée.
    effect(() => {
      const file = this.quoteFile();
      const active = this.activeQuestionnaire();
      const extranetId = this.selectedExtranetId();
      if (!file || !active || !extranetId || active.status !== 'in_progress') return;

      if (this.missingQuestions().length === 0) {
        void this.quoteFileService.completeExtranetQuestionnaire(this.quoteFileId(), file, extranetId);
      }
    });
  }

  /** Statut d'avancement de la préparation du dossier pour une compagnie donnée. */
  companyStatus(link: ExtranetLinkModel): 'not_started' | 'in_progress' | 'ready' {
    const file = this.quoteFile();
    if (!file || !link.id) return 'not_started';

    const result = file.extranetResults[link.id];
    if (result && result.status === 'ready') return 'ready';

    const questionnaire = file.extranetQuestionnaires[link.id];
    if (questionnaire) return 'in_progress';

    return 'not_started';
  }

  companyStatusLabel(link: ExtranetLinkModel): string {
    switch (this.companyStatus(link)) {
      case 'ready':
        return '✓ Préparé';
      case 'in_progress':
        return '● En cours';
      default:
        return '○ Pas encore préparé';
    }
  }

  /** Sélectionne une compagnie : ouvre le panneau de préparation/remplissage pour cet extranet. */
  onSelectCompany(link: ExtranetLinkModel): void {
    if (!link.id) return;
    const wasAlreadySelected = this.selectedExtranetId() === link.id;
    this.selectedExtranetId.set(link.id);
    this.formAgentState.set('idle');
    this.formAgentErrorMessage.set(null);
    this.fillState.set('idle');
    this.fillErrorMessage.set(null);

    const quoteFile = this.quoteFile();
    if (quoteFile && !wasAlreadySelected) {
      void this.quoteFileService.logEvent(this.quoteFileId(), quoteFile, `Compagnie sélectionnée : ${link.company} ${link.product}`);
    }
  }

  /**
   * "Préparer ce dossier" : sollicite Form Agent pour obtenir la liste RÉELLE
   * des champs demandés par l'extranet (analyse Gemini/FormMemory côté
   * extension, inchangée), puis démarre le questionnaire à partir de cette
   * liste — plus jamais de données de démonstration sur ce chemin.
   */
  onStartQuestionnaire(): void {
    const quoteFile = this.quoteFile();
    const link = this.selectedExtranet();
    if (!quoteFile || !link || !link.id) return;

    this.formAgentState.set('connecting');
    this.formAgentErrorMessage.set(null);

    this.formAgentBridge
      .prepareExtranetQuote({
        quoteFileId: this.quoteFileId(),
        extranetId: link.id,
        extranetUrl: link.url,
        quoteData: quoteFile.quote,
      })
      .subscribe({
        next: (fields) => {
          this.formAgentState.set('idle');
          void this.quoteFileService.startExtranetQuestionnaire(this.quoteFileId(), quoteFile, link.id!, fields);
        },
        error: (err: unknown) => {
          this.formAgentState.set('error');
          this.formAgentErrorMessage.set(this.describeFormAgentError(err));
        },
      });
  }

  private describeFormAgentError(err: unknown): string {
    if (err instanceof FormAgentUnavailableError) return err.message;
    if (err instanceof FormAgentUnreachableError) return err.message;
    if (err instanceof FormAgentAnalysisError) return err.message;
    if (err instanceof FormAgentFillError) return err.message;
    return 'Une erreur est survenue. Vous pouvez réessayer.';
  }

  /**
   * "Remplir l'extranet" : sollicite Form Agent pour remplir réellement le
   * formulaire à partir du dossier (KNOWN uniquement, jamais de valeur
   * inventée — garanti par le pipeline existant). Ne déclenche jamais
   * "Suivant"/soumission/signature : uniquement le remplissage des champs.
   */
  onFillExtranet(): void {
    const quoteFile = this.quoteFile();
    const link = this.selectedExtranet();
    if (!quoteFile || !link || !link.id) return;

    this.fillState.set('connecting');
    this.fillErrorMessage.set(null);
    void this.quoteFileService.logEvent(this.quoteFileId(), quoteFile, `Remplissage commencé (${link.company} ${link.product})`);

    this.formAgentBridge
      .fillExtranetQuote({
        quoteFileId: this.quoteFileId(),
        extranetId: link.id,
        extranetUrl: link.url,
        quoteData: quoteFile.quote,
      })
      .subscribe({
        next: (outcome) => {
          this.fillState.set('idle');
          void this.quoteFileService.recordFillResult(this.quoteFileId(), quoteFile, link.id!, outcome);
        },
        error: (err: unknown) => {
          this.fillState.set('error');
          this.fillErrorMessage.set(this.describeFormAgentError(err));
          void this.quoteFileService.logEvent(
            this.quoteFileId(),
            quoteFile,
            `Erreur de remplissage (${link.company} ${link.product})`
          );
        },
      });
  }

  async onAnswerQuestion(value: unknown): Promise<void> {
    const quoteFile = this.quoteFile();
    const question = this.currentQuestion();
    if (!quoteFile || !question) return;

    await this.quoteFileService.answerQuestion(this.quoteFileId(), quoteFile, question, value);
  }

  async onAddDocument(request: DocumentUploadRequest): Promise<void> {
    const quoteFile = this.quoteFile();
    if (!quoteFile) return;

    const documentRef = await this.documentService.addDocument(
      this.quoteFileId(),
      quoteFile,
      request.type,
      request.file
    );

    // Lance immédiatement la lecture — le courtier n'a pas de bouton
    // supplémentaire à cliquer pour une opération sûre et rapide (mock).
    const refreshedQuoteFile = await this.quoteFileService.getById(this.quoteFileId());
    if (refreshedQuoteFile) {
      await this.documentService.runOcr(this.quoteFileId(), refreshedQuoteFile, documentRef, request.file);
    }
  }

  async onRunOcr(document: DocumentRef): Promise<void> {
    const quoteFile = this.quoteFile();
    if (!quoteFile) return;

    // Le mock ne relit pas le fichier réel ; un vrai fournisseur OCR
    // nécessiterait de retélécharger le fichier depuis Storage ici.
    const placeholderFile = new File([], document.fileName);
    await this.documentService.runOcr(this.quoteFileId(), quoteFile, document, placeholderFile);
  }

  async onConfirmationDecision(event: ConfirmationDecision): Promise<void> {
    const quoteFile = this.quoteFile();
    if (!quoteFile) return;

    await this.documentService.resolveConfirmation(this.quoteFileId(), quoteFile, event.confirmation, event.decision);
  }
}
