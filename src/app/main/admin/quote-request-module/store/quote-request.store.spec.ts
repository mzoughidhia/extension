import { TestBed } from '@angular/core/testing';
import {
  AuthenticatedUserModel,
  AuthenticationProvider,
  DatabaseProvider,
} from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider } from '@karma-solutions-org/ngx-sg/testing';
import { BehaviorSubject, of } from 'rxjs';

import { FieldKnowledge, unknownField, declaredUnknownField, knownField } from '../models/field-knowledge.model';
import { QuoteRequestStore } from './quote-request.store';
import { createEmptyQuoteRequest } from '../models/quote-request.model';

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

describe('QuoteRequestStore', () => {
  let store: InstanceType<typeof QuoteRequestStore>;
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
    store = TestBed.inject(QuoteRequestStore);
    store.reset();
  });

  // ─── Navigation ──────────────────────────────────────────────────────────

  describe('navigation', () => {
    it('should start at step 0', () => {
      expect(store.activeStep()).toBe(0);
    });

    it('should advance to next step', () => {
      store.nextStep();
      expect(store.activeStep()).toBe(1);
    });

    it('should not go before step 0', () => {
      store.prevStep();
      expect(store.activeStep()).toBe(0);
    });

    it('should not go past step 4', () => {
      store.goToStep(4);
      store.nextStep();
      expect(store.activeStep()).toBe(4);
    });

    it('should go to specific step', () => {
      store.goToStep(3);
      expect(store.activeStep()).toBe(3);
    });

    it('isFirstStep should be true at step 0', () => {
      expect(store.isFirstStep()).toBe(true);
    });

    it('isLastStep should be true at step 4', () => {
      store.goToStep(4);
      expect(store.isLastStep()).toBe(true);
    });
  });

  // ─── Draft ────────────────────────────────────────────────────────────────

  describe('patchDraft', () => {
    it('should update client in draft', () => {
      store.patchDraft({
        client: {
          firstName: 'Mohamed',
          lastName: 'Dupont',
          nationalId: null,
          birthDate: null,
          phone: null,
          email: null,
          address: null,
          postalCode: null,
          city: null,
          country: null,
        },
      });
      expect(store.draft().client.firstName).toBe('Mohamed');
      expect(store.draft().client.lastName).toBe('Dupont');
    });

    it('should preserve other sections when patching client', () => {
      store.patchDraft({ vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Renault' } });
      store.patchDraft({ client: { ...createEmptyQuoteRequest().client, firstName: 'Test' } });
      expect(store.draft().vehicle.brand).toBe('Renault');
      expect(store.draft().client.firstName).toBe('Test');
    });
  });

  // ─── Soumission ───────────────────────────────────────────────────────────

  describe('submitDraft', () => {
    it('should set isSubmitted to true', () => {
      store.submitDraft();
      expect(store.isSubmitted()).toBe(true);
    });

    it('should set success message', () => {
      store.submitDraft();
      expect(store.successMessage()).toBe('Demande préparée avec succès.');
    });

    it('should clear success message after clearSuccess', () => {
      store.submitDraft();
      store.clearSuccess();
      expect(store.successMessage()).toBeNull();
    });
  });

  // ─── Reset ────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should reset to initial state', () => {
      store.nextStep();
      store.patchDraft({ client: { ...createEmptyQuoteRequest().client, firstName: 'Test' } });
      store.reset();
      expect(store.activeStep()).toBe(0);
      expect(store.draft().client.firstName).toBe('');
    });
  });

  // ─── Persistance (Firestore, via QuoteFileService) ────────────────────────

  describe('persistance', () => {
    it('sans courtier authentifié, ensureQuoteFile ne crée aucun dossier', async () => {
      await store.ensureQuoteFile();

      expect(store.quoteFileId()).toBeNull();
      expect(databaseProvider.add).not.toHaveBeenCalled();
    });

    it('sans courtier authentifié, patchDraft continue de fonctionner en local uniquement', () => {
      store.patchDraft({ client: { ...createEmptyQuoteRequest().client, firstName: 'Local' } });

      expect(store.draft().client.firstName).toBe('Local');
      expect(databaseProvider.update).not.toHaveBeenCalled();
    });

    describe('avec un courtier authentifié', () => {
      beforeEach(() => {
        authState$.next(buildUser('uid-1'));
      });

      it('ensureQuoteFile crée le dossier une seule fois (idempotent)', async () => {
        databaseProvider.add.and.callFake((_entity, data) =>
          Promise.resolve({ ...data, id: 'file-1' })
        );

        await store.ensureQuoteFile();
        await store.ensureQuoteFile();

        expect(databaseProvider.add).toHaveBeenCalledTimes(1);
        expect(store.quoteFileId()).toBe('file-1');
        expect(store.history().length).toBe(1);
      });

      it('patchDraft enregistre immédiatement le brouillon une fois le dossier créé', async () => {
        databaseProvider.add.and.callFake((_entity, data) =>
          Promise.resolve({ ...data, id: 'file-1' })
        );
        databaseProvider.update.and.resolveTo(undefined);

        await store.ensureQuoteFile();
        store.patchDraft({ client: { ...createEmptyQuoteRequest().client, firstName: 'Mohamed' } });

        expect(databaseProvider.update).toHaveBeenCalledWith(
          jasmine.anything(),
          'file-1',
          jasmine.objectContaining({ quote: jasmine.objectContaining({ client: jasmine.objectContaining({ firstName: 'Mohamed' }) }) })
        );
      });

      it('resumeQuoteFile recharge le brouillon, l\'étape et l\'historique du dossier', async () => {
        const remoteQuote = { ...createEmptyQuoteRequest(), client: { ...createEmptyQuoteRequest().client, firstName: 'Repris' } };
        databaseProvider.getById.and.returnValue(
          of({
            id: 'file-1',
            ownerUid: 'uid-1',
            status: 'draft' as const,
            quote: remoteQuote,
            history: [{ label: 'Dossier créé', timestamp: 123 }],
          })
        );

        await store.resumeQuoteFile('file-1');

        expect(store.draft().client.firstName).toBe('Repris');
        expect(store.quoteFileId()).toBe('file-1');
        expect(store.history().length).toBe(1);
        expect(store.activeStep()).toBe(0);
        expect(store.isSubmitted()).toBeFalse();
      });

      it('submitDraft marque le dossier comme soumis quand un dossier existe', async () => {
        databaseProvider.add.and.callFake((_entity, data) =>
          Promise.resolve({ ...data, id: 'file-1' })
        );
        databaseProvider.update.and.resolveTo(undefined);

        await store.ensureQuoteFile();
        await store.submitDraft();

        expect(databaseProvider.update).toHaveBeenCalledWith(
          jasmine.anything(),
          'file-1',
          jasmine.objectContaining({ status: 'submitted' })
        );
      });
    });
  });
});

