import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { PendingConfirmationListComponent, ConfirmationDecision } from './pending-confirmation-list.component';
import { PendingConfirmation } from '../../models/pending-confirmation.model';

function buildConfirmation(overrides: Partial<PendingConfirmation> = {}): PendingConfirmation {
  return {
    id: 'conf-1',
    documentId: 'doc-1',
    canonicalPath: 'vehicle.brand',
    label: 'Marque',
    currentValue: 'Peugeot',
    currentIsKnown: true,
    ocrValue: 'Yamaha',
    ocrConfidence: 'high',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('PendingConfirmationListComponent', () => {
  let component: PendingConfirmationListComponent;
  let fixture: ComponentFixture<PendingConfirmationListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingConfirmationListComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingConfirmationListComponent);
    component = fixture.componentInstance;
  });

  function setConfirmations(confirmations: PendingConfirmation[]): void {
    fixture.componentRef.setInput('confirmations', confirmations);
    fixture.detectChanges();
  }

  it('should create', () => {
    setConfirmations([]);
    expect(component).toBeTruthy();
  });

  it('displayValue() affiche un tiret pour une valeur absente', () => {
    expect(component.displayValue(null)).toBe('—');
    expect(component.displayValue('')).toBe('—');
  });

  it('displayValue() affiche la valeur telle quelle sinon', () => {
    expect(component.displayValue('Yamaha')).toBe('Yamaha');
    expect(component.displayValue(0)).toBe('0');
  });

  it("émet la décision 'keepCurrent' au clic sur conserver", () => {
    setConfirmations([buildConfirmation()]);
    const emitted: ConfirmationDecision[] = [];
    component.decide.subscribe((d) => emitted.push(d));

    component.onKeepCurrent(buildConfirmation());

    expect(emitted.length).toBe(1);
    expect(emitted[0].decision).toBe('keepCurrent');
  });

  it("émet la décision 'useOcr' au clic sur utiliser", () => {
    setConfirmations([buildConfirmation()]);
    const emitted: ConfirmationDecision[] = [];
    component.decide.subscribe((d) => emitted.push(d));

    component.onUseOcr(buildConfirmation());

    expect(emitted.length).toBe(1);
    expect(emitted[0].decision).toBe('useOcr');
  });
});
