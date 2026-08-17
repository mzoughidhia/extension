# ADR-004 — Abstraction backend : `@karma-solutions-org/ngx-sg` 7.0.0

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

L'architecture de référence impose `@karma-solutions-org/ngx-sg` et ses quatre
abstractions : `AuthenticationProvider`, `DatabaseProvider`, `BackendProvider`,
`StorageProvider`.

Trois versions coexistaient au moment de la décision :

| Version   | Provenance                                                        |
| --------- | ----------------------------------------------------------------- |
| 2.22.1    | clone local `Desktop/ngx-sg`                                      |
| 2.23.0    | épinglée par le projet de référence, registre **GitHub Packages** |
| **7.0.0** | **npm public**                                                    |

Le projet de référence consomme la bibliothèque via `npm link` sur le clone
local (script `arrange: npm install && npm link`).

## Décision

1. **Version 7.0.0, depuis le registre npm public.**
2. **Aucune dépendance à un dossier local**, aucun `npm link`, aucun registre
   privé, aucun `.npmrc` avec token. `npm install` suffit sur n'importe quelle
   machine.
3. **L'API réelle de 7.0.0 fait foi.** Le code de `sg-scheduler` (ngx-sg 2.x)
   n'est pas recopié sans vérification.

## Alternatives considérées

| Alternative                | Rejetée parce que                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| 2.23.0 via GitHub Packages | Impose un token d'authentification au registre à chaque développeur et en CI.            |
| 2.22.1 via `npm link`      | Rend le projet non reproductible : il dépend d'un dossier présent sur une seule machine. |

## Conséquences — écarts constatés entre 2.x et 7.0.0

La vérification de l'API installée a révélé des différences qui auraient produit
du code non compilable si le projet de référence avait été recopié :

| Élément                                     | ngx-sg 2.x (référence)                | ngx-sg 7.0.0 (retenu)                                               |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `AppCheckProviderService.provideAppCheck()` | utilisé dans `app.config.ts`          | **n'existe pas** — App Check non câblé                              |
| `DEFAULT_GENERAL_STYLING`                   | exporté par la bibliothèque           | **non exporté** — défini dans `core/constants/styling.structure.ts` |
| `DatabaseProvider.set/getById/list`         | premier argument `entityName: string` | premier argument `EntityDescriptor<T>` / `CollectionDescriptor`     |
| `DatabaseProvider.update`                   | `update(entityName, data)`            | `update(entity, id, data)` — **3 arguments**                        |
| `FIREBASE_OPTIONS`                          | fourni dans `app.config.ts`           | non requis                                                          |

- Les quatre implémentations concrètes sont confirmées présentes :
  `FireauthProvider`, `FirestoreProvider`, `FirebaseFunctionsProvider`,
  `FirestorageProvider`.
- La signature `EntityDescriptor` devra être étudiée en Phase 1, au moment
  d'écrire le premier service de persistance.
- `moment` et `@angular/material-moment-adapter` sont des peer dependencies :
  ngx-sg impose une manipulation de dates basée sur moment. Le modèle canonique
  n'utilisera pas moment (cf. ADR-009) ; la conversion reste à la frontière de
  l'interface.
- `moment` est du CommonJS : il est déclaré dans `allowedCommonJsDependencies`
  pour documenter l'acceptation du bailout d'optimisation.
