import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthenticatedUserModel, AuthenticationProvider } from '@karma-solutions-org/ngx-sg';

/**
 * Fine couche au-dessus de `AuthenticationProvider` (ngx-sg).
 *
 * Elle existe pour que le store ne dépende pas directement de l'abstraction
 * backend : le store parle à un service, le service parle au provider. Cela
 * rend le store trivial à tester (un seul collaborateur à simuler) et laisse un
 * point d'accroche si la logique d'authentification s'enrichit.
 */
@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly authentication = inject(AuthenticationProvider);

  /** Flux de l'état d'authentification. Émet `undefined` lorsque personne n'est connecté. */
  authenticationStateChanges(): Observable<AuthenticatedUserModel | undefined> {
    return this.authentication.authenticationStateChanges();
  }

  signInWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<AuthenticatedUserModel | undefined> {
    return this.authentication.signInWithEmailAndPassword(email, password);
  }

  signOut(): Promise<void> {
    return this.authentication.signOut();
  }
}
