import { TestBed } from '@angular/core/testing';
import { AuthenticatedUserModel, AuthenticationProvider } from '@karma-solutions-org/ngx-sg';
import { BehaviorSubject } from 'rxjs';

import { AppRole, ROLE_CLAIM_KEY } from '../models/app-role.model';
import { AuthStore } from './auth.store';

function buildUser(claims: Record<string, unknown> = {}): AuthenticatedUserModel {
  return {
    uid: 'uid-1',
    email: 'courtier@example.com',
    displayName: undefined,
    isEmailVerified: true,
    isNewUser: false,
    claims,
    authenticationSignInProviderUsersMap: {},
  } as AuthenticatedUserModel;
}

describe('AuthStore', () => {
  let authState$: BehaviorSubject<AuthenticatedUserModel | undefined>;
  let provider: {
    authenticationStateChanges: jasmine.Spy;
    signInWithEmailAndPassword: jasmine.Spy;
    signOut: jasmine.Spy;
  };

  beforeEach(() => {
    authState$ = new BehaviorSubject<AuthenticatedUserModel | undefined>(undefined);
    provider = {
      authenticationStateChanges: jasmine
        .createSpy('authenticationStateChanges')
        .and.returnValue(authState$.asObservable()),
      signInWithEmailAndPassword: jasmine
        .createSpy('signInWithEmailAndPassword')
        .and.resolveTo(buildUser()),
      signOut: jasmine.createSpy('signOut').and.resolveTo(undefined),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthenticationProvider, useValue: provider }],
    });
  });

  it('should resolve the auth state on init even when nobody is signed in', () => {
    const store = TestBed.inject(AuthStore);

    expect(store.isResolved()).toBeTrue();
    expect(store.isAuthenticated()).toBeFalse();
    expect(store.uid()).toBeNull();
  });

  it('should expose the user once signed in', () => {
    const store = TestBed.inject(AuthStore);

    authState$.next(buildUser());

    expect(store.isAuthenticated()).toBeTrue();
    expect(store.uid()).toBe('uid-1');
    expect(store.email()).toBe('courtier@example.com');
  });

  it('should read the role from custom claims', () => {
    const store = TestBed.inject(AuthStore);

    authState$.next(buildUser({ [ROLE_CLAIM_KEY]: AppRole.BROKER }));

    expect(store.role()).toBe(AppRole.BROKER);
    expect(store.isAdmin()).toBeFalse();
  });

  it('should treat an authenticated user without role claim as admin (comportement MVP)', () => {
    const store = TestBed.inject(AuthStore);

    authState$.next(buildUser());

    expect(store.role()).toBeNull();
    expect(store.isAdmin()).toBeTrue();
  });

  it('should never consider an anonymous visitor as admin', () => {
    const store = TestBed.inject(AuthStore);

    expect(store.isAdmin()).toBeFalse();
  });

  it('should call the provider on signIn', () => {
    const store = TestBed.inject(AuthStore);

    store.signIn({ email: 'courtier@example.com', password: 'secret123' });

    expect(provider.signInWithEmailAndPassword).toHaveBeenCalledOnceWith(
      'courtier@example.com',
      'secret123'
    );
  });

  it('should call the provider on signOut', () => {
    const store = TestBed.inject(AuthStore);

    store.signOut();

    expect(provider.signOut).toHaveBeenCalledTimes(1);
  });

  it('should clear the error', () => {
    const store = TestBed.inject(AuthStore);

    store.clearError();

    expect(store.error()).toBeNull();
  });
});
