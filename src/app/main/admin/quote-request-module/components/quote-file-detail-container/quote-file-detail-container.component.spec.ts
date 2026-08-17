import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AuthenticationProvider, DatabaseProvider, StorageProvider } from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider, createMockStorageProvider } from '@karma-solutions-org/ngx-sg/testing';
import { of, throwError } from 'rxjs';

import { QuoteFileDetailContainerComponent } from './quote-file-detail-container.component';
import { OcrProvider } from '../../../document-module/services/ocr-provider';
import { ExtranetLinkModel } from '../../models/extranet-link.model';
import { QuoteFileModel } from '../../models/quote-file.model';
import { createEmptyQuoteRequest } from '../../models/quote-request.model';
import { ExtranetLinkService } from '../../services/extranet-link.service';
import {
  FormAgentAnalysisError,
  FormAgentBridgeService,
  FormAgentFillError,
  FormAgentUnavailableError,
} from '../../services/form-agent-bridge.service';
import { QuoteFileService } from '../../services/quote-file.service';

function buildQuoteFile(overrides: Partial<QuoteFileModel> = {}): QuoteFileModel {
  return {
    id: 'file-1',
    ownerUid: 'uid-1',
    status: 'draft',
    quote: createEmptyQuoteRequest(),
    history: [],
    documents: [],
    pendingConfirmations: [],
    extranetQuestionnaires: {},
    extranetResults: {},
    ...overrides,
  };
}

function buildLink(overrides: Partial<ExtranetLinkModel> = {}): ExtranetLinkModel {
  return {
    id: 'link-april',
    ownerUid: 'uid-1',
    company: 'April',
    product: 'Moto',
    name: 'Devis Moto',
    url: 'https://www.april-on.fr/devis-moto',
    active: true,
    ...overrides,
  };
}

const AXA_LINK = buildLink({ id: 'link-axa', company: 'AXA', product: 'Moto', url: 'https://axa.fr/devis-moto' });

