'use strict';

const { Op } = require('sequelize');
const { models } = require('../../models');
const { NotFoundError, BusinessRuleError, ForbiddenError } = require('../../shared/errors');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');

const TARGET_MODELS = {
  PACKAGE: 'Package',
  HOTEL: 'Hotel',
  GUIDE: 'Guide',
  TRANSPORT: 'Vehicle',
  DESTINATION: 'Destination',
};

async function ratingsSummary(targetType, targetId, { limit = 5 } = {}) {
  const where = { target_type: targetType, target_id: targetId, status: 'APPROVED' };
  const [total, rows] = await Promise.all([
    models.Review.count({ where }),
    models.Review.findAll({
      where,
      include: [{ model: models.User, as: 'user', attributes: ['id', 'name', 'avatar_url'] }],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit,
    }),
  ]);
  const aggregate = await models.Review.findOne({
    where,
    attributes: [
      [models.Review.sequelize.fn('AVG', models.Review.sequelize.col('rating')), 'avg'],
    ],
    raw: true,
  });
  return {
    average: aggregate?.avg ? Number(Number(aggregate.avg).toFixed(2)) : 0,
    total,
    items: rows.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.created_at,
      verified: review.is_verified,
      providerReply: review.provider_reply,
      user: review.user ? { id: review.user.id, name: review.user.name, avatar: review.user.avatar_url } : null,
    })),
  };
}

async function reviewSummary(targetType, targetId) {
  const where = { target_type: targetType, target_id: targetId, status: 'APPROVED' };
  const [total, aggregate] = await Promise.all([
    models.Review.count({ where }),
    models.Review.findOne({
      where,
      attributes: [[models.Review.sequelize.fn('AVG', models.Review.sequelize.col('rating')), 'avg']],
      raw: true,
    }),
  ]);
  return {
    average: aggregate?.avg ? Number(Number(aggregate.avg).toFixed(2)) : 0,
    total,
  };
}

async function assertTargetBelongsToBooking(booking, targetType, targetId) {
  const items = await models.BookingItem.findAll({ where: { booking_id: booking.id } });
  if (!items.length) throw new BusinessRuleError('Booking has no services to review', 'NOTHING_TO_REVIEW');

  if (targetType === 'PACKAGE') {
    if (!items.some((item) => item.item_type === 'PACKAGE' && Number(item.ref_id) === Number(targetId))) {
      throw new ForbiddenError('You can only review services from this booking');
    }
    return;
  }
  if (targetType === 'GUIDE') {
    if (!items.some((item) => item.item_type === 'GUIDE' && Number(item.ref_id) === Number(targetId))) {
      throw new ForbiddenError('You can only review services from this booking');
    }
    return;
  }
  if (targetType === 'TRANSPORT') {
    if (!items.some((item) => item.item_type === 'VEHICLE' && Number(item.ref_id) === Number(targetId))) {
      throw new ForbiddenError('You can only review services from this booking');
    }
    return;
  }
  if (targetType === 'HOTEL') {
    const roomIds = items.filter((item) => item.item_type === 'HOTEL_ROOM').map((item) => item.ref_id);
    if (!roomIds.length) throw new ForbiddenError('You can only review services from this booking');
    const rooms = await models.HotelRoom.findAll({ where: { id: { [Op.in]: roomIds } }, attributes: ['hotel_id'] });
    if (!rooms.some((room) => Number(room.hotel_id) === Number(targetId))) {
      throw new ForbiddenError('You can only review services from this booking');
    }
    return;
  }
  if (targetType === 'DESTINATION') {
    const packageIds = items.filter((item) => item.item_type === 'PACKAGE').map((item) => item.ref_id);
    if (!packageIds.length) throw new ForbiddenError('You can only review destinations you visited on a package');
    const links = await models.PackageDestination.findAll({
      where: { package_id: { [Op.in]: packageIds }, destination_id: targetId },
    });
    if (!links.length) throw new ForbiddenError('You can only review destinations included in your booking');
  }
}

