import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, of } from 'rxjs';

import {
  DatabaseProvider,
  DatabaseQueryBuilder,
  FilterOperator,
  OrderByDirection,
} from '@karma-solutions-org/ngx-sg';

import { AuthStore } from '../../../commons/authentication-module/store/auth.store';
import { DOCUMENT_TYPE_LABELS, DocumentRef, OcrStatus } from '../../document-module/models/document-ref.model';
import { PendingConfirmation } from '../../document-module/models/pending-confirmation.model';
import {
  ExtranetFillResult,
  ExtranetFillStatus,
  QuoteFileHistoryEntry,
  QuoteFileModel,
  createQuoteFileHistoryEntry,
  quoteFileEntity,
} from '../models/quote-file.model';
import { QuoteRequest } from '../models/quote-request.model';
import { QuestionnaireQuestion, RequiredField } from '../models/questionnaire.model';
import { applyQuestionAnswer } from '../models/questionnaire.util';

/**
 * Persistance des dossiers de devis (`QuoteFileModel`) via l'abstraction
 * `DatabaseProvider` déjà câblée sur Firestore (voir `app.config.ts`).
 *
 * Le code métier n'injecte jamais Firestore directement — uniquement cette
 * abstraction, remplaçable et testable (cf. architecture de référence §4.6).
 *
 * Un dossier est toujours scopé au courtier connecté (`ownerUid`). Si aucun
 * utilisateur n'est authentifié, les écritures sont silencieusement ignorées
 * (pas d'erreur) afin de ne jamais casser le parcours `/quote-request`
 * actuellement accessible sans connexion — la persistance devient active dès
 * que le courtier est connecté, sans rien changer d'autre au flux existant.
 */
@Injectable({ providedIn: 'root' })
export class QuoteFileService {
  private readonly databaseProvider = inject(DatabaseProvider);
  private readonly authStore = inject(AuthStore);

  /**
   * Crée un nouveau dossier à partir du brouillon courant.
   * Retourne `null` si aucun courtier n'est connecté (pas de persistance possible).
   */
  async create(quote: QuoteRequest): Promise<QuoteFileModel | null> {
    const ownerUid = this.authStore.uid();
    if (!ownerUid) return null;

    return this.databaseProvider.add(quoteFileEntity, {
      ownerUid,
      status: 'draft',
      quote,
      history: [createQuoteFileHistoryEntry('Dossier créé')],
      documents: [],
      pendingConfirmations: [],
      extranetQuestionnaires: {},
      extranetResults: {},
    });
  }

  /** Met à jour les informations du dossier (sans toucher au statut ni à l'historique). */
  async save(id: string, quote: QuoteRequest): Promise<void> {
    if (!this.authStore.uid()) return;
    await this.databaseProvider.update(quoteFileEntity, id, { quote });
  }

  /** Marque le dossier comme soumis et ajoute l'événement correspondant à la timeline. */
  async markSubmitted(id: string, currentHistory: QuoteFileHistoryEntry[]): Promise<void> {
    if (!this.authStore.uid()) return;
    await this.databaseProvider.update(quoteFileEntity, id, {
      status: 'submitted',
      history: [...currentHistory, createQuoteFileHistoryEntry('Demande préparée')],
    });
  }

  /** Récupère un dossier par son id (lecture ponctuelle, pour la reprise). */
  getById(id: string): Promise<QuoteFileModel | undefined> {
    return firstValueFrom(this.databaseProvider.getById(quoteFileEntity, id));
  }

  /** Flux temps réel d'un dossier — utilisé par la page de détail (statut OCR en direct). */
  watchById(id: string): Observable<QuoteFileModel | undefined> {
    return this.databaseProvider.getById(quoteFileEntity, id);
  }

  /** Ajoute un document au dossier et journalise l'événement dans l'historique existant. */
  async addDocument(id: string, quoteFile: QuoteFileModel, documentRef: DocumentRef): Promise<void> {
    if (!this.authStore.uid()) return;
    await this.databaseProvider.update(quoteFileEntity, id, {
      documents: [...quoteFile.documents, documentRef],
      history: [
        ...quoteFile.history,
        createQuoteFileHistoryEntry(`Document ajouté : ${DOCUMENT_TYPE_LABELS[documentRef.type]}`),
      ],
    });
  }

