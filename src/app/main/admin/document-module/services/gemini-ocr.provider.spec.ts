import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FormAgentOcrField } from '../../quote-request-module/models/form-agent-bridge.model';
import {
  FormAgentBridgeService,
  FormAgentDocumentAnalysisError,
  FormAgentUnavailableError,
} from '../../quote-request-module/services/form-agent-bridge.service';
import { DocumentRef } from '../models/document-ref.model';
import { GeminiOcrProvider } from './gemini-ocr.provider';

function buildDocumentRef(overrides: Partial<DocumentRef> = {}): DocumentRef {
  return {
    id: 'doc-1',
    type: 'carte_grise',
    fileName: 'carte-grise.pdf',
    storagePath: 'quoteFiles/file-1/documents/carte-grise.pdf',
    uploadedAt: Date.now(),
    ocrStatus: 'pending',
    ...overrides,
  };
}

describe('GeminiOcrProvider', () => {
  let provider: GeminiOcrProvider;
  let formAgentBridgeSpy: jasmine.SpyObj<FormAgentBridgeService>;

  beforeEach(() => {
    formAgentBridgeSpy = jasmine.createSpyObj('FormAgentBridgeService', ['analyzeDocument']);

    TestBed.configureTestingModule({
      providers: [GeminiOcrProvider, { provide: FormAgentBridgeService, useValue: formAgentBridgeSpy }],
    });

    provider = TestBed.inject(GeminiOcrProvider);
  });

  it('accepte un PDF et le transmet à Form Agent avec le bon type MIME', async () => {
    formAgentBridgeSpy.analyzeDocument.and.returnValue(of([]));
    const file = new File(['contenu'], 'carte-grise.pdf', { type: 'application/pdf' });

    await provider.extract(buildDocumentRef(), file);

    expect(formAgentBridgeSpy.analyzeDocument).toHaveBeenCalledWith(
      jasmine.objectContaining({ documentId: 'doc-1', mimeType: 'application/pdf' })
    );
  });

  it('accepte un PNG', async () => {
    formAgentBridgeSpy.analyzeDocument.and.returnValue(of([]));
    const file = new File(['contenu'], 'carte-grise.png', { type: 'image/png' });

    await provider.extract(buildDocumentRef(), file);

    expect(formAgentBridgeSpy.analyzeDocument).toHaveBeenCalledWith(jasmine.objectContaining({ mimeType: 'image/png' }));
  });

  it('accepte un JPG/JPEG', async () => {
    formAgentBridgeSpy.analyzeDocument.and.returnValue(of([]));
    const file = new File(['contenu'], 'carte-grise.jpg', { type: 'image/jpeg' });

    await provider.extract(buildDocumentRef(), file);

    expect(formAgentBridgeSpy.analyzeDocument).toHaveBeenCalledWith(jasmine.objectContaining({ mimeType: 'image/jpeg' }));
  });

  it("refuse un format non pris en charge, sans solliciter Form Agent", async () => {
    const file = new File(['contenu'], 'notes.txt', { type: 'text/plain' });

    await expectAsync(provider.extract(buildDocumentRef(), file)).toBeRejectedWithError(/pas pris en charge/);
    expect(formAgentBridgeSpy.analyzeDocument).not.toHaveBeenCalled();
  });

  it('encode le document en base64 avant de le transmettre (aucune donnée binaire brute)', async () => {
    formAgentBridgeSpy.analyzeDocument.and.returnValue(of([]));
    const file = new File(['ABC'], 'carte-grise.pdf', { type: 'application/pdf' });

    await provider.extract(buildDocumentRef(), file);

    const [call] = formAgentBridgeSpy.analyzeDocument.calls.mostRecent().args;
    expect(typeof call.documentBase64).toBe('string');
    expect(call.documentBase64.length).toBeGreaterThan(0);
  });

  it('convertit les champs reçus en OcrExtractedField, en associant le bon documentId', async () => {
    const fields: FormAgentOcrField[] = [{ canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' }];
    formAgentBridgeSpy.analyzeDocument.and.returnValue(of(fields));
    const file = new File(['contenu'], 'carte-grise.pdf', { type: 'application/pdf' });

    const result = await provider.extract(buildDocumentRef({ id: 'doc-42' }), file);

    expect(result.documentId).toBe('doc-42');
    expect(result.provider).toBe('gemini-ocr');
    expect(result.fields).toEqual([{ canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' }]);
  });

  it('ignore silencieusement un canonicalPath inconnu du catalogue Angular (jamais transmis au dossier)', async () => {
    const fields: FormAgentOcrField[] = [
      { canonicalPath: 'vehicle.brand', value: 'Yamaha', confidence: 'high' },
      { canonicalPath: 'chemin.inconnu.qui.nexiste.pas', value: 'x', confidence: 'high' },
    ];
    formAgentBridgeSpy.analyzeDocument.and.returnValue(of(fields));
    const file = new File(['contenu'], 'carte-grise.pdf', { type: 'application/pdf' });

    const result = await provider.extract(buildDocumentRef(), file);

    expect(result.fields.length).toBe(1);
    expect(result.fields[0].canonicalPath).toBe('vehicle.brand');
  });

  it('conserve la fiabilité faible telle que reçue (réutilisée telle quelle par mergeOcrResult)', async () => {
    const fields: FormAgentOcrField[] = [{ canonicalPath: 'insuranceHistory.seniority', value: 4, confidence: 'low' }];
    formAgentBridgeSpy.analyzeDocument.and.returnValue(of(fields));
    const file = new File(['contenu'], 'releve.pdf', { type: 'application/pdf' });

    const result = await provider.extract(buildDocumentRef(), file);

    expect(result.fields[0].confidence).toBe('low');
  });

  it("propage une erreur d'analyse Form Agent sans détail technique (Gemini/clé API)", async () => {
    formAgentBridgeSpy.analyzeDocument.and.returnValue(throwError(() => new FormAgentDocumentAnalysisError()));
    const file = new File(['contenu'], 'carte-grise.pdf', { type: 'application/pdf' });

    await expectAsync(provider.extract(buildDocumentRef(), file)).toBeRejectedWith(
      jasmine.any(FormAgentDocumentAnalysisError)
    );
  });

  it("propage une erreur si Form Agent (l'extension) n'est pas disponible", async () => {
    formAgentBridgeSpy.analyzeDocument.and.returnValue(throwError(() => new FormAgentUnavailableError()));
    const file = new File(['contenu'], 'carte-grise.pdf', { type: 'application/pdf' });

    await expectAsync(provider.extract(buildDocumentRef(), file)).toBeRejectedWith(jasmine.any(FormAgentUnavailableError));
  });
});
