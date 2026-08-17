import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { inject } from '@angular/core';
import { exhaustMap, from, pipe, switchMap, tap } from 'rxjs';
import { AuthenticatedUserModel } from '@karma-solutions-org/ngx-sg';

import { AppRole, readRoleFromClaims } from '../models/app-role.model';
import { Credentials } from '../models/credentials.model';
import { AuthenticationService } from '../services/authentication.service';

export interface AuthState {
  user: AuthenticatedUserModel | null;
  /** true dès que le premier état d'authentification a été déterminé (connecté ou non). */
  isResolved: boolean;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AuthState = {
  user: null,
  isResolved: false,
  isLoading: false,
  error: null,
  success: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ user }) => {
    const role = computed(() => readRoleFromClaims(user()?.claims));

    return {
      isAuthenticated: computed(() => user() !== null),
      uid: computed(() => user()?.uid ?? null),
      email: computed(() => user()?.email ?? null),
      role,

      /**
       * ⚠️ COMPORTEMENT MVP — à durcir avant toute mise en production.
       *
       * Aucun custom claim n'est encore provisionné (décision G-2 : pas de
       * gestion des rôles en Phase 0). Un utilisateur authentifié SANS claim de
       * rôle est donc considéré comme admin, afin que l'espace admin reste
       * accessible pour le développement.
       *
       * Dès que les claims seront émis, remplacer par :
       *   `user() !== null && role() === AppRole.ADMIN`
       */
      isAdmin: computed(() => {
        const currentRole = role();
        return user() !== null && (currentRole === null || currentRole === AppRole.ADMIN);
      }),
    };
  }),

  withMethods((store, service = inject(AuthenticationService)) => ({
    /** Lecture continue de l'état d'authentification → `switchMap`. */
    watchAuthenticationState: rxMethod<void>(
      pipe(
        switchMap(() =>
          service.authenticationStateChanges().pipe(
            tapResponse({
              next: (user: AuthenticatedUserModel | undefined) =>
                patchState(store, { user: user ?? null, isResolved: true }),
              error: (error: Error) =>
                patchState(store, { error: error.message, isResolved: true }),
            })
          )
        )
      )
    ),

    /** Écriture → `exhaustMap` : un double clic sur « Se connecter » n'émet qu'une requête. */
    signIn: rxMethod<Credentials>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null, success: false })),
        exhaustMap(({ email, password }) =>
          from(service.signInWithEmailAndPassword(email, password)).pipe(
            tapResponse({
              next: (user: AuthenticatedUserModel | undefined) =>
                patchState(store, {
                  user: user ?? null,
                  isLoading: false,
                  success: true,
                  isResolved: true,
                }),
              error: (error: Error) =>
                patchState(store, { error: error.message, isLoading: false, success: false }),
            })
          )
        )
      )
    ),

    signOut: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        exhaustMap(() =>
          from(service.signOut()).pipe(
            tapResponse({
              next: () => patchState(store, { user: null, isLoading: false, success: false }),
              error: (error: Error) =>
                patchState(store, { error: error.message, isLoading: false }),
            })
          )
        )
      )
    ),

    clearError: () => patchState(store, { error: null }),
  })),

  withHooks({
    onInit(store) {
      // Le store est `providedIn: 'root'` : l'abonnement est établi une seule fois.
      store.watchAuthenticationState();
    },
  })
);
