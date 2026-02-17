/**
 * Auth module — central re-exports.
 */
export { hashPassword, verifyPassword, validatePasswordStrength } from './password';
export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from './jwt';
export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissions,
  compareRoles,
  type Role,
  type Permission,
} from './rbac';
