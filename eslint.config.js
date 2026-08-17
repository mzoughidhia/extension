// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Règle d'or de l'architecture de référence :
 *   - `core` ne dépend jamais de `main`
 *   - `shared` ne dépend d'aucun store métier
 *
 * Ces deux règles sont outillées ci-dessous plutôt que laissées à la discipline.
 *
 * DÉROGATION documentée : `core/routing/**` est exclu de la première règle.
 * L'architecture de référence place le routing dans `core/` alors qu'il doit,
 * par nature, désigner les composants de `main/` :
 *   - `admin-routes.ts` / `common.routes.ts` → `loadComponent(() => import('../../../main/...'))`
 *   - `guards/*.guard.ts` → `inject(AuthStore)` depuis `main/commons/authentication-module`
 *     (exactement ce que fait sg-scheduler).
 *
 * `core/routing` est donc la couche de câblage, et la règle d'or s'applique au
 * reste de `core` (constants, models, services, utils, providers) — c'est-à-dire
 * à la logique transverse. Voir docs/adr/ADR-009 et le point ouvert
 * « frontière core/main ».
 */
module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      // §6 — standalone components uniquement, aucun NgModule Angular.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@angular/core',
              importNames: ['NgModule'],
              message:
                'Standalone components uniquement (§6). Les dossiers "*-module" sont organisationnels, pas des NgModule.',
            },
          ],
        },
      ],
    },
  },

  // core ne dépend jamais de main ni de shared.
  {
    files: ['src/app/core/**/*.ts'],
    ignores: ['src/app/core/routing/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/main/**', '**/shared/**'],
              message: "Règle d'or : core ne dépend jamais de main ni de shared.",
            },
          ],
        },
      ],
    },
  },

  // shared ne dépend d'aucun store métier (ni d'un module de main).
  {
    files: ['src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/main/**'],
              message: "Règle d'or : shared ne dépend d'aucun store métier.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  }
);
