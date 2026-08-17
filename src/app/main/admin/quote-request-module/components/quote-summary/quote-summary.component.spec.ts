import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { QuoteSummaryComponent } from './quote-summary.component';
import { createEmptyQuoteRequest } from '../../models/quote-request.model';
import { declaredUnknownField, knownField, unknownField } from '../../models/field-knowledge.model';

describe('QuoteSummaryComponent', () => {
  let component: QuoteSummaryComponent;
  let fixture: ComponentFixture<QuoteSummaryComponent>;

  const mockQuote = createEmptyQuoteRequest();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteSummaryComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteSummaryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('quote', mockQuote);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('formatKnowledge', () => {
    it('should format KNOWN value with suffix', () => {
      const field = knownField<number>(5);
      expect(component.formatKnowledge(field, ' ans')).toBe('5 ans');
    });

    it('should format DECLARED_UNKNOWN clearly without showing 0', () => {
      const field = declaredUnknownField<number>();
      expect(component.formatKnowledge(field)).toBe('❓ Déclaré inconnu');
    });

    it('should format UNKNOWN as a dash', () => {
      const field = unknownField<number>();
      expect(component.formatKnowledge(field)).toBe('—');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date to DD/MM/YYYY', () => {
      expect(component.formatDate('2023-11-25')).toBe('25/11/2023');
    });

    it('should return dash if date is null', () => {
      expect(component.formatDate(null)).toBe('—');
    });
  });

  it('should emit editStep event when onEditStep is called', () => {
    let emittedStep: number | undefined;
    component.editStep.subscribe((s) => (emittedStep = s));

    component.onEditStep(2);
    expect(emittedStep).toBe(2);
  });

  it('should emit submitQuote event on onSubmit', () => {
    let submitEmitted = false;
    component.submitQuote.subscribe(() => (submitEmitted = true));

    component.onSubmit();
    expect(submitEmitted).toBe(true);
  });
});
