import { RouteContainerModel } from '@karma-solutions-org/ngx-sg';

/**
 * Métadonnées des routes publiques (non authentifiées).
 *
 * ⚠️ `prefix` doit être déclaré AVANT les routes : la fabrique de ngx-sg lit ce
 * membre statique pour composer `fullPath` (= `/<prefix>/<path>`). L'ordre
 * d'initialisation des membres statiques JavaScript est donc load-bearing.
 */
export class CommonRouteContainerModel extends RouteContainerModel {
  static readonly prefix = 'common';

  static readonly SIGNIN_ROUTE = RouteContainerModel.createRouteContainerModelFactory(
    { path: 'signin', title: 'Connexion' },
    CommonRouteContainerModel
  );
}
