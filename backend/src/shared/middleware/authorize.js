'use strict';

const { ForbiddenError } = require('../errors');

/**
 * Requires every listed permission. Permissions are resolved centrally from
 * role_permissions during authentication - never hardcoded in controllers.
 */
function authorize(...requiredPermissions) {
  return function permissionGuard(req, res, next) {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const granted = new Set(req.user.permissions);
    const missing = requiredPermissions.filter((permission) => !granted.has(permission));
    if (missing.length > 0) {
      return next(new ForbiddenError(`Missing permission: ${missing.join(', ')}`));
    }
    return next();
  };
}

function authorizeAny(...permissions) {
  return function anyPermissionGuard(req, res, next) {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const granted = new Set(req.user.permissions);
    if (permissions.some((permission) => granted.has(permission))) return next();
    return next(new ForbiddenError(`Requires one of: ${permissions.join(', ')}`));
  };
}

function requireRoles(...roleCodes) {
  return function roleGuard(req, res, next) {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    if (roleCodes.some((code) => req.user.roles.includes(code))) return next();
    return next(new ForbiddenError('Your role cannot access this resource'));
  };
}

module.exports = { authorize, authorizeAny, requireRoles };
