'use strict';

const { models } = require('../../models');
const cache = require('../../infrastructure/cache/cache');
const { UnauthorizedError, ForbiddenError } = require('../errors');

const CACHE_TTL_SECONDS = 60;

function contextKey(userId) {
  return `authctx:${userId}`;
}

/** Loads role, permission set and provider profile for an authenticated user. */
async function loadUserContext(userId) {
  const cached = await cache.get(contextKey(userId));
  if (cached) return cached;

  const user = await models.User.findByPk(userId, {
    include: [
      { model: models.Role, as: 'roles', include: [{ model: models.Permission, as: 'permissions' }] },
      {
        model: models.ProviderProfile,
        as: 'providerProfile',
        attributes: ['id', 'type', 'status', 'business_name'],
      },
    ],
  });

  if (!user) throw new UnauthorizedError('Account no longer exists');

  const permissions = new Set();
  for (const role of user.roles) {
    for (const permission of role.permissions) permissions.add(permission.code);
  }

  const context = {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    locale: user.locale,
    roles: user.roles.map((r) => r.code),
    role: user.roles[0]?.code || null,
    permissions: Array.from(permissions),
    providerProfile: user.providerProfile
      ? { id: user.providerProfile.id, type: user.providerProfile.type, status: user.providerProfile.status }
      : null,
  };

  await cache.set(contextKey(userId), context, CACHE_TTL_SECONDS);
  return context;
}

async function invalidateUserContext(userId) {
  await cache.del(contextKey(userId));
}

/** Provider-level guard: approved profile required before managing inventory. */
function requireApprovedProvider(user) {
  if (!user.providerProfile) {
    throw new ForbiddenError('No provider profile is linked to this account');
  }
  if (user.providerProfile.status !== 'APPROVED') {
    throw new ForbiddenError('Provider profile is not approved yet');
  }
  return user.providerProfile;
}

module.exports = { loadUserContext, invalidateUserContext, requireApprovedProvider };
