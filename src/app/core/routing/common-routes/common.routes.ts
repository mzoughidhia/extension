import { Route } from '@angular/router';

import { CommonRouteContainerModel } from './common-route-container.model';

/** Routes publiques (non authentifiées). Toujours en `loadComponent` (lazy). */
export const COMMON_ROUTES: Route[] = [
  {
    path: '',
    redirectTo: CommonRouteContainerModel.SIGNIN_ROUTE.path,
    pathMatch: 'full',
  },
  {
    path: CommonRouteContainerModel.SIGNIN_ROUTE.path,
    pathMatch: 'full',
    title: CommonRouteContainerModel.SIGNIN_ROUTE.title,
    loadComponent: () =>
      import('../../../main/commons/authentication-module/components/signin-container/signin-container.component').then(
        (c) => c.SigninContainerComponent
      ),
  },
  {
    path: '**',
    redirectTo: CommonRouteContainerModel.SIGNIN_ROUTE.path,
  },
];
