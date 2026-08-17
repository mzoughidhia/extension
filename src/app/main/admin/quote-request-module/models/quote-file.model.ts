import { DatabaseEntity, DocumentFields, databaseEntity } from '@karma-solutions-org/ngx-sg';

import { DocumentRef } from '../../document-module/models/document-ref.model';
import { PendingConfirmation } from '../../document-module/models/pending-confirmation.model';
import { ExtranetQuestionnaireState } from './questionnaire.model';
import { QuoteRequest, createEmptyQuoteRequest } from './quote-request.model';

/**
 * Statut du dossier de devis.
 *
 * Phase 1 (persistance + reprise) : seuls `draft` et `submitted` existent.
 * Les statuts liés aux extranets (`in_progress`, `completed`) seront ajoutés
 * lorsque le questionnaire dynamique et les résultats extranets seront
 * implémentés — ne pas les anticiper ici.
 */
export type QuoteFileStatus = 'draft' | 'submitted';

/** Un événement de la timeline du dossier (historique minimal, Phase 1). */
export interface QuoteFileHistoryEntry {
  label: string;
  /** Horodatage en millisecondes epoch (cohérent avec `createdAt`/`lastUpdatedAt` du provider). */
  timestamp: number;
}

export type ExtranetFillStatus = 'ready' | 'partially_filled' | 'blocked';

/**
 * Résultat de la dernière tentative de remplissage réel sur un extranet
 * (via Form Agent) — faits observables uniquement, jamais de détail Gemini.
 */
export interface ExtranetFillResult {
  extranetId: string;
  status: ExtranetFillStatus;
  filledFieldsCount: number;
  missingFieldsCount: number;
  lastStepReached: number | null;
  attemptedAt: number;
}

/**
 * Le "dossier de devis" persisté — enveloppe le `QuoteRequest` existant
 * (client/véhicule/conducteur/historique assurance, INCHANGÉ) avec ce qu'il
 * faut pour la persistance, la reprise, et une timeline minimale.
 *
 * `id`, `createdAt` et `lastUpdatedAt` sont gérés par le `DatabaseProvider`.
 */
export interface QuoteFileModel extends DatabaseEntity {
  /** UID du courtier propriétaire du dossier (jamais partagé entre utilisateurs). */
  ownerUid: string;
  status: QuoteFileStatus;
  /** Le modèle canonique existant — aucune donnée dupliquée, aucun nouveau format. */
  quote: QuoteRequest;
  /** Timeline minimale du dossier. */
  history: QuoteFileHistoryEntry[];
  /** Métadonnées des documents ajoutés (fichiers réels dans Storage, jamais ici). */
  documents: DocumentRef[];
  /** Informations extraites par OCR en attente d'une décision du courtier. */
  pendingConfirmations: PendingConfirmation[];
  /**
   * État du questionnaire par extranet (clé = identifiant de l'extranet).
   * Le même dossier peut avoir un état différent par extranet ; les réponses
   * enrichissent toujours le même `quote` central, jamais une copie séparée.
   */
  extranetQuestionnaires: Record<string, ExtranetQuestionnaireState>;
  /** Dernier résultat de remplissage réel par extranet (clé = identifiant de l'extranet). */
  extranetResults: Record<string, ExtranetFillResult>;
}

/** Construit un événement d'historique horodaté. */
export function createQuoteFileHistoryEntry(label: string): QuoteFileHistoryEntry {
  return { label, timestamp: Date.now() };
}

function quoteFileFromMap(json: DocumentFields<QuoteFileModel>): QuoteFileModel {
  return {
    id: json['id'] as string | undefined,
    createdAt: json['createdAt'] as number | undefined,
    lastUpdatedAt: json['lastUpdatedAt'] as number | undefined,
    ownerUid: (json['ownerUid'] as string) ?? '',
    status: (json['status'] as QuoteFileStatus) ?? 'draft',
    quote: (json['quote'] as QuoteRequest) ?? createEmptyQuoteRequest(),
    history: (json['history'] as QuoteFileHistoryEntry[]) ?? [],
    documents: (json['documents'] as DocumentRef[]) ?? [],
    pendingConfirmations: (json['pendingConfirmations'] as PendingConfirmation[]) ?? [],
    extranetQuestionnaires:
      (json['extranetQuestionnaires'] as Record<string, ExtranetQuestionnaireState>) ?? {},
    extranetResults: (json['extranetResults'] as Record<string, ExtranetFillResult>) ?? {},
  };
}

/** Descripteur de la collection `quoteFiles`, utilisé avec `DatabaseProvider`. */
export const quoteFileEntity = databaseEntity('quoteFiles', quoteFileFromMap);