// ─── FieldKnowledge — tests du modèle ─────────────────────────────────────

describe('FieldKnowledge model', () => {
  it('unknownField should have UNKNOWN knowledge', () => {
    const field = unknownField<number>();
    expect(field.knowledge).toBe(FieldKnowledge.UNKNOWN);
    expect(field.value).toBeNull();
  });

  it('declaredUnknownField should have DECLARED_UNKNOWN knowledge', () => {
    const field = declaredUnknownField<number>();
    expect(field.knowledge).toBe(FieldKnowledge.DECLARED_UNKNOWN);
    expect(field.value).toBeNull();
  });

  it('knownField should have KNOWN knowledge and correct value', () => {
    const field = knownField<number>(3);
    expect(field.knowledge).toBe(FieldKnowledge.KNOWN);
    expect(field.value).toBe(3);
  });

  it('0 claims should be KNOWN with value 0, not UNKNOWN', () => {
    const field = knownField<number>(0);
    expect(field.knowledge).toBe(FieldKnowledge.KNOWN);
    expect(field.value).toBe(0);
  });

  it('DECLARED_UNKNOWN should never be confused with 0', () => {
    const declared = declaredUnknownField<number>();
    const zero = knownField<number>(0);
    expect(declared.knowledge).not.toBe(zero.knowledge);
    expect(declared.value).not.toBe(zero.value);
  });
});
