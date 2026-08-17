import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuoteFileDetailComponent } from './quote-file-detail.component';
import { QuoteFileModel } from '../../models/quote-file.model';
import { createEmptyQuoteRequest } from '../../models/quote-request.model';

function buildFile(overrides: Partial<QuoteFileModel> = {}): QuoteFileModel {
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

describe('QuoteFileDetailComponent', () => {
  let component: QuoteFileDetailComponent;
  let fixture: ComponentFixture<QuoteFileDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteFileDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteFileDetailComponent);
    component = fixture.componentInstance;
  });

  function setQuoteFile(file: QuoteFileModel): void {
    fixture.componentRef.setInput('quoteFile', file);
    fixture.detectChanges();
  }

  it('clientLabel() combine prénom et nom', () => {
    setQuoteFile(
      buildFile({
        quote: {
          ...createEmptyQuoteRequest(),
          client: { ...createEmptyQuoteRequest().client, firstName: 'Mohamed', lastName: 'Mzoughi' },
        },
      })
    );
    expect(component.clientLabel()).toBe('Mohamed Mzoughi');
  });

  it('clientLabel() affiche un texte de repli si le client est vide', () => {
    setQuoteFile(buildFile());
    expect(component.clientLabel()).toBe('Client non renseigné');
  });

  it('completeness() reflète la complétude réelle du dossier (0 % pour un dossier vide)', () => {
    setQuoteFile(buildFile());
    expect(component.completeness()).toBeLessThan(10);
  });

  it('completeness() augmente quand des informations sont connues', () => {
    setQuoteFile(buildFile());
    const emptyCompleteness = component.completeness();

    setQuoteFile(
      buildFile({
        quote: {
          ...createEmptyQuoteRequest(),
          client: {
            ...createEmptyQuoteRequest().client,
            firstName: 'Mohamed',
            lastName: 'Mzoughi',
            birthDate: '1998-05-15',
            address: '12 rue de la paix',
          },
        },
      })
    );

    expect(component.completeness()).toBeGreaterThan(emptyCompleteness);
  });

  it('knownClientFields() ne liste que les informations réellement connues', () => {
    setQuoteFile(
      buildFile({
        quote: {
          ...createEmptyQuoteRequest(),
          client: { ...createEmptyQuoteRequest().client, firstName: 'Mohamed', lastName: 'Mzoughi', birthDate: '1998-05-15' },
        },
      })
    );

    const labels = component.knownClientFields().map((f) => f.label);
    expect(labels).toContain('Nom');
    expect(labels).toContain('Date de naissance');
    expect(labels).not.toContain('Adresse');
  });
});
