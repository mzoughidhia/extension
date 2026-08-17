import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  provideFirestore,
} from '@angular/fire/firestore';
import { connectFunctionsEmulator, getFunctions, provideFunctions } from '@angular/fire/functions';
import { connectStorageEmulator, getStorage, provideStorage } from '@angular/fire/storage';

import {
  AuthenticationProvider,
  BackendProvider,
  DatabaseProvider,
  FireauthProvider,
  FirebaseFunctionsProvider,
  FirestorageProvider,
  FirestoreProvider,
  GENERAL_STYLING,
  StorageProvider,
} from '@karma-solutions-org/ngx-sg';

import { environment } from '../environments/environment';
import { DEFAULT_GENERAL_STYLING } from './core/constants/styling.structure';
import { ROUTES } from './core/routing/app.routes';
import { MockOcrProvider } from './main/admin/document-module/services/mock-ocr.provider';
import { OcrProvider } from './main/admin/document-module/services/ocr-provider';

const { emulatorHost, emulatorPorts, useEmulators } = environment;

/**
 * Point unique d'assemblage de l'application (architecture de référence §4.6).
 *
 * Ordre : Firebase → providers ngx-sg → animations → HTTP → router.
 *
 * Les quatre abstractions de ngx-sg (`AuthenticationProvider`, `DatabaseProvider`,
 * `BackendProvider`, `StorageProvider`) sont liées ici à leurs implémentations
 * Firebase. Le code métier n'injecte jamais Firebase directement : il injecte
 * l'abstraction, ce qui la rend remplaçable et testable.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: GENERAL_STYLING, useValue: DEFAULT_GENERAL_STYLING },

    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),

    provideAuth(() => {
      const auth = getAuth();
      if (useEmulators) {
        connectAuthEmulator(auth, `http://${emulatorHost}:${emulatorPorts.auth}`, {
          disableWarnings: true,
        });
      }
      return auth;
    }),

    provideFirestore(() => {
      const firestore = initializeFirestore(getApp(), { ignoreUndefinedProperties: true });
      if (useEmulators) {
        connectFirestoreEmulator(firestore, emulatorHost, emulatorPorts.firestore);
      }
      return firestore;
    }),

    provideFunctions(() => {
      const functions = getFunctions(getApp(), environment.functionsRegion);
      if (useEmulators) {
        connectFunctionsEmulator(functions, emulatorHost, emulatorPorts.functions);
      }
      return functions;
    }),

    provideStorage(() => {
      const storage = getStorage();
      if (useEmulators) {
        connectStorageEmulator(storage, emulatorHost, emulatorPorts.storage);
      }
      return storage;
    }),

    { provide: AuthenticationProvider, useClass: FireauthProvider },
    { provide: DatabaseProvider, useClass: FirestoreProvider },
    { provide: BackendProvider, useClass: FirebaseFunctionsProvider },
    { provide: StorageProvider, useClass: FirestorageProvider },
    // ⚠️ MOCK — à remplacer par un vrai fournisseur OCR (Google Vision, Document AI, ...)
    // en changeant uniquement cette ligne. Aucun composant Angular n'a à être modifié.
    { provide: OcrProvider, useClass: MockOcrProvider },

    provideAnimationsAsync(),
    provideHttpClient(withFetch()),
    importProvidersFrom(MatSnackBarModule),
    provideRouter(ROUTES, withComponentInputBinding()),
  ],
};
