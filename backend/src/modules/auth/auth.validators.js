'use strict';

const { z } = require('zod');
const { email, password, phone } = require('../../shared/validators/common');

const register = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  password,
  phone: phone.optional(),
  role: z.enum(['CUSTOMER', 'HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE']).optional().default('CUSTOMER'),
  businessName: z.string().trim().min(2).max(160).optional(),
  locale: z.enum(['en', 'bn']).optional(),
});

const login = z.object({
  email,
  password: z.string().min(1).max(72),
});

const refresh = z.object({
  refreshToken: z.string().min(10).optional(),
});

const tokenOnly = z.object({ token: z.string().min(10).max(200) });

const forgotPassword = z.object({ email });

const resetPassword = z.object({
  token: z.string().min(10).max(200),
  password,
});

const changePassword = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
});

const updateProfile = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional(),
  locale: z.enum(['en', 'bn']).optional(),
  avatar_url: z.string().max(500).optional(),
  travel_preferences: z.record(z.any()).optional(),
});

module.exports = {
  register,
  login,
  refresh,
  verifyEmail: tokenOnly,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
};
