'use strict';

const { Op } = require('sequelize');
const { models, sequelize } = require('../../models');
const { NotFoundError, ForbiddenError, BusinessRuleError, ConflictError } = require('../../shared/errors');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');
const { toAmount } = require('../../shared/utils/money');
const { uniqueSlug } = require('../../shared/utils/slugify');
const { invalidateUserContext } = require('../../shared/services/userContext.service');
const bookingService = require('../bookings/booking.service');
const bookingRepository = require('../bookings/booking.repository');
const reviewService = require('../reviews/review.service');
const notifications = require('../notifications/notification.service');
const logger = require('../../config/logger');

// -------------------------------------------------------------------- audit

async function recordAudit(req, action, entityType, entityId, metadata = null) {
  try {
    await models.AuditLog.create({
      actor_user_id: req.user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId === undefined || entityId === null ? null : String(entityId),
      metadata,
      ip: req.ip || null,
      request_id: req.id ? String(req.id) : null,
    });
  } catch (err) {
    logger.error({ err: err.message, action }, 'audit log write failed');
  }
}

// -------------------------------------------------------------------- users

function serializeUser(user) {
  const plain = user.get ? user.get({ plain: true }) : user;
  return {
    id: plain.id,
    name: plain.name,
    email: plain.email,
    phone: plain.phone,
    status: plain.status,
    locale: plain.locale,
    roles: (plain.roles || []).map((role) => role.code),
    emailVerifiedAt: plain.email_verified_at,
    lastLoginAt: plain.last_login_at,
    providerProfile: plain.providerProfile
      ? { id: plain.providerProfile.id, type: plain.providerProfile.type, status: plain.providerProfile.status, businessName: plain.providerProfile.business_name }
      : null,
    createdAt: plain.created_at,
  };
}

