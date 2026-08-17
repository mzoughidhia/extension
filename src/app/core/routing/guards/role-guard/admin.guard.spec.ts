import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthenticatedUserModel, AuthenticationProvider } from '@karma-solutions-org/ngx-sg';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { adminGuard } from './admin.guard';

const SIGNIN_URL_TREE = { toString: () => '/common/signin' } as UrlTree;

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

describe('adminGuard', () => {
  let authState$: BehaviorSubject<AuthenticatedUserModel | undefined>;

  function runGuard(): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
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

  it('should redirect an anonymous visitor to the signin page', async () => {
    await expectAsync(runGuard()).toBeResolvedTo(SIGNIN_URL_TREE);
  });

  it('should allow an authenticated admin', async () => {
    authState$.next(buildUser());

    await expectAsync(runGuard()).toBeResolvedTo(true);
  });

  it('should redirect an authenticated non-admin role', async () => {
    authState$.next(buildUser({ role: 'broker' }));

    await expectAsync(runGuard()).toBeResolvedTo(SIGNIN_URL_TREE);
  });
});
