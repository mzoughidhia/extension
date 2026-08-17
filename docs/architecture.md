# Architecture — CRM Courtier

Ce document décrit l'architecture **de ce projet**. Il s'appuie sur
l'architecture de référence interne « Angular 19 / Signals / Firebase » (extraite
du projet `sg-scheduler`), qui reste la source normative pour les conventions.
Ici : ce qui existe aujourd'hui, où placer ce qui arrive, et pourquoi.

Les décisions sont tracées dans [`adr/`](./adr).

---

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│  Application Angular 19 (standalone, signalStore)            │
│                                                              │
│  core/     transverse, sans UI      ┐                        │
│  main/     fonctionnel (modules)    ├─ un seul projet        │
│  shared/   UI générique             ┘                        │
└───────────────────────┬──────────────────────────────────────┘
                        │ abstractions ngx-sg
                        │ (Authentication / Database / Backend / Storage)
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  Firebase — en développement : Emulator Suite (projet demo-) │
│  Auth · Firestore · Functions (europe-west3) · Storage       │
└──────────────────────────────────────────────────────────────┘
```

Le code métier n'appelle **jamais** Firebase directement : il injecte une
abstraction ngx-sg. C'est ce qui rend la persistance remplaçable et les stores
testables sans émulateur.

---

## 2. État à la fin de la Phase 0

| Brique                                                         | État                            |
| -------------------------------------------------------------- | ------------------------------- |
| Squelette `core` / `main` / `shared`                           | ✅                              |
| Routing par rôle, lazy, guards fonctionnels                    | ✅                              |
| Authentification Firebase (email / mot de passe) + `AuthStore` | ✅                              |
| Route admin protégée (`/admin/home`)                           | ✅ vérification de bout en bout |
| Firebase Emulator Suite                                        | ✅ Auth, Firestore, Storage, UI |
| Outillage (ESLint, Prettier, Karma, CI)                        | ✅                              |
| **Modèle canonique**                                           | ⏳ Phase 1                      |
| `quote-request-module`                                         | ⏳ Phase 1                      |
| Agent IA, extension Chrome, extranets                          | ⏳ ultérieur                    |

---

## 3. Arborescence et rôle de chaque dossier

```
src/app/
├── app.config.ts              Point unique d'assemblage des providers
│
├── core/                      Transverse, sans UI, chargé une seule fois
│   ├── constants/             *.structure.ts — constantes et valeurs par défaut
│   ├── models/                ⏳ MODÈLE CANONIQUE (Phase 1)
│   ├── providers/             Providers custom
│   ├── services/              Logique transverse pure
│   ├── utils/                 Fonctions pures
│   └── routing/               Câblage des routes (cf. ADR-010)
│       ├── app.routes.ts          Racine : segmentation par rôle
│       ├── admin-routes/          Routes admin + métadonnées
│       ├── common-routes/         Routes publiques + métadonnées
│       └── guards/                CanActivateFn fonctionnels
│
├── main/                      Tout le fonctionnel
│   ├── commons/               Partagé entre rôles
│   │   ├── main-module/           AppComponent (coquille)
│   │   └── authentication-module/  models · services · store · components
│   └── admin/                 Réservé au rôle admin
│       └── home-module/           Route de vérification (Phase 0)
│
└── shared/                    UI générique, aucun métier
    ├── shared.module.ts       Barrel (PAS un NgModule)
    └── components/
        └── page-header/
```

### Règle d'or

> `core` ne dépend jamais de `main`. `shared` ne dépend d'aucun store métier.

Cette règle est **vérifiée par ESLint**, pas seulement documentée. Une dérogation
explicite existe pour `core/routing` — voir [ADR-010](./adr/ADR-010-frontiere-core-main.md).

---

## 4. Anatomie d'un module métier

Quatre sous-dossiers, toujours les mêmes :

```
xxx-module/
├── models/          interfaces, types, mappers purs
├── services/        I/O via les abstractions ngx-sg + transformations pures
├── store/           signalStore : withState / withComputed / withMethods
└── components/
    ├── xxx-container/   SMART : injecte le store, orchestre, navigue
    └── xxx/             DUMB  : input() / output(), OnPush, aucun store
```

Un module purement présentiel peut n'avoir que `components/` — c'est le cas de
`home-module` en Phase 0, qui ne persiste rien.

### Flux de données

```
Firestore ──> Service ──> Store (signals) ──> Container ──> [input()] ──> Presentation
                            ▲                                                  │
                            └────────── méthode du store ◄── [output()] ───────┘
