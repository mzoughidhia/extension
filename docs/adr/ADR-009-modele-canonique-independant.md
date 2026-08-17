# ADR-009 — Modèle canonique indépendant des compagnies

- **Statut :** accepté (principe) — implémentation en Phase 1
- **Date :** 2026-08-17
- **Phase :** 0

## Contexte

Chaque compagnie d'assurance nomme différemment la même information métier :

| Compagnie | Libellé du champ              |
| --------- | ----------------------------- |
| A         | « Date de naissance »         |
| B         | « Né(e) le »                  |
| C         | « Date naissance conducteur » |

Ces trois champs désignent une seule information : la date de naissance de
l'assuré. Sans représentation neutre, chaque compagnie ajouterait sa propre
notion du risque et le système deviendrait une collection de cas particuliers.

## Décision

Un **modèle canonique** décrit le risque indépendamment de toute compagnie. Il
est indépendant du HTML des extranets, de l'IA, de l'interface, de la base de
données et du futur CRM.

**Emplacement :** `src/app/core/models/`, que l'architecture de référence définit
comme « types partagés par plusieurs modules » (§2). Il sera consommé par le
module `quote-request`, puis par les modules d'automatisation et de mapping, par
les Cloud Functions et par l'extension Chrome. Les modèles locaux à un module
(modèles de formulaire, mappers, view-models) restent dans le `models/` du
module.

### Représentation des informations inconnues

Règle métier fondamentale : **l'absence d'information est une information.**

Cinq états sont distingués : `KNOWN`, `UNKNOWN`, `DECLARED_UNKNOWN`,
`NEEDS_CONFIRMATION`, `INVALIDATED`.

Conception retenue — **valeurs métier plates + carte d'états latérale** :

```
risk.vehicle.fiscalPower            = null
fieldStates['risk.vehicle.fiscalPower'] = { status: 'UNKNOWN' }
```

Invariants **obligatoires** :

- `null` ≠ `0`, `null` ≠ `false`, `null` ≠ `''`
- `UNKNOWN` ≠ `DECLARED_UNKNOWN`
- Aucune transformation automatique `UNKNOWN → 0` (ni vers une autre valeur
  métier) n'est permise, nulle part.
- L'absence d'entrée dans `fieldStates` vaut `UNKNOWN` (carte éparse).
- On écrit toujours `null` explicitement, **jamais `undefined`** : Firestore est
  configuré avec `ignoreUndefinedProperties: true` et supprimerait le champ
  (cf. ADR-003).

### Dates

- Dates **métier** (naissance, permis, mise en circulation, contrat) :
  `type CalendarDate = string` au format `YYYY-MM-DD`.
- Horodatages **techniques** (`createdAt`, `lastUpdatedAt`) : `number` (epoch ms),
  conformément à `DatabaseEntity` de ngx-sg.
- **`moment` n'apparaît pas dans le modèle canonique.** La conversion
  moment ↔ `CalendarDate` reste à la frontière de l'interface.

## Alternatives considérées

| Alternative                                                   | Rejetée parce que                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Encapsuler chaque champ : `FieldValue<T> = { value, status }` | Documents 4 à 5 fois plus volumineux, déballage systématique à la lecture, formulaires et requêtes Firestore alourdis.           |
| `undefined` = inconnu                                         | Impossible : `ignoreUndefinedProperties` supprime le champ, et Firestore ne sait pas requêter une absence.                       |
| `null` = 0 pour les compteurs de sinistres                    | C'est exactement l'invention de donnée que le projet interdit — et l'impact tarifaire est direct.                                |
| Dates métier en epoch `number`                                | Une date de naissance est une date calendaire, pas un instant : décalage d'un jour selon le fuseau, donc âge puis prime erronés. |
| Modèle par compagnie                                          | Fait exploser la combinatoire et rend le mapping impossible à mutualiser.                                                        |

## Conséquences

- Le catalogue des chemins canoniques (`CANONICAL_PATHS`) sera une **énumération
  fermée**. Au-delà du typage, c'est le garde-fou du futur agent : un modèle qui
  ne peut émettre qu'un membre de cette union ne peut pas inventer de
  destination.
- Un champ obligatoire doit pouvoir être « explicitement inconnu » et passer
  quand même la validation : `Validators.required` ne suffira pas. Un contrôle
  d'UI tri-état sera nécessaire (valeur + « je ne sais pas »).
- Un `schemaVersion` accompagnera chaque demande persistée, pour que les
  demandes anciennes restent relisibles après évolution du modèle.
- **Aucun de ces types n'est créé en Phase 0.** Cette ADR fixe le principe ; la
  Phase 1 y est entièrement consacrée.
