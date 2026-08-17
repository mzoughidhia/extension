# ADR-006 — Tests : Karma + Jasmine

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

L'architecture de référence impose Karma + Jasmine, avec un `.spec.ts` par
fichier, placé à côté du fichier testé.

## Décision

- Karma 6.4 + Jasmine 5.6, exécutés par le builder
  `@angular-devkit/build-angular:karma`.
- `karma.conf.js` explicite à la racine (plutôt que la configuration implicite
  du builder), afin de pouvoir déclarer un launcher dédié à la CI.
- Deux launchers : `ChromeHeadless` en local, **`ChromeHeadlessCI`**
  (`--no-sandbox --disable-gpu --disable-dev-shm-usage`) en intégration continue.
- Un `.spec.ts` par fichier porteur de logique.

## Alternatives considérées

| Alternative                                               | Rejetée parce que                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Vitest / Web Test Runner (builders expérimentaux Angular) | Contraire à l'architecture de référence, et encore expérimental sur Angular 19. |
| Jest                                                      | Nécessite un préréglage tiers pour Angular ; s'écarte de la référence.          |
| Playwright pour les tests unitaires                       | Mauvais outil : Playwright servira aux tests E2E, plus tard.                    |

## Conséquences

- **Karma est déprécié en amont** : ses mainteneurs ont arrêté le projet en 2023.
  Angular 19 le supporte toujours et c'est le choix de l'architecture de
  référence, donc il est conservé. Une montée de version majeure d'Angular
  imposera de réétudier le sujet — à anticiper, sans urgence.
- La CI doit installer un Chrome. Le runner `ubuntu-latest` de GitHub Actions en
  fournit un ; `CHROME_BIN` est renseigné explicitement dans le workflow.
- En local sous Windows, `CHROME_BIN` peut devoir être renseigné si Karma ne
  détecte pas Chrome automatiquement.
