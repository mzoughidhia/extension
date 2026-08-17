import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';

import { InsuranceHistoryFormComponent } from './insurance-history-form.component';
import { FieldKnowledge } from '../../models/field-knowledge.model';
import { InsuranceHistory } from '../../models/insurance-history.model';

describe('InsuranceHistoryFormComponent', () => {
  let component: InsuranceHistoryFormComponent;
  let fixture: ComponentFixture<InsuranceHistoryFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsuranceHistoryFormComponent, NoopAnimationsModule],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(InsuranceHistoryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create DECLARED_UNKNOWN field when "unknown" checkbox is checked', () => {
    let emitted: InsuranceHistory | undefined;
    component.formSubmit.subscribe((v) => (emitted = v));

    component.form.patchValue({
      claimsCountUnknown: true,
      claimsCountValue: 5, // Should be ignored when unknown checkbox is checked
    });
    component.onSubmit();

    expect(emitted).toBeDefined();
    expect(emitted?.claimsCount.knowledge).toBe(FieldKnowledge.DECLARED_UNKNOWN);
    expect(emitted?.claimsCount.value).toBeNull();
  });

  it('should create KNOWN field with 0 when explicitly entered', () => {
    let emitted: InsuranceHistory | undefined;
    component.formSubmit.subscribe((v) => (emitted = v));

    component.form.patchValue({
      claimsCountUnknown: false,
      claimsCountValue: 0,
    });
    component.onSubmit();

    expect(emitted).toBeDefined();
    expect(emitted?.claimsCount.knowledge).toBe(FieldKnowledge.KNOWN);
    expect(emitted?.claimsCount.value).toBe(0);
  });

  it('should create UNKNOWN field when nothing is entered and checkbox not checked', () => {
    let emitted: InsuranceHistory | undefined;
    component.formSubmit.subscribe((v) => (emitted = v));

    component.onSubmit();

    expect(emitted).toBeDefined();
    expect(emitted?.seniority.knowledge).toBe(FieldKnowledge.UNKNOWN);
    expect(emitted?.seniority.value).toBeNull();
  });

  it('should handle termination information properly', () => {
    let emitted: InsuranceHistory | undefined;
    component.formSubmit.subscribe((v) => (emitted = v));

    component.form.patchValue({
      wasTerminated: true,
      terminatedByInsurer: true,
      terminationReason: 'Non-paiement',
    });
    component.onSubmit();

    expect(emitted?.wasTerminated).toBe(true);
    expect(emitted?.terminatedByInsurer).toBe(true);
    expect(emitted?.terminationReason).toBe('Non-paiement');
  });

  it('should emit prevStep on onPrev', () => {
    let prevEmitted = false;
    component.prevStep.subscribe(() => (prevEmitted = true));

    component.onPrev();
    expect(prevEmitted).toBe(true);
  });
});
