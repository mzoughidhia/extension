import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthStore } from '../../../../main/commons/authentication-module/store/auth.store';
import { CommonRouteContainerModel } from '../../common-routes/common-route-container.model';

/**
 * Autorise l'accès à un utilisateur authentifié, quel que soit son rôle.
 *
 * Le guard attend que l'état d'authentification soit *résolu* avant de décider :
 * au premier chargement, Firebase Auth n'a pas encore restauré la session, et
 * répondre immédiatement redirigerait à tort vers la page de connexion.
 */
export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  return toObservable(store.isResolved).pipe(
    filter((isResolved) => isResolved),
    take(1),
    map(() =>
      store.isAuthenticated()
        ? true
        : router.createUrlTree([CommonRouteContainerModel.SIGNIN_ROUTE.fullPath])
    )
  );
};
