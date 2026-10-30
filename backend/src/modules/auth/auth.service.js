'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../../config');
const { models, sequelize } = require('../../models');
const { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken, randomToken } = require('./token.service');
const {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} = require('../../shared/errors');
const { invalidateUserContext } = require('../../shared/services/userContext.service');
const { enqueue } = require('../../infrastructure/jobs/queue');

const PROVIDER_ROLE_TYPES = {
  HOTEL_OWNER: 'HOTEL',
  TRANSPORT_PROVIDER: 'TRANSPORT',
  TOUR_GUIDE: 'GUIDE',
};

function issueTokens(user) {
  const familyId = crypto.randomUUID();
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id, familyId);
  return { accessToken, refreshToken, familyId };
}

async function persistRefreshToken({ userId, familyId, refreshToken, req }) {
  await models.RefreshToken.create({
    user_id: userId,
    family_id: familyId,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000),
    user_agent: req?.headers?.['user-agent']?.slice(0, 255) || null,
    ip: req?.ip || null,
  });
}

async function buildSession(user, req) {
  const { accessToken, refreshToken, familyId } = issueTokens(user);
  await persistRefreshToken({ userId: user.id, familyId, refreshToken, req });
  return { accessToken, refreshToken };
}

async function register(payload, req) {
  const existing = await models.User.findOne({ where: { email: payload.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const roleCode = payload.role || 'CUSTOMER';
  const role = await models.Role.findOne({ where: { code: roleCode } });
  if (!role) throw new ValidationError('Unknown role', [{ field: 'role', message: 'Unsupported role' }]);

  if (roleCode !== 'CUSTOMER' && !payload.businessName) {
    throw new ValidationError('Validation failed', [{ field: 'businessName', message: 'Business name is required for provider accounts' }]);
  }

  const passwordHash = await bcrypt.hash(payload.password, config.bcryptRounds);

  const user = await sequelize.transaction(async (transaction) => {
    const created = await models.User.create(
      {
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        password_hash: passwordHash,
        status: 'ACTIVE',
        locale: payload.locale || 'en',
      },
      { transaction }
    );

    await models.UserRole.create({ user_id: created.id, role_id: role.id }, { transaction });

    const providerType = PROVIDER_ROLE_TYPES[roleCode];
    if (providerType) {
      await models.ProviderProfile.create(
        {
          user_id: created.id,
          type: providerType,
          business_name: payload.businessName,
          phone: payload.phone || null,
          status: 'PENDING',
        },
        { transaction }
      );
    }

    return created;
  });

  const verification = await createVerificationToken(user.id, 'EMAIL_VERIFY', 24);
  await enqueue('notification.email', {
    to: user.email,
    subject: 'Verify your POTHIK account',
    text: `Welcome to POTHIK. Verify your email with this code: ${verification.rawToken}`,
  }).catch(() => {});

  const session = await buildSession(user, req);
  return {
    user: await publicUser(user.id),
    ...session,
    ...(config.isProd ? {} : { verificationToken: verification.rawToken }),
  };
}

async function createVerificationToken(userId, purpose, ttlHours) {
  const rawToken = randomToken();
  await models.VerificationToken.create({
    user_id: userId,
    purpose,
    token_hash: hashToken(rawToken),
    expires_at: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
  });
  return { rawToken };
}

async function login({ email, password }, req) {
  const user = await models.User.findOne({ where: { email } });
  if (!user) throw new UnauthorizedError('Invalid email or password');
  if (user.status === 'SUSPENDED') throw new UnauthorizedError('This account has been suspended');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  await user.update({ last_login_at: new Date() });
  const session = await buildSession(user, req);
  return { user: await publicUser(user.id), ...session };
}

async function refresh({ refreshToken }, req) {
  if (!refreshToken) throw new UnauthorizedError('Refresh token is missing');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  if (payload.type !== 'refresh') throw new UnauthorizedError('Invalid token type');

  const tokenHash = hashToken(refreshToken);
  const stored = await models.RefreshToken.findOne({ where: { token_hash: tokenHash } });

  if (!stored) throw new UnauthorizedError('Refresh token is no longer valid');

  if (stored.revoked_at) {
    // token reuse: revoke the whole family as a precaution
    await models.RefreshToken.update(
      { revoked_at: new Date() },
      { where: { family_id: stored.family_id, revoked_at: null } }
    );
    throw new UnauthorizedError('Refresh token reuse detected, please sign in again');
  }

  if (stored.expires_at < new Date()) throw new UnauthorizedError('Refresh token expired');

  const user = await models.User.findByPk(payload.sub);
  if (!user || user.status === 'SUSPENDED') throw new UnauthorizedError('Account is not available');

  const newRefresh = signRefreshToken(user.id, stored.family_id);
  const accessToken = signAccessToken(user.id);

  await sequelize.transaction(async (transaction) => {
    const replacement = await models.RefreshToken.create(
      {
        user_id: user.id,
        family_id: stored.family_id,
        token_hash: hashToken(newRefresh),
        expires_at: new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000),
        user_agent: req?.headers?.['user-agent']?.slice(0, 255) || null,
        ip: req?.ip || null,
      },
      { transaction }
    );
    await stored.update({ revoked_at: new Date(), replaced_by_id: replacement.id }, { transaction });
  });

  return { accessToken, refreshToken: newRefresh };
}

async function logout({ refreshToken }) {
  if (!refreshToken) return { revoked: false };
  const stored = await models.RefreshToken.findOne({ where: { token_hash: hashToken(refreshToken) } });
  if (stored && !stored.revoked_at) {
    await stored.update({ revoked_at: new Date() });
  }
  return { revoked: Boolean(stored) };
}

async function verifyEmail({ token }) {
  const stored = await models.VerificationToken.findOne({
    where: { token_hash: hashToken(token), purpose: 'EMAIL_VERIFY' },
  });
  if (!stored || stored.used_at || stored.expires_at < new Date()) {
    throw new BusinessRuleError('Verification link is invalid or expired', 'INVALID_VERIFICATION_TOKEN');
  }
  await models.User.update({ email_verified_at: new Date(), status: 'ACTIVE' }, { where: { id: stored.user_id } });
  await stored.update({ used_at: new Date() });
  return { verified: true };
}

async function resendVerification(userId) {
  const user = await models.User.findByPk(userId);
  if (!user) throw new NotFoundError('User');
  if (user.email_verified_at) throw new BusinessRuleError('Email is already verified', 'ALREADY_VERIFIED');
  const token = await createVerificationToken(user.id, 'EMAIL_VERIFY', 24);
  await enqueue('notification.email', {
    to: user.email,
    subject: 'Your new POTHIK verification code',
    text: `Your verification token: ${token.rawToken}`,
  }).catch(() => {});
  return { sent: true, ...(config.isProd ? {} : { verificationToken: token.rawToken }) };
}

async function forgotPassword({ email }) {
  const user = await models.User.findOne({ where: { email } });
  // Do not reveal whether the account exists.
  if (!user) return { sent: true };
  const token = await createVerificationToken(user.id, 'PASSWORD_RESET', 1);
  await enqueue('notification.email', {
    to: user.email,
    subject: 'Reset your POTHIK password',
    text: `Use this token to reset your password: ${token.rawToken}`,
  }).catch(() => {});
  return { sent: true, ...(config.isProd ? {} : { resetToken: token.rawToken }) };
}

async function resetPassword({ token, password }) {
  const stored = await models.VerificationToken.findOne({
    where: { token_hash: hashToken(token), purpose: 'PASSWORD_RESET' },
  });
  if (!stored || stored.used_at || stored.expires_at < new Date()) {
    throw new BusinessRuleError('Password reset token is invalid or expired', 'INVALID_RESET_TOKEN');
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  await sequelize.transaction(async (transaction) => {
    await models.User.update({ password_hash: passwordHash }, { where: { id: stored.user_id }, transaction });
    await models.RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: stored.user_id, revoked_at: null }, transaction }
    );
    await stored.update({ used_at: new Date() }, { transaction });
  });
  return { reset: true };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await models.User.findByPk(userId);
  if (!user) throw new NotFoundError('User');
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new BusinessRuleError('Current password is incorrect', 'INVALID_PASSWORD');
  await user.update({ password_hash: await bcrypt.hash(newPassword, config.bcryptRounds) });
  return { updated: true };
}

async function publicUser(userId) {
  const user = await models.User.findByPk(userId, {
    attributes: ['id', 'name', 'email', 'phone', 'status', 'locale', 'avatar_url', 'email_verified_at', 'travel_preferences', 'created_at'],
    include: [
      { model: models.Role, as: 'roles', attributes: ['code'], through: { attributes: [] } },
      { model: models.ProviderProfile, as: 'providerProfile', attributes: ['id', 'type', 'status', 'business_name', 'commission_rate'] },
    ],
  });
  if (!user) throw new NotFoundError('User');
  const plain = user.get({ plain: true });
  return {
    ...plain,
    roles: plain.roles?.map((r) => r.code) || [],
    role: plain.roles?.[0]?.code || null,
  };
}

async function updateProfile(userId, payload) {
  const user = await models.User.findByPk(userId);
  if (!user) throw new NotFoundError('User');
  const allowed = {};
  for (const key of ['name', 'phone', 'locale', 'avatar_url', 'travel_preferences']) {
    if (payload[key] !== undefined) allowed[key] = payload[key];
  }
  await user.update(allowed);
  await invalidateUserContext(userId);
  return publicUser(userId);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  publicUser,
  updateProfile,
};
