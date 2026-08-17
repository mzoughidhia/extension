import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthenticatedUserModel, AuthenticationProvider } from '@karma-solutions-org/ngx-sg';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { authGuard } from './auth.guard';

const SIGNIN_URL_TREE = { toString: () => '/common/signin' } as UrlTree;

function buildUser(): AuthenticatedUserModel {
  return {
    uid: 'uid-1',
    email: 'courtier@example.com',
    displayName: undefined,
    isEmailVerified: true,
    isNewUser: false,
    claims: {},
    authenticationSignInProviderUsersMap: {},
  } as AuthenticatedUserModel;
}

describe('authGuard', () => {
  let authState$: BehaviorSubject<AuthenticatedUserModel | undefined>;

  function runGuard(): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

    return firstValueFrom(result);
  }

  beforeEach(() => {
    authState$ = new BehaviorSubject<AuthenticatedUserModel | undefined>(undefined);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthenticationProvider,
          useValue: {
            authenticationStateChanges: () => authState$.asObservable(),
            signInWithEmailAndPassword: jasmine.createSpy().and.resolveTo(undefined),
            signOut: jasmine.createSpy().and.resolveTo(undefined),
          },
        },
        {
          provide: Router,
          useValue: { createUrlTree: jasmine.createSpy().and.returnValue(SIGNIN_URL_TREE) },
        },
      ],
    });
  });

  it('should redirect an anonymous visitor', async () => {
    await expectAsync(runGuard()).toBeResolvedTo(SIGNIN_URL_TREE);
  });

  it('should allow any authenticated user, whatever the role', async () => {
    authState$.next(buildUser());

    await expectAsync(runGuard()).toBeResolvedTo(true);
  });
});
