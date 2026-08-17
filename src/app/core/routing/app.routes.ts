import { Routes } from '@angular/router';

import { AdminRouteContainerModel } from './admin-routes/admin-route-container.model';
import { CommonRouteContainerModel } from './common-routes/common-route-container.model';

/**
 * Racine du routing :
 *
 * ⚠️ PHASE 1 (MVP) :
 * - `/` redirige immédiatement vers `/quote-request`
 * - `/quote-request` est servi directement à la racine
 * - `/common/signin` reste atteignable (nécessaire à la persistance des
 *   dossiers, qui exige un courtier authentifié)
 * - `/admin` redirige également vers `/admin/quote-request`
 */
export const ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'quote-request',
    pathMatch: 'full',
  },
  {
    path: 'quote-request',
    title: 'Nouvelle demande d\'assurance automobile',
    loadComponent: () =>
      import(
        '../../main/admin/quote-request-module/components/quote-request-container/quote-request-container.component'
      ).then((c) => c.QuoteRequestContainerComponent),
  },
  {
    path: AdminRouteContainerModel.prefix,
    loadChildren: () => import('./admin-routes/admin-routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: CommonRouteContainerModel.prefix,
    loadChildren: () => import('./common-routes/common.routes').then((m) => m.COMMON_ROUTES),
  },
  {
    path: '**',
    redirectTo: 'quote-request',
  },
];