async function createReview(userId, payload) {
  const booking = await models.Booking.findOne({ where: { id: payload.bookingId, customer_user_id: userId } });
  if (!booking) throw new NotFoundError('Booking');
  if (booking.status !== 'COMPLETED') {
    throw new BusinessRuleError('Only completed bookings can be reviewed', 'BOOKING_NOT_COMPLETED');
  }
  const targetModel = TARGET_MODELS[payload.targetType];
  if (!targetModel) throw new BusinessRuleError('Unsupported review target', 'INVALID_TARGET');
  const target = await models[targetModel].findByPk(payload.targetId);
  if (!target) throw new NotFoundError('Review target');

  await assertTargetBelongsToBooking(booking, payload.targetType, payload.targetId);

  const existing = await models.Review.findOne({
    where: {
      booking_id: booking.id,
      user_id: userId,
      target_type: payload.targetType,
      target_id: payload.targetId,
    },
  });
  if (existing) throw new BusinessRuleError('You have already reviewed this service', 'REVIEW_EXISTS');

  return models.Review.create({
    booking_id: booking.id,
    user_id: userId,
    target_type: payload.targetType,
    target_id: payload.targetId,
    rating: payload.rating,
    title: payload.title || null,
    comment: payload.comment || null,
    status: 'PENDING',
    is_verified: true,
  });
}

async function listReviews(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 10 });
  const where = { status: 'APPROVED' };
  if (query.targetType) where.target_type = query.targetType;
  if (query.targetId) where.target_id = query.targetId;
  if (query.rating) where.rating = query.rating;
  const { rows, count } = await models.Review.findAndCountAll({
    where,
    include: [{ model: models.User, as: 'user', attributes: ['id', 'name', 'avatar_url'] }],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
  });
  return {
    items: rows,
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function moderateReview(adminId, reviewId, { status }) {
  const review = await models.Review.findByPk(reviewId);
  if (!review) throw new NotFoundError('Review');
  await review.update({
    status,
    moderated_by_user_id: adminId,
    moderated_at: new Date(),
  });
  await refreshTargetRating(review.target_type, review.target_id);
  return review;
}

async function refreshTargetRating(targetType, targetId) {
  const modelName = TARGET_MODELS[targetType];
  if (!modelName) return;
  const aggregate = await models.Review.findOne({
    where: { target_type: targetType, target_id: targetId, status: 'APPROVED' },
    attributes: [
      [models.Review.sequelize.fn('AVG', models.Review.sequelize.col('rating')), 'avg'],
      [models.Review.sequelize.fn('COUNT', models.Review.sequelize.col('id')), 'count'],
    ],
    raw: true,
  });
  const avg = aggregate?.avg ? Number(Number(aggregate.avg).toFixed(2)) : 0;
  const count = Number(aggregate?.count || 0);
  await models[modelName].update({ rating_avg: avg, rating_count: count }, { where: { id: targetId } });
  if (['PACKAGE', 'DESTINATION'].includes(targetType)) {
    // Lazy require: catalog.service depends on ratingsSummary from this module.
    const { invalidateCatalogCache } = require('../catalog/catalog.service');
    await invalidateCatalogCache();
  }
}

async function providerReply(user, reviewId, { reply }) {
  const review = await models.Review.findByPk(reviewId);
  if (!review) throw new NotFoundError('Review');
  if (!user.providerProfile) throw new ForbiddenError('Provider account required');
  const providerId = Number(user.providerProfile.id);

  let owns = false;
  if (review.target_type === 'HOTEL') {
    const hotel = await models.Hotel.findByPk(review.target_id);
    owns = hotel && Number(hotel.provider_profile_id) === providerId;
  } else if (review.target_type === 'GUIDE') {
    const guide = await models.Guide.findByPk(review.target_id);
    owns = guide && Number(guide.provider_profile_id) === providerId;
  } else if (review.target_type === 'TRANSPORT') {
    const vehicle = await models.Vehicle.findByPk(review.target_id);
    owns = vehicle && Number(vehicle.provider_profile_id) === providerId;
  }
  if (!owns) throw new ForbiddenError('This review is not about your service');

  await review.update({ provider_reply: reply, replied_at: new Date() });
  return review;
}

module.exports = {
  createReview,
  listReviews,
  moderateReview,
  providerReply,
  ratingsSummary,
  reviewSummary,
  refreshTargetRating,
  TARGET_MODELS,
};
