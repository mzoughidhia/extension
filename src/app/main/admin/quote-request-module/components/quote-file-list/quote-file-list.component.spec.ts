import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { QuoteFileListComponent } from './quote-file-list.component';
import { QuoteFileModel } from '../../models/quote-file.model';
import { createEmptyQuoteRequest } from '../../models/quote-request.model';

function buildFile(overrides: Partial<QuoteFileModel> = {}): QuoteFileModel {
  return {
    id: 'file-1',
    ownerUid: 'uid-1',
    status: 'draft',
    quote: {
      ...createEmptyQuoteRequest(),
      client: { ...createEmptyQuoteRequest().client, firstName: 'Mohamed', lastName: 'Mzoughi' },
      vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Yamaha', model: 'MT-07' },
    },
    history: [{ label: 'Dossier créé', timestamp: 1_700_000_000_000 }],
    documents: [],
    pendingConfirmations: [],
    extranetQuestionnaires: {},
    extranetResults: {},
    ...overrides,
  };
}

describe('QuoteFileListComponent', () => {
  let component: QuoteFileListComponent;
  let fixture: ComponentFixture<QuoteFileListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteFileListComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteFileListComponent);
    component = fixture.componentInstance;
  });

  function setFiles(files: QuoteFileModel[]): void {
    fixture.componentRef.setInput('files', files);
    fixture.detectChanges();
  }

  it('should create', () => {
    setFiles([]);
    expect(component).toBeTruthy();
  });

  it('formats the client label from first and last name', () => {
    expect(component.clientLabel(buildFile())).toBe('Mohamed Mzoughi');
  });

  it('falls back to a placeholder when the client is not filled yet', () => {
    const file = buildFile({ quote: { ...createEmptyQuoteRequest() } });
    expect(component.clientLabel(file)).toBe('Client non renseigné');
  });

  it('formats the vehicle label from brand and model', () => {
    expect(component.vehicleLabel(buildFile())).toBe('Yamaha MT-07');
  });

  it('formats the status label for a draft file', () => {
    expect(component.statusLabel(buildFile({ status: 'draft' }))).toBe('● Brouillon');
  });

  it('formats the status label for a submitted file', () => {
    expect(component.statusLabel(buildFile({ status: 'submitted' }))).toBe('✓ Dossier prêt');
  });

  it('shows the last history entry as the last activity', () => {
    const file = buildFile({
      history: [
        { label: 'Dossier créé', timestamp: 1_700_000_000_000 },
        { label: 'Demande préparée', timestamp: 1_700_000_100_000 },
      ],
    });
    expect(component.lastActivityLabel(file)).toContain('Demande préparée');
  });

  it('returns a dash when the file has no history yet', () => {
    expect(component.lastActivityLabel(buildFile({ history: [] }))).toBe('—');
  });

  it('emits resumeFile when a file is resumed', () => {
    setFiles([buildFile()]);
    const emitted: QuoteFileModel[] = [];
    component.resumeFile.subscribe((file) => emitted.push(file));

    const file = buildFile();
    component.onResume(file);

    expect(emitted.length).toBe(1);
    expect(emitted[0].id).toBe('file-1');
  });
});
