import { TestBed } from '@angular/core/testing';
import {
  AuthenticatedUserModel,
  AuthenticationProvider,
  DatabaseProvider,
} from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider } from '@karma-solutions-org/ngx-sg/testing';
import { BehaviorSubject, of } from 'rxjs';

import { createEmptyQuoteRequest } from '../models/quote-request.model';
import { QuoteFileModel, quoteFileEntity } from '../models/quote-file.model';
import { QuoteFileService } from './quote-file.service';

function buildUser(uid: string): AuthenticatedUserModel {
  return {
    uid,
    email: 'courtier@example.com',
    displayName: undefined,
    isEmailVerified: true,
    isNewUser: false,
    claims: {},
    authenticationSignInProviderUsersMap: {},
  } as AuthenticatedUserModel;
}

describe('QuoteFileService', () => {
  let service: QuoteFileService;
  let databaseProvider: jasmine.SpyObj<DatabaseProvider>;
  let authState$: BehaviorSubject<AuthenticatedUserModel | undefined>;

  beforeEach(() => {
    databaseProvider = createMockDatabaseProvider();
    authState$ = new BehaviorSubject<AuthenticatedUserModel | undefined>(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: DatabaseProvider, useValue: databaseProvider },
        {
          provide: AuthenticationProvider,
          useValue: {
            authenticationStateChanges: jasmine.createSpy().and.returnValue(authState$.asObservable()),
            signInWithEmailAndPassword: jasmine.createSpy(),
            signOut: jasmine.createSpy(),
          },
        },
      ],
    });

    service = TestBed.inject(QuoteFileService);
  });

  describe('sans courtier authentifié', () => {
    it('create() ne persiste rien et retourne null', async () => {
      const result = await service.create(createEmptyQuoteRequest());

      expect(result).toBeNull();
      expect(databaseProvider.add).not.toHaveBeenCalled();
    });

    it('save() ne persiste rien', async () => {
      await service.save('file-1', createEmptyQuoteRequest());

      expect(databaseProvider.update).not.toHaveBeenCalled();
    });

    it('listMine() renvoie un flux vide', (done) => {
      service.listMine().subscribe((files) => {
        expect(files).toEqual([]);
        done();
      });
    });
  });

  describe('avec un courtier authentifié', () => {
    beforeEach(() => {
      authState$.next(buildUser('uid-42'));
    });

    it('create() enregistre le dossier avec ownerUid et un premier événement d\'historique', async () => {
      databaseProvider.add.and.callFake((_entity, data) => Promise.resolve({ ...data, id: 'file-1' }));

      const result = await service.create(createEmptyQuoteRequest());

      expect(databaseProvider.add).toHaveBeenCalledTimes(1);
      const [, payload] = databaseProvider.add.calls.mostRecent().args as unknown as [unknown, QuoteFileModel];
      expect(payload.ownerUid).toBe('uid-42');
      expect(payload.status).toBe('draft');
      expect(payload.history.length).toBe(1);
      expect(payload.history[0].label).toBe('Dossier créé');
      expect(result?.id).toBe('file-1');
    });

    it('save() met à jour uniquement le champ quote', async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quote = { ...createEmptyQuoteRequest(), client: { ...createEmptyQuoteRequest().client, firstName: 'Test' } };

      await service.save('file-1', quote);

      expect(databaseProvider.update).toHaveBeenCalledWith(
        quoteFileEntity,
        'file-1',
        { quote } as unknown as Parameters<DatabaseProvider['update']>[2]
      );
    });

    it("markSubmitted() passe le statut à 'submitted' et ajoute un événement à l'historique existant", async () => {
      databaseProvider.update.and.resolveTo(undefined);

      await service.markSubmitted('file-1', [{ label: 'Dossier créé', timestamp: 1000 }]);

      const [, id, payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'status' | 'history'>,
      ];
      expect(id).toBe('file-1');
      expect(payload.status).toBe('submitted');
      expect(payload.history.length).toBe(2);
      expect(payload.history[1].label).toBe('Demande préparée');
    });

    it('listMine() interroge la collection filtrée par ownerUid', () => {
      databaseProvider.list.and.returnValue(of([]));

      service.listMine().subscribe();

      expect(databaseProvider.list).toHaveBeenCalledTimes(1);
      const [, query] = databaseProvider.list.calls.mostRecent().args;
      expect(query.wheres.some((w: { field: string }) => w.field === 'ownerUid')).toBeTrue();
    });

    it('getById() lit le dossier via le provider', async () => {
      databaseProvider.getById.and.returnValue(
        of(buildQuoteFile())
      );

      const result = await service.getById('file-1');

      expect(result?.id).toBe('file-1');
      expect(databaseProvider.getById).toHaveBeenCalledWith(quoteFileEntity, 'file-1');
    });

    it('watchById() renvoie le flux temps réel du provider (statut OCR en direct)', () => {
      const quoteFile$ = of(buildQuoteFile());
      databaseProvider.getById.and.returnValue(quoteFile$);

      const result = service.watchById('file-1');

      expect(result).toBe(quoteFile$);
      expect(databaseProvider.getById).toHaveBeenCalledWith(quoteFileEntity, 'file-1');
    });

    it("addDocument() ajoute le document et journalise l'ajout dans l'historique existant", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile();
      const documentRef = {
        id: 'doc-1',
        type: 'carte_grise' as const,
        fileName: 'carte-grise.jpg',
        storagePath: 'path/carte-grise.jpg',
        uploadedAt: Date.now(),
        ocrStatus: 'pending' as const,
      };

      await service.addDocument('file-1', quoteFile, documentRef);

      const [, id, payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'documents' | 'history'>,
      ];
      expect(id).toBe('file-1');
      expect(payload.documents).toEqual([documentRef]);
      expect(payload.history[payload.history.length - 1].label).toContain('Document ajouté');
    });

    it('updateDocumentStatus() met à jour uniquement le statut du document ciblé', async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const documentRef = {
        id: 'doc-1',
        type: 'carte_grise' as const,
        fileName: 'carte-grise.jpg',
        storagePath: 'path',
        uploadedAt: Date.now(),
        ocrStatus: 'pending' as const,
      };
      const quoteFile = buildQuoteFile({ documents: [documentRef] });

      await service.updateDocumentStatus('file-1', quoteFile, 'doc-1', 'processing');

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'documents'>,
      ];
      expect(payload.documents[0].ocrStatus).toBe('processing');
    });

    it('applyOcrResult() met à jour le dossier, le document, les confirmations et l\'historique', async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const documentRef = {
        id: 'doc-1',
        type: 'carte_grise' as const,
        fileName: 'carte-grise.jpg',
        storagePath: 'path',
        uploadedAt: Date.now(),
        ocrStatus: 'processing' as const,
      };
      const quoteFile = buildQuoteFile({ documents: [documentRef] });
      const updatedQuote = { ...quoteFile.quote, vehicle: { ...quoteFile.quote.vehicle, brand: 'Yamaha' } };

      await service.applyOcrResult('file-1', quoteFile, {
        documentId: 'doc-1',
        quote: updatedQuote,
        extractedFieldCount: 5,
        newConfirmations: [],
      });

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'quote' | 'documents' | 'history'>,
      ];
      expect(payload.quote.vehicle.brand).toBe('Yamaha');
      expect(payload.documents[0].ocrStatus).toBe('done');
      expect((payload.documents[0] as { extractedFieldCount?: number }).extractedFieldCount).toBe(5);
      expect(payload.history[payload.history.length - 1].label).toContain('Informations extraites');
    });

    it('resolveConfirmation() retire la confirmation traitée et journalise la décision', async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile({
        pendingConfirmations: [
          {
            id: 'conf-1',
            documentId: 'doc-1',
            canonicalPath: 'vehicle.brand',
            label: 'Marque',
            currentValue: null,
            currentIsKnown: false,
            ocrValue: 'Yamaha',
            ocrConfidence: 'high',
            createdAt: Date.now(),
          },
        ],
      });

      await service.resolveConfirmation('file-1', quoteFile, 'conf-1', quoteFile.quote, 'useOcr');

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'pendingConfirmations' | 'history'>,
      ];
      expect(payload.pendingConfirmations).toEqual([]);
      expect(payload.history[payload.history.length - 1].label).toContain('confirmée');
    });

    it("startExtranetQuestionnaire() mémorise l'instantané des champs requis et journalise le début", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile();
      const requiredFields = [
        { canonicalPath: 'vehicle.registration' as const, label: 'Immatriculation', type: 'text' as const, required: true },
      ];

      await service.startExtranetQuestionnaire('file-1', quoteFile, 'april-moto', requiredFields);

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'extranetQuestionnaires' | 'history'>,
      ];
      expect(payload.extranetQuestionnaires['april-moto'].status).toBe('in_progress');
      expect(payload.extranetQuestionnaires['april-moto'].requiredFields).toEqual(requiredFields);
      expect(payload.history[payload.history.length - 1].label).toContain('Questionnaire april-moto commencé');
    });

    it("answerQuestion() écrit la réponse dans le dossier et journalise l'événement", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile();
      const question = {
        id: 'q_vehicle.brand',
        canonicalPath: 'vehicle.brand' as const,
        label: 'Marque',
        type: 'text' as const,
        required: true,
        currentValue: null,
        source: 'missing' as const,
      };

      await service.answerQuestion('file-1', quoteFile, question, 'Yamaha');

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'quote' | 'history'>,
      ];
      expect(payload.quote.vehicle.brand).toBe('Yamaha');
      expect(payload.history[payload.history.length - 1].label).toContain('Réponse enregistrée : Marque');
    });

    it("completeExtranetQuestionnaire() passe le statut à 'complete' et journalise deux événements", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile({
        extranetQuestionnaires: {
          'april-moto': {
            extranetId: 'april-moto',
            requiredFields: [],
            status: 'in_progress',
            startedAt: Date.now(),
          },
        },
      });

      await service.completeExtranetQuestionnaire('file-1', quoteFile, 'april-moto');

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'extranetQuestionnaires' | 'history'>,
      ];
      expect(payload.extranetQuestionnaires['april-moto'].status).toBe('complete');
      const newHistoryLabels = payload.history.slice(-2).map((h) => h.label);
      expect(newHistoryLabels).toEqual(['Questionnaire april-moto terminé', 'Dossier prêt pour april-moto']);
    });

    it("completeExtranetQuestionnaire() ne fait rien si le questionnaire n'existe pas ou est déjà terminé", async () => {
      const quoteFile = buildQuoteFile();

      await service.completeExtranetQuestionnaire('file-1', quoteFile, 'inconnu');

      expect(databaseProvider.update).not.toHaveBeenCalled();
    });

    it("recordFillResult() enregistre le résultat et journalise 'Formulaire extranet rempli' quand tout est rempli", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile();

      await service.recordFillResult('file-1', quoteFile, 'april-moto', {
        status: 'ready',
        filledFieldsCount: 5,
        missingFields: [],
        lastStepReached: 2,
      });

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'extranetResults' | 'extranetQuestionnaires' | 'history'>,
      ];
      expect(payload.extranetResults['april-moto']).toEqual(
        jasmine.objectContaining({ status: 'ready', filledFieldsCount: 5, missingFieldsCount: 0, lastStepReached: 2 })
      );
      expect(payload.history[payload.history.length - 1].label).toContain('Formulaire rempli');
    });

    it("recordFillResult() rouvre le questionnaire avec UNIQUEMENT les champs manquants s'il en reste", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile();
      const missingField = {
        canonicalPath: 'vehicle.parkingType' as const,
        label: 'Stationnement',
        type: 'choice' as const,
        required: true,
      };

      await service.recordFillResult('file-1', quoteFile, 'april-moto', {
        status: 'partially_filled',
        filledFieldsCount: 4,
        missingFields: [missingField],
        lastStepReached: 1,
      });

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'extranetResults' | 'extranetQuestionnaires' | 'history'>,
      ];
      expect(payload.extranetQuestionnaires['april-moto'].status).toBe('in_progress');
      expect(payload.extranetQuestionnaires['april-moto'].requiredFields).toEqual([missingField]);
      expect(payload.history[payload.history.length - 1].label).toContain('partiellement rempli');
    });

    it("recordFillResult() journalise 'nécessite votre intervention' quand rien n'a pu être rempli", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile();

      await service.recordFillResult('file-1', quoteFile, 'april-moto', {
        status: 'blocked',
        filledFieldsCount: 0,
        missingFields: [
          { canonicalPath: 'vehicle.registration' as const, label: 'Immatriculation', type: 'text' as const, required: true },
        ],
        lastStepReached: null,
      });

      const [, , payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'extranetResults' | 'history'>,
      ];
      expect(payload.extranetResults['april-moto'].status).toBe('blocked');
      expect(payload.history[payload.history.length - 1].label).toContain('nécessite votre intervention');
    });

    it("logEvent() ajoute un événement ponctuel à l'historique existant", async () => {
      databaseProvider.update.and.resolveTo(undefined);
      const quoteFile = buildQuoteFile();

      await service.logEvent('file-1', quoteFile, 'Compagnie sélectionnée : April Moto');

      const [, id, payload] = databaseProvider.update.calls.mostRecent().args as unknown as [
        unknown,
        string,
        Pick<QuoteFileModel, 'history'>,
      ];
      expect(id).toBe('file-1');
      expect(payload.history[payload.history.length - 1].label).toBe('Compagnie sélectionnée : April Moto');
    });

    it("logEvent() ne persiste rien sans courtier authentifié", async () => {
      authState$.next(undefined);
      const quoteFile = buildQuoteFile();

      await service.logEvent('file-1', quoteFile, 'Compagnie sélectionnée : April Moto');

      expect(databaseProvider.update).not.toHaveBeenCalled();
    });
  });
});

function buildQuoteFile(overrides: Partial<QuoteFileModel> = {}): QuoteFileModel {
  return {
    id: 'file-1',
    ownerUid: 'uid-42',
    status: 'draft',
    quote: createEmptyQuoteRequest(),
    history: [{ label: 'Dossier créé', timestamp: 1_700_000_000_000 }],
    documents: [],
    pendingConfirmations: [],
    extranetQuestionnaires: {},
    extranetResults: {},
    ...overrides,
  };
}
