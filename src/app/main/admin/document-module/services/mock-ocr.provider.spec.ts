import { TestBed } from '@angular/core/testing';

import { createDocumentRef } from '../models/document-ref.model';
import { MockOcrProvider } from './mock-ocr.provider';

describe('MockOcrProvider (⚠️ mock — pas un vrai OCR)', () => {
  let provider: MockOcrProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockOcrProvider] });
    provider = TestBed.inject(MockOcrProvider);
  });

  it("s'identifie clairement comme un fournisseur mock, jamais comme un vrai OCR", async () => {
    const document = createDocumentRef('carte_grise', 'carte-grise.jpg', 'path/carte-grise.jpg');
    const result = await provider.extract(document, new File([], 'carte-grise.jpg'));

    expect(result.provider).toBe('mock-ocr');
  });

  it('extrait des champs réalistes pour une carte grise', async () => {
    const document = createDocumentRef('carte_grise', 'carte-grise.jpg', 'path');
    const result = await provider.extract(document, new File([], 'carte-grise.jpg'));

    const paths = result.fields.map((f) => f.canonicalPath);
    expect(paths).toContain('vehicle.registration');
    expect(paths).toContain('vehicle.brand');
    expect(paths).toContain('vehicle.model');
    expect(result.fields.every((f) => f.confidence === 'high')).toBeTrue();
  });

  it('extrait des champs réalistes pour un permis de conduire', async () => {
    const document = createDocumentRef('permis', 'permis.jpg', 'path');
    const result = await provider.extract(document, new File([], 'permis.jpg'));

    const paths = result.fields.map((f) => f.canonicalPath);
    expect(paths).toContain('driver.firstName');
    expect(paths).toContain('driver.lastName');
    expect(paths).toContain('driver.birthDate');
  });

  it("extrait des champs pour un relevé d'information, avec au moins un champ peu fiable", async () => {
    const document = createDocumentRef('releve_information', 'releve.pdf', 'path');
    const result = await provider.extract(document, new File([], 'releve.pdf'));

    expect(result.fields.some((f) => f.confidence === 'low')).toBeTrue();
    expect(result.fields.some((f) => f.canonicalPath === 'insuranceHistory.previousInsurer')).toBeTrue();
  });

  it("ne prétend extraire aucun champ pour un document de type 'autre'", async () => {
    const document = createDocumentRef('autre', 'inconnu.pdf', 'path');
    const result = await provider.extract(document, new File([], 'inconnu.pdf'));

    expect(result.fields).toEqual([]);
  });

  it('associe le résultat au bon documentId', async () => {
    const document = createDocumentRef('carte_grise', 'carte-grise.jpg', 'path');
    const result = await provider.extract(document, new File([], 'carte-grise.jpg'));

    expect(result.documentId).toBe(document.id);
  });
});
