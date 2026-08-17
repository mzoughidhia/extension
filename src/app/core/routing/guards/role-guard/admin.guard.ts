import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthStore } from '../../../../main/commons/authentication-module/store/auth.store';
import { CommonRouteContainerModel } from '../../common-routes/common-route-container.model';

/**
 * Autorise l'accès à l'espace `admin`.
 *
 * Comme `authGuard`, attend la résolution de l'état d'authentification.
 * La définition de `isAdmin` (et sa permissivité en MVP) vit dans `AuthStore` —
 * le guard ne fait qu'appliquer la décision.
 */
export const adminGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  return toObservable(store.isResolved).pipe(
    filter((isResolved) => isResolved),
    take(1),
    map(() =>
      store.isAdmin()
        ? true
        : router.createUrlTree([CommonRouteContainerModel.SIGNIN_ROUTE.fullPath])
    )
  );
};
