# ADR-010 — Frontière `core` / `main` : dérogation pour `core/routing`

- **Statut :** accepté à titre conservatoire — **arbitrage attendu**
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

L'architecture de référence énonce une règle d'or (§2) :

> `core` ne dépend jamais de `main`. `shared` ne dépend d'aucun store métier.

Nous avons voulu outiller cette règle par ESLint plutôt que de la confier à la
discipline. La mise en œuvre a révélé que **l'architecture de référence enfreint
sa propre règle en deux endroits**, tous deux dans `core/routing` :

1. **Les guards.** Vérifié dans le projet de référence :
   `core/routing/guards/auth-guard/auth.guard.ts` importe
   `AuthStore` depuis `main/commons/authentication-module/store/auth.store`.
   `AuthStore` y est bien placé sous `main/`, pas sous `core/`.

2. **Les fichiers de routes.** C'est structurel, pas accidentel :
   `admin-routes.ts` doit désigner les composants à charger, or ils vivent tous
   dans `main/` :
   ```ts
   loadComponent: () => import('../../../main/admin/...').then((c) => c.XxxContainerComponent);
   ```
   Aucun découpage ne supprime cette dépendance : le routing est par nature la
   couche qui connaît les écrans.

## Décision (conservatoire)

1. **Reproduire fidèlement l'architecture de référence** : `AuthStore` reste dans
   `main/commons/authentication-module/store/`, et les guards l'importent.
   L'architecture est déclarée non négociable ; nous ne la modifions pas
   unilatéralement.
2. **Outiller la règle d'or avec une dérogation étroite et documentée** :
   `src/app/core/**` ne peut importer ni `main/**` ni `shared/**`, **sauf**
   `src/app/core/routing/**`.
3. `src/app/shared/**` ne peut pas importer `main/**` — sans dérogation.

Lecture retenue : `core/routing` est la **couche de câblage**, et la règle d'or
s'applique à la logique transverse — `core/constants`, `core/models`,
`core/services`, `core/utils`, `core/providers`.

## Alternatives considérées

| Alternative                                                                         | Statut                                                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Déplacer `AuthStore` dans `core/`                                                   | **Proposition à arbitrer.** Réglerait le cas des guards (l'authentification est transverse). Ne règle pas les `loadComponent`. Écarte le projet du modèle de référence. |
| Définir un `InjectionToken` d'authentification dans `core/`, implémenté par `main/` | **Proposition à arbitrer.** Inverse la dépendance proprement, au prix d'une indirection. Ne règle pas non plus les `loadComponent`.                                     |
| Ne pas outiller la règle du tout                                                    | Rejeté : la règle deviendrait un commentaire, et la première violation involontaire passerait inaperçue.                                                                |
| Déplacer le routing hors de `core/`                                                 | Rejeté : contredirait directement l'arborescence imposée.                                                                                                               |

## Conséquences

- La règle est désormais **vérifiée par la CI** partout où elle est applicable.
- La dérogation est explicite, localisée et commentée dans `eslint.config.js` —
  et non un contournement silencieux.
- **Point ouvert :** faut-il conserver `AuthStore` sous `main/` (fidélité à la
  référence) ou le remonter dans `core/` (cohérence de la règle d'or) ? Tant que
  la question n'est pas tranchée, la configuration actuelle reste en place. Elle
  n'a aucun impact fonctionnel.
