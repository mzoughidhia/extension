import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';

import { ClientFormComponent } from './client-form.component';

describe('ClientFormComponent', () => {
  let component: ClientFormComponent;
  let fixture: ComponentFixture<ClientFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientFormComponent, NoopAnimationsModule],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid form when firstName is empty', () => {
    component.form.get('firstName')?.setValue('');
    component.form.get('lastName')?.setValue('Dupont');
    expect(component.form.invalid).toBe(true);
  });

  it('should have invalid form when lastName is empty', () => {
    component.form.get('firstName')?.setValue('Mohamed');
    component.form.get('lastName')?.setValue('');
    expect(component.form.invalid).toBe(true);
  });

  it('should be valid with required fields only', () => {
    component.form.get('firstName')?.setValue('Mohamed');
    component.form.get('lastName')?.setValue('Dupont');
    expect(component.form.valid).toBe(true);
  });

  it('should invalidate an incorrect email', () => {
    component.form.get('firstName')?.setValue('Mohamed');
    component.form.get('lastName')?.setValue('Dupont');
    component.form.get('email')?.setValue('not-an-email');
    expect(component.form.get('email')?.hasError('email')).toBe(true);
  });

  it('should accept a valid email', () => {
    component.form.get('email')?.setValue('test@example.com');
    expect(component.form.get('email')?.hasError('email')).toBeFalsy();
  });

  it('should invalidate an incorrect phone', () => {
    component.form.get('firstName')?.setValue('A');
    component.form.get('lastName')?.setValue('B');
    component.form.get('phone')?.setValue('abc');
    expect(component.form.get('phone')?.hasError('pattern')).toBe(true);
  });

  it('should emit Client on valid submit', () => {
    let emitted: unknown;
    component.formSubmit.subscribe((v) => (emitted = v));

    component.form.get('firstName')?.setValue('Mohamed');
    component.form.get('lastName')?.setValue('Dupont');
    component.onSubmit();

    expect(emitted).toBeTruthy();
    expect((emitted as Record<string, string>)['firstName']).toBe('Mohamed');
  });

  it('should not emit on invalid submit', () => {
    let emitted = false;
    component.formSubmit.subscribe(() => (emitted = true));
    component.onSubmit();
    expect(emitted).toBe(false);
  });
});
