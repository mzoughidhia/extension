# ADR-007 — Développement local et CI : Firebase Emulator Suite, projet `demo-`

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

Le projet manipulera des données personnelles de clients (nom, date de
naissance, CIN, adresse). Aucun projet Firebase réel ne doit être créé tant que
la région Firestore — **choix définitif et irréversible** — et les contraintes
réglementaires de résidence des données ne sont pas arbitrées.

Par ailleurs, la CI ne doit dépendre d'aucun secret Firebase.

## Décision

1. **Développement local intégralement sur la Firebase Emulator Suite** :
   Authentication (9099), Firestore (8080), Storage (9199), UI (4000).
2. **`projectId` préfixé `demo-`** : `demo-insurance-crm`. La Emulator Suite
   traite les projets ainsi nommés comme strictement locaux — elle refuse tout
   accès à un service non émulé et n'exige aucune clé de service. Vérifié au
   démarrage : `Detected demo project ID "demo-insurance-crm", emulated services
will use a demo configuration and attempts to access non-emulated services
for this project will fail.`
3. **`environment.ts` (production) contient des marqueurs `REPLACE_ME`**, afin
   qu'un build de production ne puisse pas se connecter à un backend par erreur.
4. **`firebase-tools` en devDependency**, pas en installation globale.
5. Règles Firestore et Storage en **deny-by-default**.

## Alternatives considérées

| Alternative                           | Rejetée parce que                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Créer un projet Firebase « dev » réel | Fige la région Firestore avant l'arbitrage réglementaire, et fait sortir des données d'un poste de développement. |
| Émulateurs avec un `projectId` normal | Perd le garde-fou : une mauvaise configuration peut alors atteindre un projet réel.                               |
| Bouchonner Firestore côté application | Ne teste pas les vraies règles de sécurité ni la sémantique réelle de Firestore.                                  |

## Conséquences

- `npm run emulators` démarre l'environnement complet ; aucun compte, aucune clé.
- La CI exécute `lint`, `typecheck`, `test`, `build` **sans aucun secret**.
- L'émulateur Firestore requiert un **JDK** (vérifié : Java 17 présent).
- Les comptes créés dans l'émulateur Auth sont éphémères : ils disparaissent à
  l'arrêt, sauf usage de `--import` / `--export-on-exit`.
- Avant toute mise en production il faudra : créer le projet réel, arbitrer la
  région, renseigner `environment.ts`, écrire les règles Firestore réelles et
  décider de l'activation d'App Check (non disponible dans ngx-sg 7.0.0,
  cf. ADR-004).
