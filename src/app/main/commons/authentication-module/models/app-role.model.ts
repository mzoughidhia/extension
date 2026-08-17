/**
 * Rôles applicatifs.
 *
 * La structure est prévue extensible dès maintenant (décision G-2), mais SEUL
 * `ADMIN` est câblé en Phase 0. Aucun écran de gestion des rôles, aucune
 * attribution automatique : les rôles proviendront des custom claims Firebase.
 */
export const AppRole = {
  ADMIN: 'admin',
  BROKER: 'broker',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

/** Clé du custom claim Firebase portant le rôle. */
export const ROLE_CLAIM_KEY = 'role';

const ALL_ROLES: readonly string[] = Object.values(AppRole);

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && ALL_ROLES.includes(value);
}

/**
 * Extrait le rôle des custom claims. Retourne `null` si aucun claim exploitable.
 *
 * `null` signifie « rôle inconnu », jamais « pas de droits » ni « tous les
 * droits » : c'est à l'appelant de décider. Cf. la même discipline que celle
 * retenue pour le modèle canonique (UNKNOWN ≠ valeur métier).
 */
export function readRoleFromClaims(claims: Record<string, unknown> | undefined): AppRole | null {
  const raw = claims?.[ROLE_CLAIM_KEY];
  return isAppRole(raw) ? raw : null;
}