  /** Met à jour uniquement le statut OCR d'un document (ex : passage à `processing`). */
  async updateDocumentStatus(id: string, quoteFile: QuoteFileModel, documentId: string, status: OcrStatus): Promise<void> {
    if (!this.authStore.uid()) return;
    const documents = quoteFile.documents.map((doc) =>
      doc.id === documentId ? { ...doc, ocrStatus: status } : doc
    );
    await this.databaseProvider.update(quoteFileEntity, id, { documents });
  }

  /**
   * Applique le résultat d'une extraction OCR : dossier mis à jour (champs
   * fiables déjà appliqués), statut du document, nouvelles confirmations en
   * attente, et événement d'historique.
   */
  async applyOcrResult(
    id: string,
    quoteFile: QuoteFileModel,
    params: {
      documentId: string;
      quote: QuoteRequest;
      extractedFieldCount: number;
      newConfirmations: PendingConfirmation[];
    }
  ): Promise<void> {
    if (!this.authStore.uid()) return;

    const documents = quoteFile.documents.map((doc) =>
      doc.id === params.documentId
        ? { ...doc, ocrStatus: 'done' as const, extractedFieldCount: params.extractedFieldCount }
        : doc
    );

    await this.databaseProvider.update(quoteFileEntity, id, {
      quote: params.quote,
      documents,
      pendingConfirmations: [...quoteFile.pendingConfirmations, ...params.newConfirmations],
      history: [...quoteFile.history, createQuoteFileHistoryEntry('Informations extraites du document')],
    });
  }

  /**
   * Résout une confirmation en attente : applique ou écarte la valeur OCR,
   * retire la confirmation de la liste, journalise la décision.
   */
  async resolveConfirmation(
    id: string,
    quoteFile: QuoteFileModel,
    confirmationId: string,
    updatedQuote: QuoteRequest,
    decision: 'keepCurrent' | 'useOcr'
  ): Promise<void> {
    if (!this.authStore.uid()) return;

    const pendingConfirmations = quoteFile.pendingConfirmations.filter((c) => c.id !== confirmationId);
    const label = decision === 'useOcr' ? 'Information confirmée depuis le document' : 'Information du dossier conservée';

    await this.databaseProvider.update(quoteFileEntity, id, {
      quote: updatedQuote,
      pendingConfirmations,
      history: [...quoteFile.history, createQuoteFileHistoryEntry(label)],
    });
  }

  /**
   * Démarre (ou redémarre) le questionnaire pour un extranet donné : mémorise
   * l'instantané des champs qu'il demande et journalise l'événement.
   */
  async startExtranetQuestionnaire(
    id: string,
    quoteFile: QuoteFileModel,
    extranetId: string,
    requiredFields: RequiredField[]
  ): Promise<void> {
    if (!this.authStore.uid()) return;

    await this.databaseProvider.update(quoteFileEntity, id, {
      extranetQuestionnaires: {
        ...quoteFile.extranetQuestionnaires,
        [extranetId]: {
          extranetId,
          requiredFields,
          status: 'in_progress',
          startedAt: Date.now(),
        },
      },
      history: [...quoteFile.history, createQuoteFileHistoryEntry(`Questionnaire ${extranetId} commencé`)],
    });
  }

  /**
   * Enregistre la réponse du courtier directement dans le modèle canonique
   * du dossier (jamais une copie séparée) et journalise l'événement.
   */
  async answerQuestion(
    id: string,
    quoteFile: QuoteFileModel,
    question: QuestionnaireQuestion,
    value: unknown
  ): Promise<void> {
    if (!this.authStore.uid()) return;

    const { quote, pendingConfirmations } = applyQuestionAnswer(quoteFile, question, value);

    await this.databaseProvider.update(quoteFileEntity, id, {
      quote,
      pendingConfirmations,
      history: [...quoteFile.history, createQuoteFileHistoryEntry(`Réponse enregistrée : ${question.label}`)],
    });
  }

