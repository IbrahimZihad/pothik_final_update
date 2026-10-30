'use strict';

const config = require('../../config');
const service = require('./auth.service');
const { success, created } = require('../../shared/responses');
const { asyncHandler } = require('../../shared/utils/asyncHandler');

const REFRESH_COOKIE = 'pothik_refresh';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

function tokenFrom(req) {
  return req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE];
}

const register = asyncHandler(async (req, res) => {
  const result = await service.register(req.body, req);
  setRefreshCookie(res, result.refreshToken);
  return created(res, { message: 'Account created successfully', data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body, req);
  setRefreshCookie(res, result.refreshToken);
  return success(res, { message: 'Signed in successfully', data: result });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await service.refresh({ refreshToken: tokenFrom(req) }, req);
  setRefreshCookie(res, result.refreshToken);
  return success(res, { message: 'Session refreshed', data: result });
});

const logout = asyncHandler(async (req, res) => {
  const result = await service.logout({ refreshToken: tokenFrom(req) });
  clearRefreshCookie(res);
  return success(res, { message: 'Signed out', data: result });
});

const me = asyncHandler(async (req, res) =>
  success(res, { message: 'Profile retrieved', data: await service.publicUser(req.user.id) })
);

const updateMe = asyncHandler(async (req, res) =>
  success(res, { message: 'Profile updated', data: await service.updateProfile(req.user.id, req.body) })
);

const verifyEmail = asyncHandler(async (req, res) =>
  success(res, { message: 'Email verified', data: await service.verifyEmail(req.body) })
);

const resendVerification = asyncHandler(async (req, res) =>
  success(res, { message: 'Verification email sent', data: await service.resendVerification(req.user.id) })
);

const forgotPassword = asyncHandler(async (req, res) =>
  success(res, { message: 'If the account exists, a reset token has been sent', data: await service.forgotPassword(req.body) })
);

const resetPassword = asyncHandler(async (req, res) =>
  success(res, { message: 'Password reset successfully', data: await service.resetPassword(req.body) })
);

const changePassword = asyncHandler(async (req, res) =>
  success(res, { message: 'Password changed', data: await service.changePassword(req.user.id, req.body) })
);

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  updateMe,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
};
