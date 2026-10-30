'use strict';

const express = require('express');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize, requireRoles } = require('../../shared/middleware/authorize');
const { writeLimiter } = require('../../shared/middleware/rateLimit');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');
const { PERMISSIONS, ROLES } = require('../../shared/constants/roles');
const validators = require('./admin.validators');
const service = require('./admin.service');

const router = express.Router();

router.use(authenticate, requireRoles(ROLES.ADMIN));

// ---------------------------------------------------------------- dashboard
router.get(
  '/stats',
  authorize(PERMISSIONS.DASHBOARD_ADMIN),
  asyncHandler(async (req, res) => success(res, { message: 'Admin statistics retrieved', data: await require('../dashboards/dashboard.service').adminDashboard() }))
);

// -------------------------------------------------------------------- users
router.get(
  '/users',
  authorize(PERMISSIONS.USERS_READ),
  validate({ query: validators.userListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Users retrieved', data: await service.listUsers(req.validatedQuery) }))
);

router.get(
  '/users/:id',
  authorize(PERMISSIONS.USERS_READ),
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'User retrieved', data: await service.getUser(req.params.id) }))
);

router.patch(
  '/users/:id/status',
  authorize(PERMISSIONS.USERS_MANAGE),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.userStatusBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'User status updated', data: await service.setUserStatus(req.user, req, req.params.id, req.body) })
  )
);

router.put(
  '/users/:id/roles',
  authorize(PERMISSIONS.ROLES_MANAGE),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.userRolesBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'User roles updated', data: await service.setUserRoles(req.user, req, req.params.id, req.body) })
  )
);

// ---------------------------------------------------------------- providers
router.get(
  '/providers',
  authorize(PERMISSIONS.PROVIDERS_READ),
  validate({ query: validators.providerListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Providers retrieved', data: await service.listProviders(req.validatedQuery) }))
);

router.get(
  '/providers/:id',
  authorize(PERMISSIONS.PROVIDERS_READ),
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Provider retrieved', data: await service.getProvider(req.params.id) }))
);

for (const action of ['approve', 'reject', 'suspend']) {
  router.post(
    `/providers/:id/${action}`,
    authorize(PERMISSIONS.PROVIDERS_APPROVE),
    writeLimiter,
    validate({ params: validators.idParam, body: validators.providerDecisionBody }),
    asyncHandler(async (req, res) =>
      success(res, {
        message: `Provider ${action === 'approve' ? 'approved' : `${action}ed`}`,
        data: await service.decideProvider(req.user, req, req.params.id, action, req.body),
      })
    )
  );
}

router.patch(
  '/providers/:id/documents/:documentId',
  authorize(PERMISSIONS.PROVIDERS_APPROVE),
  writeLimiter,
  validate({ params: validators.documentParams, body: validators.documentDecisionBody }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Provider document reviewed',
      data: await service.reviewDocument(req.user, req, req.params.id, req.params.documentId, req.body),
    })
  )
);

// ----------------------------------------------------------------- bookings
router.get(
  '/bookings',
  authorize(PERMISSIONS.BOOKINGS_MANAGE_ALL),
  validate({ query: validators.bookingListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Bookings retrieved', data: await service.listBookings(req.validatedQuery) }))
);

router.get(
  '/bookings/:reference',
  authorize(PERMISSIONS.BOOKINGS_MANAGE_ALL),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Booking retrieved', data: await service.getBooking(req.user, req.params.reference) })
  )
);

// ------------------------------------------------------------------ coupons
router.get(
  '/coupons',
  authorize(PERMISSIONS.COUPONS_MANAGE),
  validate({ query: validators.adminListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Coupons retrieved', data: await service.listCoupons(req.validatedQuery) }))
);

router.post(
  '/coupons',
  authorize(PERMISSIONS.COUPONS_MANAGE),
  writeLimiter,
  validate({ body: validators.couponBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Coupon created', data: await service.createCoupon(req, req.body) }))
);

router.patch(
  '/coupons/:id',
  authorize(PERMISSIONS.COUPONS_MANAGE),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.couponUpdateBody }),
  asyncHandler(async (req, res) => success(res, { message: 'Coupon updated', data: await service.updateCoupon(req, req.params.id, req.body) }))
);

router.delete(
  '/coupons/:id',
  authorize(PERMISSIONS.COUPONS_MANAGE),
  writeLimiter,
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Coupon deactivated', data: await service.deactivateCoupon(req, req.params.id) }))
);

// ------------------------------------------------------------------ reviews
router.get(
  '/reviews',
  authorize(PERMISSIONS.REVIEWS_MODERATE),
  validate({ query: validators.reviewListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Reviews retrieved', data: await service.listReviewsAdmin(req.validatedQuery) }))
);

router.post(
  '/reviews/:id/moderate',
  authorize(PERMISSIONS.REVIEWS_MODERATE),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.reviewDecisionBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Review moderated', data: await service.decideReview(req.user, req, req.params.id, req.body) })
  )
);

// -------------------------------------------------------------------- blogs
router.get(
  '/blogs',
  authorize(PERMISSIONS.BLOGS_MANAGE),
  validate({ query: validators.adminListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Blog posts retrieved', data: await service.listBlogs(req.validatedQuery) }))
);

router.post(
  '/blogs',
  authorize(PERMISSIONS.BLOGS_MANAGE),
  writeLimiter,
  validate({ body: validators.blogBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Blog post created', data: await service.createBlog(req, req.body) }))
);

router.patch(
  '/blogs/:id',
  authorize(PERMISSIONS.BLOGS_MANAGE),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.blogUpdateBody }),
  asyncHandler(async (req, res) => success(res, { message: 'Blog post updated', data: await service.updateBlog(req, req.params.id, req.body) }))
);

router.delete(
  '/blogs/:id',
  authorize(PERMISSIONS.BLOGS_MANAGE),
  writeLimiter,
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Blog post archived', data: await service.archiveBlog(req, req.params.id) }))
);

// --------------------------------------------------------------- audit logs
router.get(
  '/audit-logs',
  authorize(PERMISSIONS.AUDIT_READ),
  validate({ query: validators.auditListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Audit logs retrieved', data: await service.listAuditLogs(req.validatedQuery) }))
);

module.exports = router;