  /** Marque le questionnaire d'un extranet comme terminé — le dossier est prêt pour cet extranet. */
  async completeExtranetQuestionnaire(id: string, quoteFile: QuoteFileModel, extranetId: string): Promise<void> {
    if (!this.authStore.uid()) return;

    const current = quoteFile.extranetQuestionnaires[extranetId];
    if (!current || current.status === 'complete') return;

    await this.databaseProvider.update(quoteFileEntity, id, {
      extranetQuestionnaires: {
        ...quoteFile.extranetQuestionnaires,
        [extranetId]: { ...current, status: 'complete', completedAt: Date.now() },
      },
      history: [
        ...quoteFile.history,
        createQuoteFileHistoryEntry(`Questionnaire ${extranetId} terminé`),
        createQuoteFileHistoryEntry(`Dossier prêt pour ${extranetId}`),
      ],
    });
  }

  /**
   * Enregistre le résultat d'une tentative de remplissage réel sur un
   * extranet (via Form Agent). S'il reste des informations manquantes,
   * rouvre le questionnaire pour cet extranet avec UNIQUEMENT ces
   * informations — jamais les questions déjà répondues.
   */
  async recordFillResult(
    id: string,
    quoteFile: QuoteFileModel,
    extranetId: string,
    outcome: {
      status: ExtranetFillStatus;
      filledFieldsCount: number;
      missingFields: RequiredField[];
      lastStepReached: number | null;
    }
  ): Promise<void> {
    if (!this.authStore.uid()) return;

    const result: ExtranetFillResult = {
      extranetId,
      status: outcome.status,
      filledFieldsCount: outcome.filledFieldsCount,
      missingFieldsCount: outcome.missingFields.length,
      lastStepReached: outcome.lastStepReached,
      attemptedAt: Date.now(),
    };

    const extranetQuestionnaires = { ...quoteFile.extranetQuestionnaires };
    if (outcome.missingFields.length > 0) {
      extranetQuestionnaires[extranetId] = {
        extranetId,
        requiredFields: outcome.missingFields,
        status: 'in_progress',
        startedAt: Date.now(),
      };
    }

    const historyLabel =
      outcome.status === 'ready'
        ? `Formulaire rempli (${extranetId})`
        : outcome.status === 'partially_filled'
          ? `Formulaire partiellement rempli (${extranetId}) — informations manquantes`
          : `Le remplissage nécessite votre intervention (${extranetId})`;

    await this.databaseProvider.update(quoteFileEntity, id, {
      extranetResults: { ...quoteFile.extranetResults, [extranetId]: result },
      extranetQuestionnaires,
      history: [...quoteFile.history, createQuoteFileHistoryEntry(historyLabel)],
    });
  }

  /**
   * Journalise un événement ponctuel dans l'historique du dossier (ex :
   * compagnie sélectionnée, remplissage commencé, erreur de remplissage) sans
   * toucher au reste du dossier. Réutilise le même mécanisme d'historique que
   * toutes les autres méthodes — jamais un système parallèle.
   */
  async logEvent(id: string, quoteFile: QuoteFileModel, label: string): Promise<void> {
    if (!this.authStore.uid()) return;
    await this.databaseProvider.update(quoteFileEntity, id, {
      history: [...quoteFile.history, createQuoteFileHistoryEntry(label)],
    });
  }

  /** Flux temps réel des dossiers du courtier connecté, du plus récent au plus ancien. */
  listMine(): Observable<QuoteFileModel[]> {
    const ownerUid = this.authStore.uid();
    if (!ownerUid) return of([]);

    const query = new DatabaseQueryBuilder()
      .where('ownerUid', FilterOperator.isEqualTo, ownerUid)
      .orderBy('lastUpdatedAt', OrderByDirection.desc)
      .build();

    return this.databaseProvider.list(quoteFileEntity, query);
  }
}
