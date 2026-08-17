import { AppRole, isAppRole, readRoleFromClaims, ROLE_CLAIM_KEY } from './app-role.model';

describe('app-role.model', () => {
  describe('isAppRole', () => {
    it('should accept every declared role', () => {
      Object.values(AppRole).forEach((role) => expect(isAppRole(role)).toBeTrue());
    });

    it('should reject unknown or non-string values', () => {
      [undefined, null, 42, {}, 'root', 'ADMIN'].forEach((value) =>
        expect(isAppRole(value)).toBeFalse()
      );
    });
  });

  describe('readRoleFromClaims', () => {
    it('should read a valid role claim', () => {
      expect(readRoleFromClaims({ [ROLE_CLAIM_KEY]: AppRole.ADMIN })).toBe(AppRole.ADMIN);
    });

    it('should return null when claims are absent', () => {
      expect(readRoleFromClaims(undefined)).toBeNull();
    });

    it('should return null when the claim is not a known role', () => {
      expect(readRoleFromClaims({ [ROLE_CLAIM_KEY]: 'root' })).toBeNull();
    });

    it('should not confuse an unknown role with a default one', () => {
      expect(readRoleFromClaims({})).toBeNull();
    });
  });
});
