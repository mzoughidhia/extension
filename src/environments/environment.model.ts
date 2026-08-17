/**
 * Contrat commun aux fichiers d'environnement.
 * Garantit que `environment.ts` (prod) et `environment.development.ts` ne dérivent pas.
 */
export interface FirebaseEmulatorPorts {
  readonly auth: number;
  readonly firestore: number;
  readonly functions: number;
  readonly storage: number;
}

export interface AppEnvironment {
  readonly production: boolean;

  /** Configuration Web Firebase. Publique par nature ; la protection repose sur les règles Firestore. */
  readonly firebaseConfig: {
    readonly apiKey: string;
    readonly authDomain: string;
    readonly projectId: string;
    readonly storageBucket: string;
    readonly messagingSenderId: string;
    readonly appId: string;
  };

  /** Région des Cloud Functions (décision G-3 : europe-west3). */
  readonly functionsRegion: string;

  /** Lorsque true, l'application se branche sur la Firebase Emulator Suite locale. */
  readonly useEmulators: boolean;
  readonly emulatorHost: string;
  readonly emulatorPorts: FirebaseEmulatorPorts;

  /**
   * Identifiant de l'extension Chrome "Form Agent" à contacter via
   * `chrome.runtime.sendMessage(formAgentExtensionId, ...)`.
   *
   * En développement (extension chargée en mode développeur), cet id change
   * par machine — le renseigner manuellement après chargement de l'extension
   * dans `chrome://extensions`. Une chaîne vide désactive proprement
   * l'intégration ("Form Agent n'est pas disponible").
   */
  readonly formAgentExtensionId: string;
}
