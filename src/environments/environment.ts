import { AppEnvironment } from './environment.model';

/**
 * Environnement de PRODUCTION.
 *
 * ⚠️ Phase 0 : aucun projet Firebase réel n'a été créé (décision G-3).
 * Les valeurs ci-dessous sont des marqueurs volontairement invalides, afin
 * qu'un build de production ne puisse pas se connecter à un backend par erreur.
 *
 * À renseigner lors de la création du projet Firebase, après arbitrage sur la
 * région Firestore (choix définitif et irréversible) et sur les contraintes
 * réglementaires de résidence des données.
 */
export const environment: AppEnvironment = {
  production: true,

  firebaseConfig: {
    apiKey: 'REPLACE_ME',
    authDomain: 'REPLACE_ME',
    projectId: 'REPLACE_ME',
    storageBucket: 'REPLACE_ME',
    messagingSenderId: 'REPLACE_ME',
    appId: 'REPLACE_ME',
  },

  functionsRegion: 'europe-west3',

  useEmulators: false,
  emulatorHost: '127.0.0.1',
  emulatorPorts: {
    auth: 9099,
    firestore: 8080,
    functions: 5001,
    storage: 9199,
  },

  // ⚠️ À renseigner avec l'id de production de l'extension "Form Agent" une fois publiée.
  formAgentExtensionId: '',
};
