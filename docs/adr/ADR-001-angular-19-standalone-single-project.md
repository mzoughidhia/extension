# ADR-001 — Application Angular 19 unique, standalone components

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

Le projet est un CRM pour courtier en assurances, à construire from scratch. Une
architecture de référence interne existe (`Angular 19 / Signals / Firebase`,
extraite du projet `sg-scheduler`) et doit être respectée.

À terme, le système comportera aussi une extension Chrome et un agent IA. La
question s'est posée de démarrer directement sur un monorepo multi-projets.

## Décision

1. **Angular 19 avec standalone components exclusivement.** Aucun `NgModule`
   n'est créé. Les dossiers suffixés `-module` sont des unités
   d'organisation fonctionnelle, pas des `NgModule` Angular. Une règle ESLint
   interdit l'import de `NgModule` depuis `@angular/core`.
2. **Un seul projet Angular** dans `angular.json` pour l'instant. Pas de
   monorepo, pas d'outillage de workspace (pnpm workspaces, Turborepo, Nx).

## Alternatives considérées

| Alternative                              | Rejetée parce que                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo pnpm + Turborepo dès la Phase 0 | Aucun consommateur partagé n'existe encore : un seul artefact est produit. Le coût de configuration est immédiat, le bénéfice hypothétique. |
| Nx                                       | Même raison, avec en plus une empreinte structurelle forte qui divergerait de l'architecture de référence.                                  |
| `NgModule` pour les modules métier       | Contraire à l'architecture de référence et à la direction d'Angular depuis la v15.                                                          |

## Conséquences

- `npm install` suffit à rendre le projet reproductible sur une autre machine.
- L'arrivée de l'extension Chrome nécessitera un workspace Angular multi-projets
  (`projects/`) avec extraction du modèle canonique en bibliothèque. Cette
  opération est **additive** : un barrel de compatibilité dans
  `core/models/` permettra de ne modifier aucun import existant.
- Tant que ce découpage n'est pas fait, le modèle canonique n'est pas
  consommable hors de l'application Angular.
