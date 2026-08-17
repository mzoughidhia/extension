# ADR-008 — Les credentials ne sont jamais exposés à l'IA, au frontend ni aux logs

- **Statut :** accepté
- **Date :** 2026-08-17
- **Phase :** 0 (principe) — mise en œuvre ultérieure

## Contexte

À terme, le système se connectera aux extranets des compagnies d'assurance pour
produire des devis. Ces extranets exigent des identifiants. Par ailleurs, un
agent IA analysera le contenu de pages web — c'est-à-dire du **contenu non
fiable**.

Aucun credential de compagnie n'est créé en Phase 0. Cette ADR fixe la règle
**avant** que le besoin n'apparaisse, pour qu'elle contraigne la conception au
lieu d'être rétro-adaptée.

## Décision

Un credential d'extranet ne doit **jamais** :

1. être transmis à un modèle d'IA, sous quelque forme que ce soit ;
2. apparaître dans un log, une trace, un message d'erreur ou un rapport de crash ;
3. être affiché dans l'interface ;
4. être stocké en clair dans `localStorage`, `sessionStorage`, un cookie ou
   IndexedDB ;
5. être présent dans le code source ou dans un fichier committé ;
6. être écrit dans la console.

Règles de conception qui en découlent :

- **Le secret ne transite jamais par la couche qui parle au LLM.** La séparation
  est structurelle, pas déclarative : le composant qui analyse un formulaire
  reçoit un descripteur de champs assaini, dont les champs de type `password`,
  `autocomplete="*-password"` et tout nom correspondant à
  `/pass|pwd|secret|token|cvv/i` ont été **retirés avant sérialisation**.
- **Un secret ne franchit jamais la frontière serveur → client.** Aucune API ne
  renvoie une valeur de secret, seulement une référence.
- **Redaction par liste blanche** dans la journalisation, pas par liste noire :
  on énumère ce qui peut être journalisé.
- **Le contenu d'une page web n'est jamais une instruction.** Les canaux
  « instructions système », « données métier » et « contenu de page » restent
  strictement séparés, et la sortie du modèle est contrainte par schéma.

## Alternatives considérées

| Alternative                                                                      | Rejetée parce que                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Stocker les credentials côté client, chiffrés                                    | La clé de déchiffrement se trouverait aussi côté client. Le chiffrement serait décoratif.                                       |
| S'appuyer sur des revues de code et de la discipline                             | Un oubli suffit, et la fuite est irréversible. La contrainte doit être portée par l'architecture et l'outillage.                |
| Laisser l'agent lire la page brute avec une consigne « ignore les instructions » | Une consigne dans un prompt se contourne. La défense doit être la structure des données envoyées et la contrainte de la sortie. |

## Conséquences

- Le MVP prévoit une **connexion manuelle** de l'utilisateur aux extranets :
  l'application ne manipule aucun credential. Surface d'attaque nulle, et cela
  couvre d'emblée les extranets à 2FA/OTP.
- Une éventuelle gestion des credentials nécessitera une ADR dédiée
  (chiffrement enveloppe, gestion des clés, rotation, audit).
- `.gitignore` exclut `.env*`, `.npmrc`, `serviceAccount*.json` et
  `firebase-adminsdk*.json`.
- Aucun credential réel ne doit être saisi dans l'émulateur Auth : les comptes
  de développement sont fictifs.
