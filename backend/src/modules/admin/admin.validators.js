'use strict';

const { z } = require('zod');
const { paginationQuery, idParam, dateString, money } = require('../../shared/validators/common');
const { ROLES } = require('../../shared/constants/roles');

const roleCodes = Object.values(ROLES);
const userStatuses = ['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED'];
const providerStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
const providerTypes = ['HOTEL', 'TRANSPORT', 'GUIDE'];

const userListQuery = paginationQuery.extend({
  role: z.enum(roleCodes).optional(),
  status: z.enum(userStatuses).optional(),
});

const userStatusBody = z.object({
  status: z.enum(userStatuses),
  reason: z.string().trim().max(500).optional(),
});

const userRolesBody = z.object({ roles: z.array(z.enum(roleCodes)).min(1).max(5) });

const providerListQuery = paginationQuery.extend({
  type: z.enum(providerTypes).optional(),
  status: z.enum(providerStatuses).optional(),
});

const providerDecisionBody = z.object({
  reason: z.string().trim().max(500).optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
});

const documentDecisionBody = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().trim().max(500).optional(),
});

const documentParams = z.object({ id: z.coerce.number().int().positive(), documentId: z.coerce.number().int().positive() });

const bookingListQuery = paginationQuery.extend({
  status: z
    .enum([
      'PENDING',
      'AWAITING_CONFIRMATION',
      'QUOTED',
      'AWAITING_PAYMENT',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'REJECTED',
      'CANCELLED',
      'REFUND_PENDING',
      'REFUNDED',
    ])
    .optional(),
  type: z.enum(['PACKAGE', 'CUSTOM_TRIP', 'HOTEL', 'TRANSPORT', 'GUIDE']).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

const couponBody = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().max(255).optional(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: money.refine((value) => value > 0, 'Value must be positive'),
  minSpend: money.optional().default(0),
  maxDiscount: money.optional(),
  usageLimit: z.coerce.number().int().positive().max(1000000).optional(),
  perUserLimit: z.coerce.number().int().positive().max(100).optional().default(1),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isActive: z.boolean().optional().default(true),
});

const couponUpdateBody = couponBody.partial();

const reviewListQuery = paginationQuery.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  targetType: z.enum(['HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION']).optional(),
  targetId: z.coerce.number().int().positive().optional(),
});

const reviewDecisionBody = z.object({ status: z.enum(['APPROVED', 'REJECTED']) });

const blogBody = z.object({
  slug: z.string().trim().max(200).optional(),
  title: z.string().trim().min(3).max(220),
  titleBn: z.string().trim().max(220).optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().max(50000).optional(),
  coverImage: z.string().trim().max(500).optional(),
  authorName: z.string().trim().max(120).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
  publishedAt: z.coerce.date().optional(),
});

const blogUpdateBody = blogBody.partial();

const auditListQuery = paginationQuery.extend({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(60).optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

module.exports = {
  idParam,
  userListQuery,
  userStatusBody,
  userRolesBody,
  providerListQuery,
  providerDecisionBody,
  documentDecisionBody,
  documentParams,
  bookingListQuery,
  couponBody,
  couponUpdateBody,
  reviewListQuery,
  reviewDecisionBody,
  blogBody,
  blogUpdateBody,
  auditListQuery,
};
