import { RouteContainerModel } from '@karma-solutions-org/ngx-sg';

/**
 * Métadonnées des routes du rôle `admin`, centralisées ici et consommées plus
 * tard par la navbar via `RouteContainerModel.getNavbarRoutes()`.
 *
 * ⚠️ `prefix` doit être déclaré AVANT les routes (voir CommonRouteContainerModel).
 *
 * Phase 1 ajoutera ici `QUOTE_REQUEST_ROUTE`.
 */
export class AdminRouteContainerModel extends RouteContainerModel {
  static readonly prefix = 'admin';

  static readonly HOME_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'home', title: 'Accueil' },
    AdminRouteContainerModel
  );

  static readonly QUOTE_REQUEST_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'quote-request', title: 'Nouvelle demande' },
    AdminRouteContainerModel
  );

  static readonly QUOTE_FILES_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'mes-devis', title: 'Mes devis' },
    AdminRouteContainerModel
  );

  /** Pas de `title` : route de détail, jamais affichée dans la navbar. */
  static readonly QUOTE_FILE_DETAIL_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'mes-devis/:quoteFileId' },
    AdminRouteContainerModel
  );

  static readonly EXTRANET_LINKS_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'mes-extranets', title: 'Mes extranets' },
    AdminRouteContainerModel
  );

  /** Pas de `title` : formulaire, jamais affiché dans la navbar. */
  static readonly EXTRANET_LINK_NEW_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'mes-extranets/nouveau' },
    AdminRouteContainerModel
  );

  /** Pas de `title` : formulaire de modification, jamais affiché dans la navbar. */
  static readonly EXTRANET_LINK_EDIT_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'mes-extranets/:extranetLinkId' },
    AdminRouteContainerModel
  );

  static readonly ANY_OTHER_ADMIN_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: '**' },
    AdminRouteContainerModel
  );
}
