import { TestBed } from '@angular/core/testing';
import { AuthenticationProvider, DatabaseProvider, StorageProvider } from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider, createMockStorageProvider } from '@karma-solutions-org/ngx-sg/testing';
import { of } from 'rxjs';

import { createEmptyQuoteRequest } from '../../quote-request-module/models/quote-request.model';
import { QuoteFileModel } from '../../quote-request-module/models/quote-file.model';
import { DocumentRef } from '../models/document-ref.model';
import { OcrExtractionResult } from '../models/ocr-extraction.model';
import { DocumentService } from './document.service';
import { OcrProvider } from './ocr-provider';

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

function buildDocumentRef(overrides: Partial<DocumentRef> = {}): DocumentRef {
  return {
    id: 'doc-1',
    type: 'carte_grise',
    fileName: 'carte-grise.jpg',
    storagePath: 'quoteFiles/file-1/documents/carte-grise.jpg',
    uploadedAt: Date.now(),
    ocrStatus: 'pending',
    ...overrides,
  };
}

describe('DocumentService', () => {
  let service: DocumentService;
  let storageProvider: jasmine.SpyObj<StorageProvider>;
  let ocrProvider: jasmine.SpyObj<OcrProvider>;
  let databaseProvider: jasmine.SpyObj<DatabaseProvider>;

  beforeEach(() => {
    storageProvider = createMockStorageProvider();
    storageProvider.upload.and.resolveTo([]);

    ocrProvider = jasmine.createSpyObj<OcrProvider>('OcrProvider', ['extract']);

    databaseProvider = createMockDatabaseProvider();
    databaseProvider.update.and.resolveTo(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageProvider, useValue: storageProvider },
        { provide: OcrProvider, useValue: ocrProvider },
        { provide: DatabaseProvider, useValue: databaseProvider },
        {
          provide: AuthenticationProvider,
          useValue: {
            authenticationStateChanges: jasmine.createSpy().and.returnValue(
              of({ uid: 'uid-1', email: 'courtier@example.com', claims: {} })
            ),
            signInWithEmailAndPassword: jasmine.createSpy(),
            signOut: jasmine.createSpy(),
          },
        },
      ],
    });

    service = TestBed.inject(DocumentService);
  });

  describe('addDocument', () => {
    it('upload le fichier dans Storage et ajoute sa référence au dossier', async () => {
      const file = new File(['contenu'], 'carte-grise.jpg');
      const quoteFile = buildQuoteFile();

      const documentRef = await service.addDocument('file-1', quoteFile, 'carte_grise', file);

      expect(storageProvider.upload).toHaveBeenCalledTimes(1);
      const [uploadArgs] = storageProvider.upload.calls.mostRecent().args;
      expect(uploadArgs[0].file).toBe(file);
      expect(uploadArgs[0].filePath).toContain('quoteFiles/file-1/documents/');

      expect(databaseProvider.update).toHaveBeenCalledTimes(1);
      expect(documentRef.type).toBe('carte_grise');
      expect(documentRef.fileName).toBe('carte-grise.jpg');
      expect(documentRef.ocrStatus).toBe('pending');
    });
  });

  describe('runOcr', () => {
    it('fusionne un résultat OCR sans conflit : le champ est appliqué automatiquement, aucune confirmation créée', async () => {
      const documentRef = buildDocumentRef();
      const quoteFile = buildQuoteFile({ documents: [documentRef] });
      const extraction: OcrExtractionResult = {
        documentId: 'doc-1',
        provider: 'mock-ocr',
        extractedAt: Date.now(),
        fields: [{ canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' }],
      };
      ocrProvider.extract.and.resolveTo(extraction);

      await service.runOcr('file-1', quoteFile, documentRef, new File([], 'carte-grise.jpg'));

      // Premier appel : passage à 'processing'. Dernier appel : applyOcrResult.
      const lastCall = databaseProvider.update.calls.mostRecent();
      const payload = lastCall.args[2] as {
        quote: { vehicle: { brand: string | null } };
        pendingConfirmations: unknown[];
      };
      expect(payload.quote.vehicle.brand).toBe('Yamaha');
      expect(payload.pendingConfirmations).toEqual([]);
    });

    it('transforme un conflit OCR en confirmation en attente, sans écraser le dossier', async () => {
      const documentRef = buildDocumentRef();
      const quoteFile = buildQuoteFile({
        documents: [documentRef],
        quote: { ...createEmptyQuoteRequest(), vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Peugeot' } },
      });
      const extraction: OcrExtractionResult = {
        documentId: 'doc-1',
        provider: 'mock-ocr',
        extractedAt: Date.now(),
        fields: [{ canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' }],
      };
      ocrProvider.extract.and.resolveTo(extraction);

      await service.runOcr('file-1', quoteFile, documentRef, new File([], 'carte-grise.jpg'));

      const payload = databaseProvider.update.calls.mostRecent().args[2] as {
        quote: { vehicle: { brand: string | null } };
        pendingConfirmations: { canonicalPath: string; ocrValue: unknown }[];
      };
      expect(payload.quote.vehicle.brand).toBe('Peugeot'); // jamais écrasé silencieusement
      expect(payload.pendingConfirmations.length).toBe(1);
      expect(payload.pendingConfirmations[0].canonicalPath).toBe('vehicle.brand');
      expect(payload.pendingConfirmations[0].ocrValue).toBe('Yamaha');
    });

    it("passe le document en erreur si l'extraction échoue, sans modifier le dossier", async () => {
      const documentRef = buildDocumentRef();
      const quoteFile = buildQuoteFile({ documents: [documentRef] });
      ocrProvider.extract.and.rejectWith(new Error('boom'));

      await expectAsync(
        service.runOcr('file-1', quoteFile, documentRef, new File([], 'carte-grise.jpg'))
      ).toBeRejected();

      const payload = databaseProvider.update.calls.mostRecent().args[2] as { documents: DocumentRef[] };
      expect(payload.documents[0].ocrStatus).toBe('error');
    });
  });

  describe('resolveConfirmation', () => {
    it("decision 'useOcr' applique la valeur du document dans le dossier", async () => {
      const quoteFile = buildQuoteFile({
        quote: { ...createEmptyQuoteRequest(), vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Peugeot' } },
        pendingConfirmations: [
          {
            id: 'conf-1',
            documentId: 'doc-1',
            canonicalPath: 'vehicle.brand',
            label: 'Marque',
            currentValue: 'Peugeot',
            currentIsKnown: true,
            ocrValue: 'Yamaha',
            ocrConfidence: 'high',
            createdAt: Date.now(),
          },
        ],
      });

      await service.resolveConfirmation('file-1', quoteFile, quoteFile.pendingConfirmations[0], 'useOcr');

      const payload = databaseProvider.update.calls.mostRecent().args[2] as {
        quote: { vehicle: { brand: string | null } };
      };
      expect(payload.quote.vehicle.brand).toBe('Yamaha');
    });

    it("decision 'keepCurrent' conserve la valeur déjà connue du dossier", async () => {
      const quoteFile = buildQuoteFile({
        quote: { ...createEmptyQuoteRequest(), vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Peugeot' } },
        pendingConfirmations: [
          {
            id: 'conf-1',
            documentId: 'doc-1',
            canonicalPath: 'vehicle.brand',
            label: 'Marque',
            currentValue: 'Peugeot',
            currentIsKnown: true,
            ocrValue: 'Yamaha',
            ocrConfidence: 'high',
            createdAt: Date.now(),
          },
        ],
      });

      await service.resolveConfirmation('file-1', quoteFile, quoteFile.pendingConfirmations[0], 'keepCurrent');

      const payload = databaseProvider.update.calls.mostRecent().args[2] as {
        quote: { vehicle: { brand: string | null } };
      };
      expect(payload.quote.vehicle.brand).toBe('Peugeot');
    });
  });
});
