import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';

import { DriverFormComponent } from './driver-form.component';
import { createEmptyClient } from '../../models/client.model';

describe('DriverFormComponent', () => {
  let component: DriverFormComponent;
  let fixture: ComponentFixture<DriverFormComponent>;

  const mockClient = {
    ...createEmptyClient(),
    firstName: 'Jean',
    lastName: 'Dupont',
    birthDate: '1985-05-15',
    phone: '+33612345678',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriverFormComponent, NoopAnimationsModule],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(DriverFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('client', mockClient);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should copy client data when sameAsClient is checked', () => {
    component.form.get('sameAsClient')?.setValue(true);
    expect(component.form.get('firstName')?.value).toBe('Jean');
    expect(component.form.get('lastName')?.value).toBe('Dupont');
    expect(component.form.get('phone')?.value).toBe('+33612345678');
  });

  it('should clear copied client fields when sameAsClient is unchecked', () => {
    component.form.get('sameAsClient')?.setValue(true);
    component.form.get('sameAsClient')?.setValue(false);
    expect(component.form.get('firstName')?.value).toBeNull();
    expect(component.form.get('lastName')?.value).toBeNull();
    expect(component.form.get('phone')?.value).toBeNull();
  });

  it('should emit driver details on submit', () => {
    let emitted: unknown;
    component.formSubmit.subscribe((v) => (emitted = v));

    component.form.patchValue({
      firstName: 'Alice',
      lastName: 'Martin',
      profession: 'Ingénieur',
      isPrimaryDriver: true,
    });
    component.onSubmit();

    expect(emitted).toBeTruthy();
    expect((emitted as { firstName: string }).firstName).toBe('Alice');
    expect((emitted as { profession: string }).profession).toBe('Ingénieur');
  });

  it('should emit prevStep event on onPrev', () => {
    let prevEmitted = false;
    component.prevStep.subscribe(() => (prevEmitted = true));

    component.onPrev();
    expect(prevEmitted).toBe(true);
  });
});
