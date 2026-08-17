# ADR-002 — État applicatif : `@ngrx/signals` / `signalStore`

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

L'architecture de référence impose `@ngrx/signals` (`signalStore`) et exclut le
`Store` / `actions` / `reducers` classique. Les effets asynchrones passent par
`rxMethod` (`@ngrx/signals/rxjs-interop`) et `tapResponse` (`@ngrx/operators`).

## Décision

- Chaque module métier possède un `signalStore` déclaré `{ providedIn: 'root' }`,
  composé de `withState` / `withComputed` / `withMethods` (et `withHooks` quand
  une initialisation est nécessaire).
- `isLoading`, `error`, `success` vivent **dans le state**, jamais dans un
  composant.
- **`switchMap` pour les lectures** (la dernière requête gagne).
  **`exhaustMap` pour les écritures** (un double clic sur « Enregistrer »
  n'émet qu'une seule requête).
- `AuthStore` est la première application de ce patron.

## Alternatives considérées

| Alternative                           | Rejetée parce que                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@ngrx/store` classique               | Exclu par l'architecture de référence ; verbosité sans bénéfice ici.                                    |
| Signaux Angular nus dans des services | Perd la composition (`withComputed`, `withHooks`), les conventions d'équipe et la testabilité uniforme. |
| `mergeMap` pour les écritures         | N'empêche pas les doubles soumissions — précisément le risque à couvrir sur une création de devis.      |

## Conséquences

- `@ngrx/store` et `@ngrx/router-store` sont malgré tout installés : ce sont des
  **peer dependencies de `ngx-sg` 7.0.0**. Leur présence dans `package.json`
  n'est pas une déviation ; le code métier ne les utilise pas.
- `@ngrx/operators` est en version 21.x alors qu'Angular est en 19.x : ce
  package ne contraint pas la version d'Angular, et c'est l'alignement retenu
  par le projet de référence.
