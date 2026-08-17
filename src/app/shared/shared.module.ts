import { PageHeaderComponent } from './components/page-header/page-header.component';

/**
 * ⚠️ Ce fichier N'EST PAS un NgModule Angular.
 *
 * C'est un *barrel* : il regroupe les composants standalone réutilisables afin
 * qu'un composant consommateur puisse écrire `imports: [...SHARED_COMPONENTS]`
 * au lieu d'énumérer chaque import. Le nom `shared.module.ts` est celui de
 * l'architecture de référence (§2) ; il est conservé pour cohérence.
 *
 * Contrainte : aucun composant de `shared/` ne connaît un store métier.
 */
export const SHARED_COMPONENTS = [PageHeaderComponent] as const;

export { PageHeaderComponent };
