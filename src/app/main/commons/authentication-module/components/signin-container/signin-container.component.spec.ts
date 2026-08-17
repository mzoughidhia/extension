import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AuthenticationProvider } from '@karma-solutions-org/ngx-sg';
import { of } from 'rxjs';

import { SigninContainerComponent } from './signin-container.component';
import { AuthStore } from '../../store/auth.store';

class AuthenticationProviderStub {
  authenticationStateChanges = jasmine
    .createSpy('authenticationStateChanges')
    .and.returnValue(of(undefined));
  signInWithEmailAndPassword = jasmine
    .createSpy('signInWithEmailAndPassword')
    .and.resolveTo(undefined);
  signOut = jasmine.createSpy('signOut').and.resolveTo(undefined);
}

describe('SigninContainerComponent', () => {
  let fixture: ComponentFixture<SigninContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SigninContainerComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthenticationProvider, useClass: AuthenticationProviderStub },
        { provide: Router, useValue: { navigateByUrl: jasmine.createSpy('navigateByUrl') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SigninContainerComponent);
    fixture.detectChanges();
  });

  it('should create and expose the store', () => {
    expect(fixture.componentInstance.store).toBeTruthy();
  });

  it('should delegate the signin to the store', () => {
    const store = TestBed.inject(AuthStore);
    const spy = spyOn(store, 'signIn');

    fixture.componentInstance.onSignin({ email: 'a@b.c', password: 'secret123' });

    expect(spy).toHaveBeenCalledOnceWith({ email: 'a@b.c', password: 'secret123' });
  });

  it('should render the dumb signin component', () => {
    expect(fixture.nativeElement.querySelector('app-signin')).toBeTruthy();
  });
});
