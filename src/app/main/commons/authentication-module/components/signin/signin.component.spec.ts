import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SigninComponent } from './signin.component';

describe('SigninComponent', () => {
  let fixture: ComponentFixture<SigninComponent>;
  let component: SigninComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SigninComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SigninComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should start with an invalid, empty form', () => {
    expect(component.form.invalid).toBeTrue();
  });

  it('should not emit when the form is invalid', () => {
    const spy = jasmine.createSpy('signin');
    component.signin.subscribe(spy);

    component.onSubmit();

    expect(spy).not.toHaveBeenCalled();
    expect(component.form.controls.email.touched).toBeTrue();
  });

  it('should emit the credentials when the form is valid', () => {
    const spy = jasmine.createSpy('signin');
    component.signin.subscribe(spy);

    component.form.setValue({ email: 'courtier@example.com', password: 'secret123' });
    component.onSubmit();

    expect(spy).toHaveBeenCalledOnceWith({
      email: 'courtier@example.com',
      password: 'secret123',
    });
  });

  it('should reject a malformed email', () => {
    component.form.setValue({ email: 'not-an-email', password: 'secret123' });

    expect(component.form.controls.email.hasError('email')).toBeTrue();
  });

  it('should display the error message it receives', () => {
    fixture.componentRef.setInput('error', 'Identifiants invalides.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Identifiants invalides.'
    );
  });
});