describe('QuoteFileDetailContainerComponent — pont Form Agent', () => {
  let component: QuoteFileDetailContainerComponent;
  let fixture: ComponentFixture<QuoteFileDetailContainerComponent>;
  let quoteFileServiceSpy: jasmine.SpyObj<QuoteFileService>;
  let formAgentBridgeSpy: jasmine.SpyObj<FormAgentBridgeService>;
  let extranetLinkServiceSpy: jasmine.SpyObj<ExtranetLinkService>;

  function setup(links: ExtranetLinkModel[] = [buildLink()], quoteFile: QuoteFileModel = buildQuoteFile()) {
    quoteFileServiceSpy = jasmine.createSpyObj('QuoteFileService', [
      'watchById',
      'startExtranetQuestionnaire',
      'completeExtranetQuestionnaire',
      'recordFillResult',
      'logEvent',
    ]);
    quoteFileServiceSpy.watchById.and.returnValue(of(quoteFile));
    quoteFileServiceSpy.startExtranetQuestionnaire.and.resolveTo();
    quoteFileServiceSpy.completeExtranetQuestionnaire.and.resolveTo();
    quoteFileServiceSpy.recordFillResult.and.resolveTo();
    quoteFileServiceSpy.logEvent.and.resolveTo();

    formAgentBridgeSpy = jasmine.createSpyObj('FormAgentBridgeService', ['prepareExtranetQuote', 'fillExtranetQuote']);

    extranetLinkServiceSpy = jasmine.createSpyObj('ExtranetLinkService', ['listActiveMine']);
    extranetLinkServiceSpy.listActiveMine.and.returnValue(of(links));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [QuoteFileDetailContainerComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: QuoteFileService, useValue: quoteFileServiceSpy },
        { provide: FormAgentBridgeService, useValue: formAgentBridgeSpy },
        { provide: ExtranetLinkService, useValue: extranetLinkServiceSpy },
        { provide: DatabaseProvider, useValue: createMockDatabaseProvider() },
        { provide: StorageProvider, useValue: createMockStorageProvider() },
        { provide: OcrProvider, useValue: jasmine.createSpyObj('OcrProvider', ['extract']) },
        {
          provide: AuthenticationProvider,
          useValue: {
            authenticationStateChanges: jasmine.createSpy().and.returnValue(of(undefined)),
            signInWithEmailAndPassword: jasmine.createSpy(),
            signOut: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteFileDetailContainerComponent);
    fixture.componentRef.setInput('quoteFileId', 'file-1');
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => setup());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('expose les extranets actifs comme compagnies disponibles pour ce dossier', () => {
    expect(component.extranetLinks().map((l) => l.company)).toEqual(['April']);
  });

  it("aucune compagnie n'est sélectionnée avant que le courtier n'en choisisse une", () => {
    expect(component.selectedExtranet()).toBeNull();
  });

  it('onSelectCompany() sélectionne la compagnie ciblée', () => {
    component.onSelectCompany(buildLink());

    expect(component.selectedExtranetId()).toBe('link-april');
    expect(component.selectedExtranet()?.company).toBe('April');
  });

  describe('onStartQuestionnaire()', () => {
    beforeEach(() => component.onSelectCompany(buildLink()));

    it("sollicite Form Agent avec le dossier et l'extranet sélectionné (jamais April codé en dur)", () => {
      formAgentBridgeSpy.prepareExtranetQuote.and.returnValue(of([]));

      component.onStartQuestionnaire();

      expect(formAgentBridgeSpy.prepareExtranetQuote).toHaveBeenCalledWith(
        jasmine.objectContaining({
          quoteFileId: 'file-1',
          extranetId: 'link-april',
          extranetUrl: 'https://www.april-on.fr/devis-moto',
        })
      );
    });

    it('une réponse réussie démarre le questionnaire avec les champs réellement reçus', () => {
      const fields = [{ canonicalPath: 'vehicle.brand' as const, label: 'Marque', type: 'text' as const, required: true }];
      formAgentBridgeSpy.prepareExtranetQuote.and.returnValue(of(fields));

      component.onStartQuestionnaire();

      expect(quoteFileServiceSpy.startExtranetQuestionnaire).toHaveBeenCalledWith(
        'file-1',
        jasmine.anything(),
        'link-april',
        fields
      );
      expect(component.formAgentState()).toBe('idle');
    });

    it("affiche un message clair si l'extension n'est pas disponible, sans détail technique", () => {
      formAgentBridgeSpy.prepareExtranetQuote.and.returnValue(throwError(() => new FormAgentUnavailableError()));

      component.onStartQuestionnaire();

      expect(component.formAgentState()).toBe('error');
      expect(component.formAgentErrorMessage()).toBe("Form Agent n'est pas disponible.");
    });

    it("affiche un message clair en cas d'échec d'analyse, sans exposer Gemini ni de code d'erreur", () => {
      formAgentBridgeSpy.prepareExtranetQuote.and.returnValue(throwError(() => new FormAgentAnalysisError()));

      component.onStartQuestionnaire();

      expect(component.formAgentState()).toBe('error');
      const message = component.formAgentErrorMessage()!;
      expect(message).not.toContain('Gemini');
      expect(message).not.toMatch(/\d{3}/);
    });

    it("ne fait rien si aucune compagnie n'est sélectionnée", () => {
      component.selectedExtranetId.set(null);

      component.onStartQuestionnaire();

      expect(formAgentBridgeSpy.prepareExtranetQuote).not.toHaveBeenCalled();
    });
  });

  describe('onFillExtranet()', () => {
    beforeEach(() => component.onSelectCompany(buildLink()));

    it("sollicite Form Agent avec le dossier et l'extranet sélectionné", () => {
      formAgentBridgeSpy.fillExtranetQuote.and.returnValue(
        of({ status: 'ready' as const, filledFieldsCount: 3, missingFields: [], lastStepReached: 1 })
      );

      component.onFillExtranet();

      expect(formAgentBridgeSpy.fillExtranetQuote).toHaveBeenCalledWith(
        jasmine.objectContaining({ quoteFileId: 'file-1', extranetId: 'link-april' })
      );
    });

    it('une réponse réussie enregistre le résultat dans le dossier via QuoteFileService', () => {
      const outcome = { status: 'ready' as const, filledFieldsCount: 5, missingFields: [], lastStepReached: 2 };
      formAgentBridgeSpy.fillExtranetQuote.and.returnValue(of(outcome));

      component.onFillExtranet();

      expect(quoteFileServiceSpy.recordFillResult).toHaveBeenCalledWith('file-1', jasmine.anything(), 'link-april', outcome);
      expect(component.fillState()).toBe('idle');
    });

    it("affiche un message clair en cas d'échec du remplissage, sans détail technique", () => {
      formAgentBridgeSpy.fillExtranetQuote.and.returnValue(throwError(() => new FormAgentFillError()));

      component.onFillExtranet();

      expect(component.fillState()).toBe('error');
      const message = component.fillErrorMessage()!;
      expect(message).not.toContain('Gemini');
      expect(message).not.toMatch(/\d{3}/);
    });

    it("affiche un message clair si l'extension n'est pas disponible pour le remplissage", () => {
      formAgentBridgeSpy.fillExtranetQuote.and.returnValue(throwError(() => new FormAgentUnavailableError()));

      component.onFillExtranet();

      expect(component.fillState()).toBe('error');
      expect(component.fillErrorMessage()).toBe("Form Agent n'est pas disponible.");
    });
  });

  describe('companyStatus()', () => {
    it("est 'not_started' quand rien n'a encore été fait pour cette compagnie", () => {
      expect(component.companyStatus(buildLink())).toBe('not_started');
    });

    it("est 'in_progress' quand un questionnaire existe pour cette compagnie", () => {
      setup(
        [buildLink()],
        buildQuoteFile({
          extranetQuestionnaires: {
            'link-april': { extranetId: 'link-april', requiredFields: [], status: 'in_progress', startedAt: Date.now() },
          },
        })
      );

      expect(component.companyStatus(buildLink())).toBe('in_progress');
    });

    it("est 'ready' quand le dernier résultat de remplissage est prêt", () => {
      setup(
        [buildLink()],
        buildQuoteFile({
          extranetResults: {
            'link-april': {
              extranetId: 'link-april',
              status: 'ready',
              filledFieldsCount: 10,
              missingFieldsCount: 0,
              lastStepReached: 1,
              attemptedAt: Date.now(),
            },
          },
        })
      );

      expect(component.companyStatus(buildLink())).toBe('ready');
    });
  });

  it('deuxième compagnie : le même QuoteFile est réutilisé, avec un questionnaire et un résultat séparés par extranet', () => {
    const quoteFile = buildQuoteFile({
      extranetQuestionnaires: {
        'link-april': { extranetId: 'link-april', requiredFields: [], status: 'complete', startedAt: 1, completedAt: 2 },
      },
      extranetResults: {
        'link-april': {
          extranetId: 'link-april',
          status: 'ready',
          filledFieldsCount: 24,
          missingFieldsCount: 0,
          lastStepReached: 3,
          attemptedAt: 1,
        },
      },
    });
    setup([buildLink(), AXA_LINK], quoteFile);

    // April est déjà prêt.
    expect(component.companyStatus(buildLink())).toBe('ready');
    // AXA n'a pas encore été préparé — même dossier, questionnaire distinct.
    expect(component.companyStatus(AXA_LINK)).toBe('not_started');

    component.onSelectCompany(AXA_LINK);
    formAgentBridgeSpy.prepareExtranetQuote.and.returnValue(of([]));
    component.onStartQuestionnaire();

    // La préparation pour AXA cible bien AXA, sans jamais toucher au résultat April.
    expect(formAgentBridgeSpy.prepareExtranetQuote).toHaveBeenCalledWith(
      jasmine.objectContaining({ quoteFileId: 'file-1', extranetId: 'link-axa', extranetUrl: 'https://axa.fr/devis-moto' })
    );
    expect(quoteFileServiceSpy.startExtranetQuestionnaire).toHaveBeenCalledWith('file-1', quoteFile, 'link-axa', []);
  });

  it("onSelectCompany() journalise la sélection dans l'historique, une seule fois par sélection", () => {
    component.onSelectCompany(buildLink());

    expect(quoteFileServiceSpy.logEvent).toHaveBeenCalledWith(
      'file-1',
      jasmine.anything(),
      'Compagnie sélectionnée : April Moto'
    );
    expect(quoteFileServiceSpy.logEvent).toHaveBeenCalledTimes(1);

    // Resélectionner la même compagnie ne journalise pas un doublon.
    component.onSelectCompany(buildLink());
    expect(quoteFileServiceSpy.logEvent).toHaveBeenCalledTimes(1);
  });

  it('onFillExtranet() journalise le début du remplissage', () => {
    component.onSelectCompany(buildLink());
    formAgentBridgeSpy.fillExtranetQuote.and.returnValue(
      of({ status: 'ready' as const, filledFieldsCount: 1, missingFields: [], lastStepReached: 1 })
    );

    component.onFillExtranet();

    expect(quoteFileServiceSpy.logEvent).toHaveBeenCalledWith(
      'file-1',
      jasmine.anything(),
      'Remplissage commencé (April Moto)'
    );
  });

  it("onFillExtranet() journalise une erreur de remplissage sans détail technique", () => {
    component.onSelectCompany(buildLink());
    formAgentBridgeSpy.fillExtranetQuote.and.returnValue(throwError(() => new FormAgentFillError()));

    component.onFillExtranet();

    expect(quoteFileServiceSpy.logEvent).toHaveBeenCalledWith(
      'file-1',
      jasmine.anything(),
      'Erreur de remplissage (April Moto)'
    );
  });

  describe('readinessSummary()', () => {
    it("est null tant qu'aucune compagnie n'est sélectionnée", () => {
      expect(component.readinessSummary()).toBeNull();
    });

    it('calcule le résumé à partir des champs requis, des documents et des questions restantes', () => {
      const requiredFields = [
        { canonicalPath: 'vehicle.brand' as const, label: 'Marque', type: 'text' as const, required: true },
        { canonicalPath: 'vehicle.registration' as const, label: 'Immatriculation', type: 'text' as const, required: true },
      ];
      const quoteFile = buildQuoteFile({
        documents: [
          {
            id: 'doc-1',
            type: 'carte_grise',
            fileName: 'cg.jpg',
            storagePath: 'path',
            uploadedAt: Date.now(),
            ocrStatus: 'done',
            extractedFieldCount: 3,
          },
        ],
        quote: { ...createEmptyQuoteRequest(), vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Yamaha' } },
        extranetQuestionnaires: {
          'link-april': { extranetId: 'link-april', requiredFields, status: 'in_progress', startedAt: Date.now() },
        },
      });
      setup([buildLink()], quoteFile);
      component.onSelectCompany(buildLink());

      const summary = component.readinessSummary()!;
      expect(summary.requiredCount).toBe(2);
      expect(summary.knownCount).toBe(1);
      expect(summary.missingCount).toBe(1);
      expect(summary.extractedFromDocuments).toBe(3);
    });
  });

  it('companiesWithResults() ne liste que les compagnies ayant un résultat, chacune indépendante', () => {
    const quoteFile = buildQuoteFile({
      extranetResults: {
        'link-april': {
          extranetId: 'link-april',
          status: 'ready',
          filledFieldsCount: 24,
          missingFieldsCount: 0,
          lastStepReached: 3,
          attemptedAt: 1,
        },
      },
    });
    setup([buildLink(), AXA_LINK], quoteFile);

    const companies = component.companiesWithResults();
    expect(companies.map((l) => l.id)).toEqual(['link-april']);
  });

  describe('steps()', () => {
    it('reflète la progression réelle du dossier (documents, préparation, remplissage, résultat)', () => {
      const quoteFile = buildQuoteFile({
        documents: [
          {
            id: 'doc-1',
            type: 'carte_grise',
            fileName: 'cg.jpg',
            storagePath: 'path',
            uploadedAt: Date.now(),
            ocrStatus: 'done',
          },
        ],
        extranetQuestionnaires: {
          'link-april': { extranetId: 'link-april', requiredFields: [], status: 'complete', startedAt: 1, completedAt: 2 },
        },
        extranetResults: {
          'link-april': {
            extranetId: 'link-april',
            status: 'ready',
            filledFieldsCount: 24,
            missingFieldsCount: 0,
            lastStepReached: 3,
            attemptedAt: 1,
          },
        },
      });
      setup([buildLink()], quoteFile);
      component.onSelectCompany(buildLink());

      const byLabel = Object.fromEntries(component.steps().map((s) => [s.label, s.status]));
      expect(byLabel['Documents']).toBe('done');
      expect(byLabel['Préparation']).toBe('done');
      expect(byLabel['Questions']).toBe('done');
      expect(byLabel['Dossier prêt']).toBe('done');
      expect(byLabel['Remplissage']).toBe('done');
      expect(byLabel['Résultat']).toBe('done');
    });
  });
});
