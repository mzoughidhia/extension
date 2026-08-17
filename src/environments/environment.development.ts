import { AppEnvironment } from './environment.model';

/**
 * Environnement de DÉVELOPPEMENT — 100 % Firebase Emulator Suite.
 *
 * Le `projectId` commence volontairement par `demo-` : la Emulator Suite traite
 * ces projets comme strictement locaux. Aucune requête ne peut atteindre un
 * projet Firebase réel, et aucune clé de service n'est nécessaire.
 * C'est ce qui permet de développer et de faire tourner la CI sans aucun secret
 * ni aucune donnée client réelle (décision G-3).
 */
export const environment: AppEnvironment = {
  production: false,

  firebaseConfig: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-insurance-crm.firebaseapp.com',
    projectId: 'demo-insurance-crm',
    storageBucket: 'demo-insurance-crm.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },

  functionsRegion: 'europe-west3',

  useEmulators: true,
  emulatorHost: '127.0.0.1',
  emulatorPorts: {
    auth: 9099,
    firestore: 8080,
    functions: 5001,
    storage: 9199,
  },

  // ⚠️ À renseigner après avoir chargé l'extension "Form Agent" en mode développeur
  // (chrome://extensions → copier l'id affiché sous le nom de l'extension).
  formAgentExtensionId: '',
};
