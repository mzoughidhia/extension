# ADR-003 — Backend : Firebase via `@angular/fire`

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

Le CRM doit persister des demandes de devis, authentifier des utilisateurs et,
plus tard, exécuter un agent IA côté serveur (la clé d'API d'un LLM ne doit
jamais se trouver dans le client).

L'architecture de référence impose Firebase (Auth, Firestore, Functions,
Storage) via `@angular/fire`.

## Décision

Firebase est le backend du projet. Aucun serveur applicatif dédié n'est
développé.

- **Auth** — authentification des utilisateurs.
- **Firestore** — persistance ; `ignoreUndefinedProperties: true`.
- **Functions** — région `europe-west3` ; futur emplacement de l'agent IA.
- **Storage** — pièces jointes ultérieures.

## Alternatives considérées

| Alternative                        | Rejetée parce que                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| NestJS + PostgreSQL + Prisma       | Contraire à l'architecture de référence. Impliquerait d'exploiter et d'héberger un backend, sans besoin établi à ce stade. |
| Firestore + logique IA côté client | Exposerait la clé du LLM dans un bundle JavaScript. Rédhibitoire.                                                          |

## Conséquences

- **L'agent IA n'exige aucune couche architecturale nouvelle** : il sera une
  Cloud Function appelée via l'abstraction `BackendProvider` de ngx-sg
  (`execute<T>(url, objectData)`). C'est le principal bénéfice de ce choix.
- `ignoreUndefinedProperties: true` signifie qu'un champ `undefined` est
  **silencieusement supprimé** à l'écriture. Il est donc impossible de
  représenter « information inconnue » par `undefined`. Cette contrainte
  détermine la conception du modèle canonique (cf. ADR-009) : on écrit toujours
  `null` explicitement, et le statut d'un champ vit dans une carte dédiée.
- Firestore ne permet pas de requêter l'absence d'un champ — autre raison de ne
  pas encoder l'inconnu par une absence.
- L'emplacement Firestore est **définitif à la création du projet**. Aucun projet
  réel n'a été créé en Phase 0 (cf. ADR-007) : la décision de région, et les
  contraintes réglementaires associées, restent ouvertes.
