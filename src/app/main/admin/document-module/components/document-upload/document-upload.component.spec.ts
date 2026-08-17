import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { DocumentUploadComponent, DocumentUploadRequest } from './document-upload.component';

describe('DocumentUploadComponent', () => {
  let component: DocumentUploadComponent;
  let fixture: ComponentFixture<DocumentUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentUploadComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create, closed by default', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen()).toBeFalse();
  });

  it('open() affiche le panneau de sélection', () => {
    component.open();
    expect(component.isOpen()).toBeTrue();
  });

  it("submit() n'émet rien si aucun fichier n'a été choisi", () => {
    component.open();
    const emitted: DocumentUploadRequest[] = [];
    component.addDocument.subscribe((r) => emitted.push(r));

    component.submit();

    expect(emitted.length).toBe(0);
  });

  it('sélectionner un fichier puis submit() émet le type et le fichier choisis', () => {
    component.open();
    const file = new File(['contenu'], 'carte-grise.jpg');
    const input = { files: [file] } as unknown as HTMLInputElement;
    component.onFileSelected({ target: input } as unknown as Event);

    const emitted: DocumentUploadRequest[] = [];
    component.addDocument.subscribe((r) => emitted.push(r));

    component.submit();

    expect(emitted.length).toBe(1);
    expect(emitted[0].file).toBe(file);
    expect(emitted[0].type).toBe('carte_grise');
  });

  it('submit() referme le panneau et réinitialise la sélection', () => {
    component.open();
    const file = new File(['contenu'], 'permis.jpg');
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    component.submit();

    expect(component.isOpen()).toBeFalse();
    expect(component.selectedFileName()).toBeNull();
  });

  it('cancel() referme le panneau sans émettre', () => {
    component.open();
    const emitted: DocumentUploadRequest[] = [];
    component.addDocument.subscribe((r) => emitted.push(r));

    component.cancel();

    expect(component.isOpen()).toBeFalse();
    expect(emitted.length).toBe(0);
  });
});
