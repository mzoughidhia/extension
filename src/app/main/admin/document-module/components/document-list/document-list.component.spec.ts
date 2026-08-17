import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { DocumentListComponent } from './document-list.component';
import { DocumentRef } from '../../models/document-ref.model';

function buildDocument(overrides: Partial<DocumentRef> = {}): DocumentRef {
  return {
    id: 'doc-1',
    type: 'carte_grise',
    fileName: 'carte-grise.jpg',
    storagePath: 'path',
    uploadedAt: Date.now(),
    ocrStatus: 'pending',
    ...overrides,
  };
}

describe('DocumentListComponent', () => {
  let component: DocumentListComponent;
  let fixture: ComponentFixture<DocumentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentListComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentListComponent);
    component = fixture.componentInstance;
  });

  function setDocuments(documents: DocumentRef[]): void {
    fixture.componentRef.setInput('documents', documents);
    fixture.detectChanges();
  }

  it('should create', () => {
    setDocuments([]);
    expect(component).toBeTruthy();
  });

  it('affiche un statut "en attente" pour un document pending', () => {
    setDocuments([buildDocument({ ocrStatus: 'pending' })]);
    expect(component.statusLabel(buildDocument({ ocrStatus: 'pending' }))).toBe('En attente de lecture');
  });

  it("affiche le nombre d'informations détectées pour un document 'done'", () => {
    const document = buildDocument({ ocrStatus: 'done', extractedFieldCount: 5 });
    expect(component.statusLabel(document)).toContain('5');
  });

  it('affiche un message clair en cas d\'échec de lecture', () => {
    expect(component.statusLabel(buildDocument({ ocrStatus: 'error' }))).toBe('Échec de la lecture');
  });

  it('émet runOcr quand le courtier lance la lecture', () => {
    setDocuments([buildDocument()]);
    const document = buildDocument();
    const emitted: DocumentRef[] = [];
    component.runOcr.subscribe((d) => emitted.push(d));

    component.onRunOcr(document);

    expect(emitted.length).toBe(1);
    expect(emitted[0].id).toBe('doc-1');
  });

  it('toggleExpanded() bascule l\'état déplié/replié pour un document donné', () => {
    const document = buildDocument();
    expect(component.isExpanded(document)).toBeFalse();

    component.toggleExpanded(document);
    expect(component.isExpanded(document)).toBeTrue();

    component.toggleExpanded(document);
    expect(component.isExpanded(document)).toBeFalse();
  });
});