async function listUsers(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const where = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${query.search}%` } },
      { email: { [Op.like]: `%${query.search}%` } },
      { phone: { [Op.like]: `%${query.search}%` } },
    ];
  }

  const roleInclude = { model: models.Role, as: 'roles', attributes: ['code'] };
  if (query.role) Object.assign(roleInclude, { where: { code: query.role }, required: true });
  const { rows, count } = await models.User.findAndCountAll({
    where,
    include: [
      roleInclude,
      { model: models.ProviderProfile, as: 'providerProfile', attributes: ['id', 'type', 'status', 'business_name'], required: false },
    ],
    order: [['id', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { items: rows.map(serializeUser), meta: buildMeta({ page, limit, total: count }) };
}

async function getUser(id) {
  const user = await models.User.findByPk(id, {
    include: [
      { model: models.Role, as: 'roles', attributes: ['code'] },
      { model: models.ProviderProfile, as: 'providerProfile', attributes: ['id', 'type', 'status', 'business_name'] },
    ],
  });
  if (!user) throw new NotFoundError('User');
  return serializeUser(user);
}

async function setUserStatus(admin, req, id, { status, reason }) {
  if (Number(admin.id) === Number(id)) throw new BusinessRuleError('You cannot change your own account status', 'SELF_STATUS_CHANGE');
  const user = await models.User.findByPk(id, { include: [{ model: models.ProviderProfile, as: 'providerProfile' }] });
  if (!user) throw new NotFoundError('User');

  await sequelize.transaction(async (transaction) => {
    await user.update({ status }, { transaction });
    if (user.providerProfile) {
      // Reactivation never restores approval - provider approval stays an explicit admin decision.
      const profileStatus =
        status === 'SUSPENDED' ? 'SUSPENDED' : status === 'ACTIVE' && user.providerProfile.status === 'SUSPENDED' ? 'PENDING' : null;
      if (profileStatus) await user.providerProfile.update({ status: profileStatus, rejection_reason: reason || null }, { transaction });
    }
  });

  await invalidateUserContext(id);
  await recordAudit(req, `user.${status.toLowerCase()}`, 'user', id, { reason: reason || null });
  return getUser(id);
}

async function setUserRoles(admin, req, id, { roles }) {
  if (Number(admin.id) === Number(id) && !roles.includes('ADMIN')) {
    throw new BusinessRuleError('You cannot remove your own administrator role', 'SELF_ROLE_CHANGE');
  }
  const user = await models.User.findByPk(id);
  if (!user) throw new NotFoundError('User');

  const roleRows = await models.Role.findAll({ where: { code: { [Op.in]: roles } } });
  if (roleRows.length !== new Set(roles).size) throw new NotFoundError('Role');

  await sequelize.transaction(async (transaction) => {
    await models.UserRole.destroy({ where: { user_id: user.id }, transaction });
    await models.UserRole.bulkCreate(
      roleRows.map((role) => ({ user_id: user.id, role_id: role.id, assigned_by_user_id: admin.id })),
      { transaction }
    );
  });

  await invalidateUserContext(id);
  await recordAudit(req, 'user.roles_updated', 'user', id, { roles });
  return getUser(id);
}

// ---------------------------------------------------------------- providers

function serializeProvider(profile) {
  const plain = profile.get ? profile.get({ plain: true }) : profile;
  return {
    id: plain.id,
    type: plain.type,
    status: plain.status,
    businessName: plain.business_name,
    description: plain.description,
    phone: plain.phone,
    address: plain.address,
    logoUrl: plain.logo_url,
    commissionRate: plain.commission_rate ? Number(plain.commission_rate) : null,
    rejectionReason: plain.rejection_reason,
    approvedAt: plain.approved_at,
    createdAt: plain.created_at,
    user: plain.user ? { id: plain.user.id, name: plain.user.name, email: plain.user.email, phone: plain.user.phone, status: plain.user.status } : null,
    documents: (plain.documents || []).map((document) => ({
      id: document.id,
      type: document.type,
      fileUrl: document.file_url,
      status: document.status,
      notes: document.notes,
      reviewedAt: document.reviewed_at,
    })),
  };
}

async function listProviders(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const where = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.search) where.business_name = { [Op.like]: `%${query.search}%` };

  const { rows, count } = await models.ProviderProfile.findAndCountAll({
    where,
    include: [
      { model: models.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status'] },
      { model: models.ProviderDocument, as: 'documents', required: false },
    ],
    order: [['id', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { items: rows.map(serializeProvider), meta: buildMeta({ page, limit, total: count }) };
}

async function getProvider(id) {
  const profile = await models.ProviderProfile.findByPk(id, {
    include: [
      { model: models.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status'] },
      { model: models.ProviderDocument, as: 'documents', required: false },
    ],
  });
  if (!profile) throw new NotFoundError('Provider');
  return serializeProvider(profile);
}

async function decideProvider(admin, req, id, action, { reason, commissionRate } = {}) {
  const profile = await models.ProviderProfile.findByPk(id, {
    include: [{ model: models.User, as: 'user', attributes: ['id', 'name', 'email'] }],
  });
  if (!profile) throw new NotFoundError('Provider');

  const map = { approve: 'APPROVED', reject: 'REJECTED', suspend: 'SUSPENDED' };
  const status = map[action];
  if (!status) throw new BusinessRuleError('Unknown provider action', 'INVALID_PROVIDER_ACTION');
  if (profile.status === status) throw new ConflictError(`Provider is already ${status.toLowerCase()}`);

  const updates = { status, rejection_reason: action === 'approve' ? null : reason || null };
  if (action === 'approve') {
    updates.approved_at = new Date();
    updates.approved_by_user_id = admin.id;
    if (commissionRate !== undefined) updates.commission_rate = toAmount(commissionRate);
  }
  await profile.update(updates);
  await invalidateUserContext(profile.user_id);

  await recordAudit(req, `provider.${action}`, 'provider_profile', profile.id, { reason: reason || null });
  try {
    await notifications.notify(profile.user_id, {
      type: 'PROVIDER_STATUS',
      title: `Provider account ${status.toLowerCase()}`,
      body:
        action === 'approve'
          ? 'Your business is approved. You can now publish inventory and receive bookings.'
          : reason || `Your provider account is now ${status.toLowerCase()}.`,
      channel: 'BOTH',
    });
  } catch (err) {
    logger.error({ err: err.message, providerId: profile.id }, 'provider decision notification failed');
  }

  return getProvider(profile.id);
}

async function reviewDocument(admin, req, providerId, documentId, { status, notes }) {
  const document = await models.ProviderDocument.findOne({ where: { id: documentId, provider_profile_id: providerId } });
  if (!document) throw new NotFoundError('Provider document');

  await document.update({
    status,
    notes: notes || null,
    reviewed_by_user_id: admin.id,
    reviewed_at: new Date(),
  });
  await recordAudit(req, 'provider.document_reviewed', 'provider_document', document.id, { status });
  return serializeProvider(await models.ProviderProfile.findByPk(providerId, {
    include: [
      { model: models.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status'] },
      { model: models.ProviderDocument, as: 'documents', required: false },
    ],
  }));
}

// ----------------------------------------------------------------- bookings

async function listBookings(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 25, maxLimit: 100 });
  const { rows, count } = await bookingRepository.listAll({
    status: query.status,
    type: query.type,
    search: query.search,
    from: query.from,
    to: query.to,
    limit,
    offset,
  });
  return { items: rows.map((row) => bookingService.serializeBookingSummary(row)), meta: buildMeta({ page, limit, total: count }) };
}

async function getBooking(admin, reference) {
  return bookingService.getBookingForUser(admin, reference);
}

// ------------------------------------------------------------------ coupons

function serializeCoupon(coupon) {
  const plain = coupon.get ? coupon.get({ plain: true }) : coupon;
  return {
    id: plain.id,
    code: plain.code,
    description: plain.description,
    type: plain.type,
    value: toAmount(plain.value),
    minSpend: toAmount(plain.min_spend),
    maxDiscount: plain.max_discount === null ? null : toAmount(plain.max_discount),
    usageLimit: plain.usage_limit,
    perUserLimit: plain.per_user_limit,
    usedCount: plain.used_count,
    startsAt: plain.starts_at,
    endsAt: plain.ends_at,
    isActive: plain.is_active,
    createdAt: plain.created_at,
  };
}

async function listCoupons(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const where = {};
  if (query.search) where.code = { [Op.like]: `%${String(query.search).toUpperCase()}%` };
  const { rows, count } = await models.Coupon.findAndCountAll({ where, order: [['id', 'DESC']], limit, offset });
  return { items: rows.map(serializeCoupon), meta: buildMeta({ page, limit, total: count }) };
}

async function createCoupon(req, payload) {
  const existing = await models.Coupon.findOne({ where: { code: payload.code } });
  if (existing) throw new ConflictError('A coupon with this code already exists');
  if (payload.endsAt && payload.startsAt && payload.endsAt <= payload.startsAt) {
    throw new BusinessRuleError('Coupon end date must be after the start date', 'INVALID_COUPON_WINDOW');
  }

  const coupon = await models.Coupon.create({
    code: payload.code,
    description: payload.description || null,
    type: payload.type,
    value: toAmount(payload.value),
    min_spend: toAmount(payload.minSpend || 0),
    max_discount: payload.maxDiscount === undefined ? null : toAmount(payload.maxDiscount),
    usage_limit: payload.usageLimit || null,
    per_user_limit: payload.perUserLimit || 1,
    starts_at: payload.startsAt || null,
    ends_at: payload.endsAt || null,
    is_active: payload.isActive !== false,
  });
  await recordAudit(req, 'coupon.created', 'coupon', coupon.id, { code: coupon.code });
  return serializeCoupon(coupon);
}

async function updateCoupon(req, id, payload) {
  const coupon = await models.Coupon.findByPk(id);
  if (!coupon) throw new NotFoundError('Coupon');
  if (payload.code && payload.code !== coupon.code) {
    const duplicate = await models.Coupon.findOne({ where: { code: payload.code, id: { [Op.ne]: coupon.id } } });
    if (duplicate) throw new ConflictError('A coupon with this code already exists');
  }

  const map = {
    code: payload.code,
    description: payload.description,
    type: payload.type,
    value: payload.value === undefined ? undefined : toAmount(payload.value),
    min_spend: payload.minSpend === undefined ? undefined : toAmount(payload.minSpend),
    max_discount: payload.maxDiscount === undefined ? undefined : payload.maxDiscount === null ? null : toAmount(payload.maxDiscount),
    usage_limit: payload.usageLimit,
    per_user_limit: payload.perUserLimit,
    starts_at: payload.startsAt,
    ends_at: payload.endsAt,
    is_active: payload.isActive,
  };
  const updates = Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined));
  await coupon.update(updates);
  await recordAudit(req, 'coupon.updated', 'coupon', coupon.id, { fields: Object.keys(updates) });
  return serializeCoupon(coupon);
}

async function deactivateCoupon(req, id) {
  const coupon = await models.Coupon.findByPk(id);
  if (!coupon) throw new NotFoundError('Coupon');
  await coupon.update({ is_active: false });
  await recordAudit(req, 'coupon.deactivated', 'coupon', coupon.id);
  return serializeCoupon(coupon);
}

// ------------------------------------------------------------------ reviews

async function listReviewsAdmin(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const where = {};
  if (query.status) where.status = query.status;
  if (query.targetType) where.target_type = query.targetType;
  if (query.targetId) where.target_id = query.targetId;

  const { rows, count } = await models.Review.findAndCountAll({
    where,
    include: [
      { model: models.User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: models.Booking, as: 'booking', attributes: ['id', 'reference'] },
    ],
    order: [['id', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return { items: rows, meta: buildMeta({ page, limit, total: count }) };
}

async function decideReview(admin, req, id, { status }) {
  const review = await reviewService.moderateReview(admin.id, id, { status });
  await recordAudit(req, `review.${status.toLowerCase()}`, 'review', review.id);
  return review;
}

// -------------------------------------------------------------------- blogs

function serializeBlog(blog) {
  const plain = blog.get ? blog.get({ plain: true }) : blog;
  return {
    id: plain.id,
    slug: plain.slug,
    title: plain.title,
    titleBn: plain.title_bn,
    excerpt: plain.excerpt,
    content: plain.content,
    coverImage: plain.cover_image,
    authorName: plain.author_name,
    status: plain.status,
    publishedAt: plain.published_at,
    createdAt: plain.created_at,
    updatedAt: plain.updated_at,
  };
}

async function listBlogs(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const where = {};
  if (query.status) where.status = query.status;
  if (query.search) where.title = { [Op.like]: `%${query.search}%` };
  const { rows, count } = await models.Blog.findAndCountAll({ where, order: [['id', 'DESC']], limit, offset });
  return { items: rows.map(serializeBlog), meta: buildMeta({ page, limit, total: count }) };
}

async function createBlog(req, payload) {
  const slug =
    payload.slug ||
    (await uniqueSlug(payload.title, async (candidate) => Boolean(await models.Blog.findOne({ where: { slug: candidate } }))));
  const blog = await models.Blog.create({
    slug,
    title: payload.title,
    title_bn: payload.titleBn || null,
    excerpt: payload.excerpt || null,
    content: payload.content || null,
    cover_image: payload.coverImage || null,
    author_name: payload.authorName || req.user.name,
    status: payload.status,
    published_at: payload.status === 'PUBLISHED' ? payload.publishedAt || new Date() : payload.publishedAt || null,
  });
  await recordAudit(req, 'blog.created', 'blog', blog.id, { slug });
  return serializeBlog(blog);
}

async function updateBlog(req, id, payload) {
  const blog = await models.Blog.findByPk(id);
  if (!blog) throw new NotFoundError('Blog');

  const updates = {};
  const map = {
    title: payload.title,
    title_bn: payload.titleBn,
    excerpt: payload.excerpt,
    content: payload.content,
    cover_image: payload.coverImage,
    author_name: payload.authorName,
    status: payload.status,
  };
  for (const [field, value] of Object.entries(map)) if (value !== undefined) updates[field] = value;

  if (payload.slug && payload.slug !== blog.slug) {
    const duplicate = await models.Blog.findOne({ where: { slug: payload.slug, id: { [Op.ne]: blog.id } } });
    if (duplicate) throw new ConflictError('A blog post with this slug already exists');
    updates.slug = payload.slug;
  }
  if (payload.status === 'PUBLISHED' && !blog.published_at) updates.published_at = payload.publishedAt || new Date();
  if (payload.publishedAt !== undefined) updates.published_at = payload.publishedAt;

  await blog.update(updates);
  await recordAudit(req, 'blog.updated', 'blog', blog.id, { fields: Object.keys(updates) });
  return serializeBlog(blog);
}

async function archiveBlog(req, id) {
  const blog = await models.Blog.findByPk(id);
  if (!blog) throw new NotFoundError('Blog');
  await blog.update({ status: 'DRAFT' });
  await recordAudit(req, 'blog.archived', 'blog', blog.id);
  return serializeBlog(blog);
}

// ---------------------------------------------------------------- audit logs

async function listAuditLogs(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 30, maxLimit: 100 });
  const where = {};
  if (query.action) where.action = { [Op.like]: `%${query.action}%` };
  if (query.entityType) where.entity_type = query.entityType;
  if (query.actorUserId) where.actor_user_id = query.actorUserId;
  if (query.from || query.to) {
    where.created_at = {};
    if (query.from) where.created_at[Op.gte] = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) where.created_at[Op.lte] = new Date(`${query.to}T23:59:59.999Z`);
  }

  const { rows, count } = await models.AuditLog.findAndCountAll({
    where,
    include: [{ model: models.User, as: 'actor', attributes: ['id', 'name', 'email'], required: false }],
    order: [['id', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return {
    items: rows.map((row) => {
      const plain = row.get({ plain: true });
      return {
        id: plain.id,
        action: plain.action,
        entityType: plain.entity_type,
        entityId: plain.entity_id,
        metadata: plain.metadata,
        ip: plain.ip,
        requestId: plain.request_id,
        actor: plain.actor ? { id: plain.actor.id, name: plain.actor.name, email: plain.actor.email } : null,
        createdAt: plain.created_at,
      };
    }),
    meta: buildMeta({ page, limit, total: count }),
  };
}

module.exports = {
  recordAudit,
  listUsers,
  getUser,
  setUserStatus,
  setUserRoles,
  listProviders,
  getProvider,
  decideProvider,
  reviewDocument,
  listBookings,
  getBooking,
  listCoupons,
  createCoupon,
  updateCoupon,
  deactivateCoupon,
  listReviewsAdmin,
  decideReview,
  listBlogs,
  createBlog,
  updateBlog,
  archiveBlog,
  listAuditLogs,
};