```

### Conventions de store

- `isLoading`, `error`, `success` **dans le state**, jamais dans un composant.
- **`switchMap` pour les lectures** — la dernière requête gagne.
- **`exhaustMap` pour les écritures** — empêche la double soumission.
- `signalStore({ providedIn: 'root' })`.

### Smart / Dumb

|                                       | Container (smart)       | Presentation (dumb) |
| ------------------------------------- | ----------------------- | ------------------- |
| Injecte le store                      | ✅                      | ❌                  |
| `Router`                              | ✅                      | ❌                  |
| Accès Firestore                       | ❌ (passe par le store) | ❌                  |
| `input()` / `output()`                | —                       | ✅                  |
| `ChangeDetectionStrategy.OnPush`      | ✅                      | ✅                  |
| Services **purs** (ex. `FormBuilder`) | ✅                      | ✅                  |

Le `FormGroup` d'un formulaire vit dans le composant **dumb** : c'est de l'état
d'UI. Le container ne le manipule jamais.

---

## 5. Routing

```
app.routes.ts
   │
   ├── /admin/**   canActivate: [adminGuard]  → loadChildren admin-routes
   └── /common/**  (public)                   → loadChildren common.routes
```

Chaque espace comporte deux fichiers :

- `xxx-route-container.model.ts` — métadonnées (chemin, titre, icônes),
  centralisées et destinées à alimenter la navbar via `getNavbarRoutes()`.
- `xxx-routes.ts` — les `Route[]`, toujours en `loadComponent` (lazy).

> ⚠️ Dans un `RouteContainerModel`, `static readonly prefix` doit être déclaré
> **avant** les routes : la fabrique de ngx-sg lit ce membre statique pour
> composer `fullPath` (`/<prefix>/<path>`). L'ordre d'initialisation des membres
> statiques JavaScript est donc load-bearing.

Les guards attendent que l'état d'authentification soit **résolu** avant de
décider. Au premier chargement, Firebase Auth n'a pas encore restauré la
session : répondre immédiatement redirigerait à tort vers la page de connexion.

---

## 6. Authentification

```
Emulator Auth ──> FireauthProvider ──> AuthenticationService ──> AuthStore ──> adminGuard ──> /admin/**
```

`AuthStore` expose `isAuthenticated`, `uid`, `email`, `role`, `isAdmin`, plus
`isResolved` (l'état initial a-t-il été déterminé ?).

Les rôles (`admin`, `broker`, `manager`, `supervisor`) sont **déclarés** mais non
implémentés : ils proviendront des custom claims Firebase.

> ⚠️ **Comportement MVP à durcir.** Aucun custom claim n'est encore provisionné :
> un utilisateur authentifié **sans** claim de rôle est considéré comme admin,
> afin que l'espace admin reste accessible en développement. À remplacer par
> `role() === AppRole.ADMIN` dès que les claims sont émis. Le point est isolé
> dans un unique `computed` de `AuthStore`.

---

## 7. Où placera-t-on la suite

| Brique à venir             | Emplacement                                        | Impact sur l'architecture                                 |
| -------------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| Modèle canonique           | `core/models/`                                     | aucun                                                     |
| Demande de devis           | `main/admin/quote-request-module/`                 | aucun                                                     |
| Clients, devis, compagnies | `main/admin/<nom>-module/`                         | aucun                                                     |
| Mapping, automatisation    | `main/admin/mapping-module/`, `automation-module/` | aucun                                                     |
| **Agent IA**               | Cloud Function, appelée via `BackendProvider`      | **aucun** — déjà provisionné                              |
| **Extension Chrome**       | projet frère dans `angular.json`                   | extraction de `core/models` en bibliothèque, **additive** |

Le seul changement structurel de toute la feuille de route est l'extraction du
modèle canonique en bibliothèque, le jour où l'extension arrivera. Un barrel de
compatibilité (`core/models/insurance/index.ts`) permettra de ne modifier aucun
import.

---

## 8. Commandes

```bash
npm install            # installe tout ; aucune dépendance locale requise
npm run emulators      # Firebase Emulator Suite (UI : http://127.0.0.1:4000)
npm start              # application sur http://localhost:4200
npm run verify         # lint + typecheck + tests + build
```
