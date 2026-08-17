# CRM Courtier — `insurance-crm`

CRM pour courtier en assurances. À terme : produire automatiquement plusieurs
devis auprès de plusieurs compagnies depuis une seule demande client.

**État : Phase 0 terminée** — squelette applicatif, authentification et
outillage. Le modèle canonique et la première page métier arrivent en Phase 1.

- Architecture : [`docs/architecture.md`](./docs/architecture.md)
- Décisions : [`docs/adr/`](./docs/adr)

---

## Prérequis

| Outil   | Version | Pourquoi                         |
| ------- | ------- | -------------------------------- |
| Node.js | ≥ 20    | Angular 19                       |
| npm     | 10.x    | `packageManager` du projet       |
| JDK     | ≥ 11    | requis par l'émulateur Firestore |
| Chrome  | récent  | requis par Karma                 |

Aucun compte Firebase, aucune clé, aucun secret n'est nécessaire pour développer.

---

## Démarrage

```bash
npm install
```

Dans un premier terminal — la Firebase Emulator Suite :

```bash
npm run emulators
```

| Émulateur      | Adresse               |
| -------------- | --------------------- |
| UI             | http://127.0.0.1:4000 |
| Authentication | 127.0.0.1:9099        |
| Firestore      | 127.0.0.1:8080        |
| Storage        | 127.0.0.1:9199        |

Dans un second terminal — l'application :

```bash
npm start          # http://localhost:4200
```

### Se connecter

L'application redirige vers `/common/signin`. Aucun compte n'existe au démarrage :
l'émulateur Auth part vide à chaque lancement.

1. Ouvrir l'UI des émulateurs → onglet **Authentication** → **Add user**.
2. Renseigner une adresse e-mail et un mot de passe fictifs (≥ 6 caractères).
3. Se connecter dans l'application → redirection vers `/admin/home`.

> N'utilisez jamais un identifiant réel, même dans l'émulateur
> (cf. [ADR-008](./docs/adr/ADR-008-credentials-jamais-exposes.md)).

---

## Scripts

| Script                  | Rôle                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `npm start`             | serveur de développement                                          |
| `npm run emulators`     | Firebase Emulator Suite (projet `demo-insurance-crm`)             |
| `npm run build`         | build de production                                               |
| `npm test`              | tests unitaires (watch)                                           |
| `npm run test:ci`       | tests unitaires headless, une passe                               |
| `npm run test:coverage` | tests + couverture                                                |
| `npm run lint`          | ESLint (TS + templates)                                           |
| `npm run typecheck`     | `tsc --noEmit` sur l'app et les specs                             |
| `npm run format:fix`    | Prettier                                                          |
| **`npm run verify`**    | **lint + typecheck + tests + build** — à passer avant tout commit |

Sous Windows, si Karma ne trouve pas Chrome :

```bash
export CHROME_BIN="/c/Program Files/Google/Chrome/Application/chrome.exe"
```

---

## Conventions

- **Standalone components uniquement.** Aucun `NgModule` — une règle ESLint
  l'interdit. Les dossiers `*-module` sont des unités d'organisation.
- **`core` ne dépend jamais de `main` ; `shared` ne dépend d'aucun store métier.**
  Vérifié par ESLint (dérogation documentée pour `core/routing`,
  cf. [ADR-010](./docs/adr/ADR-010-frontiere-core-main.md)).
- **Container = smart, composant = dumb.** Un dumb n'injecte ni store, ni
  `Router`, ni Firestore.
- **Un `.spec.ts` par fichier porteur de logique**, à côté du fichier testé.
- **Identifiants du code en anglais**, textes d'interface en français.
- `switchMap` pour les lectures, `exhaustMap` pour les écritures.

---

## Règle métier fondamentale

Le système ne doit **jamais** inventer une donnée.

```
claimsCount = null   ≠   claimsCount = 0
UNKNOWN              ≠   DECLARED_UNKNOWN
```

Une information absente reste absente jusqu'à ce qu'un utilisateur la
renseigne. Détail de la conception :
[ADR-009](./docs/adr/ADR-009-modele-canonique-independant.md).
"# extension" 
