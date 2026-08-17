import { Route } from '@angular/router';

import { AdminRouteContainerModel } from './admin-route-container.model';

/**
 * Routes de l'espace `admin`. Toujours en `loadComponent` (lazy).
 *
 * Phase 1 — route `quote-request` : point d'entrée principal de l'application.
 * La route `home` est conservée pour la phase future (CRM, dashboard…).
 */
export const ADMIN_ROUTES: Route[] = [
  {
    path: '',
    redirectTo: AdminRouteContainerModel.QUOTE_REQUEST_ROUTE.path,
    pathMatch: 'full',
  },
  {
    path: AdminRouteContainerModel.QUOTE_REQUEST_ROUTE.path,
    pathMatch: 'full',
    title: AdminRouteContainerModel.QUOTE_REQUEST_ROUTE.title,
    loadComponent: () =>
      import(
        '../../../main/admin/quote-request-module/components/quote-request-container/quote-request-container.component'
      ).then((c) => c.QuoteRequestContainerComponent),
  },
  {
    path: AdminRouteContainerModel.QUOTE_FILES_ROUTE.path,
    pathMatch: 'full',
    title: AdminRouteContainerModel.QUOTE_FILES_ROUTE.title,
    loadComponent: () =>
      import(
        '../../../main/admin/quote-request-module/components/quote-file-list-container/quote-file-list-container.component'
      ).then((c) => c.QuoteFileListContainerComponent),
  },
  {
    path: AdminRouteContainerModel.QUOTE_FILE_DETAIL_ROUTE.path,
    pathMatch: 'full',
    loadComponent: () =>
      import(
        '../../../main/admin/quote-request-module/components/quote-file-detail-container/quote-file-detail-container.component'
      ).then((c) => c.QuoteFileDetailContainerComponent),
  },
  {
    path: AdminRouteContainerModel.EXTRANET_LINKS_ROUTE.path,
    pathMatch: 'full',
    title: AdminRouteContainerModel.EXTRANET_LINKS_ROUTE.title,
    loadComponent: () =>
      import(
        '../../../main/admin/quote-request-module/components/extranet-link-list-container/extranet-link-list-container.component'
      ).then((c) => c.ExtranetLinkListContainerComponent),
  },
  {
    path: AdminRouteContainerModel.EXTRANET_LINK_NEW_ROUTE.path,
    pathMatch: 'full',
    loadComponent: () =>
      import(
        '../../../main/admin/quote-request-module/components/extranet-link-form-container/extranet-link-form-container.component'
      ).then((c) => c.ExtranetLinkFormContainerComponent),
  },
  {
    path: AdminRouteContainerModel.EXTRANET_LINK_EDIT_ROUTE.path,
    pathMatch: 'full',
    loadComponent: () =>
      import(
        '../../../main/admin/quote-request-module/components/extranet-link-form-container/extranet-link-form-container.component'
      ).then((c) => c.ExtranetLinkFormContainerComponent),
  },
  {
    path: AdminRouteContainerModel.HOME_ROUTE.path,
    pathMatch: 'full',
    title: AdminRouteContainerModel.HOME_ROUTE.title,
    loadComponent: () =>
      import('../../../main/admin/home-module/components/home-container/home-container.component').then(
        (c) => c.HomeContainerComponent
      ),
  },
  {
    path: AdminRouteContainerModel.ANY_OTHER_ADMIN_ROUTE.path,
    redirectTo: AdminRouteContainerModel.QUOTE_REQUEST_ROUTE.path,
  },
];
