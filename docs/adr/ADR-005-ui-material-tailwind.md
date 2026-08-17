# ADR-005 — UI : Angular Material + Tailwind CSS 3.4

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

L'architecture de référence impose Angular Material et Tailwind CSS. Le projet
comportera des formulaires denses (une demande de devis auto compte une
trentaine de champs), ce qui appelle des composants de formulaire éprouvés et
accessibles, plus un moyen rapide de composer des mises en page.

## Décision

- **Angular Material 19** pour les composants interactifs : champs de
  formulaire, boutons, sélecteurs de date, dialogues, snackbars.
- **Tailwind CSS 3.4.x** pour la mise en page et l'espacement.
- Thème Material préconstruit `azure-blue`, déclaré dans `angular.json`.
- `postcss.config.js` + `tailwind.config.js` à la racine, comme dans le projet
  de référence.

## Alternatives considérées

| Alternative      | Rejetée parce que                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tailwind CSS 4.x | Change complètement le modèle de configuration (CSS-first, plus de `tailwind.config.js`) et divergerait du projet de référence. Version épinglée en 3.4.x. |
| Material seul    | La composition de mises en page en SCSS pur est plus lente et produit du CSS spécifique à chaque composant.                                                |
| Tailwind seul    | Il faudrait réimplémenter des champs de formulaire accessibles — coûteux et risqué.                                                                        |

## Conséquences

- Deux systèmes de style coexistent. Convention : **Material pour les
  contrôles, Tailwind pour la disposition.** Ne pas surcharger les styles
  internes de Material avec des utilitaires Tailwind.
- Le thème préconstruit sera à remplacer par un thème M3 personnalisé lorsque
  l'identité visuelle sera arrêtée.
- Le token `GENERAL_STYLING` de ngx-sg est alimenté par
  `DEFAULT_GENERAL_STYLING` (`core/constants/styling.structure.ts`) : ses
  couleurs devront être harmonisées avec le thème Material.
