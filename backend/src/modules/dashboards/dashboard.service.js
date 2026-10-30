'use strict';

const { Op, fn, col } = require('sequelize');
const { models } = require('../../models');
const paymentRepository = require('../payments/payment.repository');
const bookingService = require('../bookings/booking.service');
const { ForbiddenError } = require('../../shared/errors');
const { toAmount } = require('../../shared/utils/money');
const { today } = require('../../shared/utils/dates');

const REVENUE_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastMonths(count = 6) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

function fillSeries(keys) {
  return keys.map((month) => ({ month, amount: '0.00', bookings: 0 }));
}

async function adminDashboard() {
  const months = lastMonths(6);
  const since = new Date(`${months[0]}-01T00:00:00.000Z`);

  const [statusGroups, roleGroups, pendingProviders, totalProviders, pendingReviews, refundsRequested, recentBookings, paidBookings, commissionGroups, topCommissionRows] =
    await Promise.all([
      models.Booking.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      models.UserRole.findAll({
        include: [{ model: models.Role, as: 'role', attributes: [] }],
        attributes: [[fn('COUNT', col('UserRole.user_id')), 'count']],
        group: ['role.code'],
        raw: true,
      }),
      models.ProviderProfile.count({ where: { status: 'PENDING' } }),
      models.ProviderProfile.count(),
      models.Review.count({ where: { status: 'PENDING' } }),
      models.Refund.count({ where: { status: 'REQUESTED' } }),
      models.Booking.findAll({
        include: [{ model: models.User, as: 'customer', attributes: ['id', 'name', 'email'] }],
        order: [['id', 'DESC']],
        limit: 6,
      }),
      models.Booking.findAll({
        where: { status: { [Op.in]: REVENUE_STATUSES }, created_at: { [Op.gte]: since } },
        attributes: ['created_at', 'paid_amount'],
        raw: true,
      }),
      models.Commission.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
        group: ['status'],
        raw: true,
      }),
      models.Commission.findAll({
        where: { status: { [Op.in]: ['EARNED', 'PAID'] } },
        attributes: ['provider_profile_id', [fn('SUM', col('amount')), 'total']],
        group: ['provider_profile_id'],
        order: [[fn('SUM', col('amount')), 'DESC']],
        limit: 5,
        raw: true,
      }),
    ]);

  const series = fillSeries(months);
  for (const booking of paidBookings) {
    const key = monthKey(booking.created_at);
    const row = series.find((entry) => entry.month === key);
    if (row) {
      row.amount = toAmount(Number(row.amount) + Number(booking.paid_amount));
      row.bookings += 1;
    }
  }

  const providerNames = await models.ProviderProfile.findAll({
    where: { id: { [Op.in]: topCommissionRows.map((row) => row.provider_profile_id).filter(Boolean) } },
    attributes: ['id', 'business_name', 'type'],
    raw: true,
  });
  const nameById = new Map(providerNames.map((p) => [Number(p.id), p]));

  let roleCounts = {};
  try {
    const [roles] = await Promise.all([roleGroups]);
    roleCounts = Object.fromEntries(roles.map((row) => [row['role.code'], Number(row.count)]));
  } catch (err) {
    roleCounts = {};
  }

  const totalBookings = statusGroups.reduce((sum, row) => sum + Number(row.count), 0);
  const revenue = paidBookings.reduce((sum, row) => sum + Number(row.paid_amount), 0);

  return {
    users: {
      total: await models.User.count(),
      byRole: roleCounts,
    },
    bookings: {
      total: totalBookings,
      byStatus: Object.fromEntries(statusGroups.map((row) => [row.status, Number(row.count)])),
      recent: recentBookings.map((row) => bookingService.serializeBookingSummary(row)),
    },
    revenue: {
      last6Months: toAmount(revenue),
      series,
    },
    providers: { total: totalProviders, pendingApproval: pendingProviders },
    moderation: { pendingReviews, refundsRequested },
    commissions: {
      byStatus: commissionGroups.map((row) => ({ status: row.status, count: Number(row.count), total: toAmount(row.total) })),
      topProviders: topCommissionRows.map((row) => ({
        providerProfileId: row.provider_profile_id,
        businessName: nameById.get(Number(row.provider_profile_id))?.business_name || 'Unknown provider',
        type: nameById.get(Number(row.provider_profile_id))?.type || null,
        commission: toAmount(row.total),
      })),
    },
  };
}

async function providerDashboard(user) {
  const profile = user.providerProfile;
  if (!profile) throw new ForbiddenError('Provider account required');

  const months = lastMonths(6);
  const since = new Date(`${months[0]}-01T00:00:00.000Z`);
  const startDate = today();

  const items = await models.BookingItem.findAll({ where: { provider_profile_id: profile.id }, attributes: ['booking_id', 'id'] });
  const bookingIds = [...new Set(items.map((item) => Number(item.booking_id)))];

  const [statusGroups, upcoming, upcomingCount, recentItems, earned, pendingAcceptance, requested, approved, paidPayouts, commissionGroups] = await Promise.all([
    bookingIds.length
      ? models.Booking.findAll({
          where: { id: { [Op.in]: bookingIds } },
          attributes: ['status', [fn('COUNT', col('id')), 'count']],
          group: ['status'],
          raw: true,
        })
      : [],
    bookingIds.length
      ? models.Booking.findAll({
          // AWAITING_PAYMENT means every provider accepted and only the traveller's
          // payment is outstanding, so the trip is still upcoming for the provider.
          where: { id: { [Op.in]: bookingIds }, status: { [Op.in]: ['AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] }, start_date: { [Op.gte]: startDate } },
          include: [
            { model: models.BookingItem, as: 'items', where: { provider_profile_id: profile.id }, required: true },
            { model: models.User, as: 'customer', attributes: ['id', 'name', 'phone'] },
          ],
          order: [['start_date', 'ASC']],
          limit: 5,
        })
      : [],
    bookingIds.length
      ? models.Booking.count({
          // The list above is capped at five; the stat card needs the real total.
          where: { id: { [Op.in]: bookingIds }, status: { [Op.in]: ['AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] }, start_date: { [Op.gte]: startDate } },
        })
      : 0,
    bookingIds.length
      ? models.Booking.findAll({
          where: { id: { [Op.in]: bookingIds } },
          include: [
            { model: models.BookingItem, as: 'items', where: { provider_profile_id: profile.id }, required: true },
            { model: models.User, as: 'customer', attributes: ['id', 'name', 'email'] },
          ],
          order: [['id', 'DESC']],
          limit: 6,
        })
      : [],
    paymentRepository.providerEarned(profile.id),
    bookingIds.length
      ? models.BookingItem.count({
          // One card per booking, and only while the booking still waits on providers:
          // stale PENDING items on cancelled/paid bookings must not inflate the count.
          where: { provider_profile_id: profile.id, status: 'PENDING' },
          include: [{ model: models.Booking, as: 'booking', attributes: [], where: { status: 'AWAITING_CONFIRMATION' }, required: true }],
          distinct: true,
          col: 'booking_id',
        })
      : 0,
    paymentRepository.providerPayoutTotal(profile.id, ['REQUESTED']),
    paymentRepository.providerPayoutTotal(profile.id, ['APPROVED']),
    paymentRepository.providerPayoutTotal(profile.id, ['PAID']),
    models.Commission.findAll({
      where: { provider_profile_id: profile.id },
      attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
      group: ['status'],
      raw: true,
    }),
  ]);

  const completedItems = await models.BookingItem.findAll({
    where: { provider_profile_id: profile.id, status: 'COMPLETED' },
    attributes: ['total_price', 'provider_payable', 'updated_at'],
    include: [{ model: models.Booking, as: 'booking', attributes: ['completed_at'], required: true }],
    raw: true,
  });

  const series = fillSeries(months);
  for (const item of completedItems) {
    const key = monthKey(item['booking.completed_at'] || item.updated_at);
    const row = series.find((entry) => entry.month === key);
    if (row) row.amount = toAmount(Number(row.amount) + Number(item.provider_payable));
  }

  let rating = null;
  if (profile.type === 'HOTEL') {
    const aggregate = await models.Hotel.findOne({ where: { provider_profile_id: profile.id }, attributes: [[fn('AVG', col('rating_avg')), 'avg'], [fn('SUM', col('rating_count')), 'count']], raw: true });
    if (aggregate?.avg) rating = { average: Number(Number(aggregate.avg).toFixed(2)), count: Number(aggregate.count || 0) };
  } else if (profile.type === 'GUIDE') {
    const guide = await models.Guide.findOne({ where: { provider_profile_id: profile.id }, attributes: ['rating_avg', 'rating_count'], raw: true });
    if (guide) rating = { average: Number(guide.rating_avg || 0), count: Number(guide.rating_count || 0) };
  } else {
    const aggregate = await models.Vehicle.findOne({ where: { provider_profile_id: profile.id }, attributes: [[fn('AVG', col('rating_avg')), 'avg'], [fn('SUM', col('rating_count')), 'count']], raw: true });
    if (aggregate?.avg) rating = { average: Number(Number(aggregate.avg).toFixed(2)), count: Number(aggregate.count || 0) };
  }

  const available = Math.max(0, Number(earned) - (Number(requested) + Number(approved) + Number(paidPayouts)));

  return {
    providerProfileId: profile.id,
    type: profile.type,
    status: profile.status,
    rating,
    bookings: {
      byStatus: Object.fromEntries(statusGroups.map((row) => [row.status, Number(row.count)])),
      awaitingYourAcceptance: pendingAcceptance,
      upcoming: upcoming.map((row) => bookingService.serializeBookingSummary(row)),
      upcomingTotal: Number(upcomingCount || 0),
      recent: recentItems.map((row) => bookingService.serializeBookingSummary(row)),
    },
    finance: {
      earned: toAmount(earned),
      requested: toAmount(requested),
      approved: toAmount(approved),
      paidOut: toAmount(paidPayouts),
      available: toAmount(available),
      series,
      commissions: commissionGroups.map((row) => ({ status: row.status, count: Number(row.count), total: toAmount(row.total) })),
    },
  };
}

async function customerDashboard(user) {
  const startDate = today();
  const [statusGroups, upcoming, recent, loyalty, unread, spent] = await Promise.all([
    models.Booking.findAll({
      where: { customer_user_id: user.id },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
    models.Booking.findOne({
      where: { customer_user_id: user.id, status: { [Op.in]: ['CONFIRMED', 'IN_PROGRESS', 'AWAITING_PAYMENT'] }, start_date: { [Op.gte]: startDate } },
      include: [{ model: models.BookingItem, as: 'items', attributes: ['id', 'item_type', 'title', 'total_price', 'status'] }],
      order: [['start_date', 'ASC']],
    }),
    models.Booking.findAll({
      where: { customer_user_id: user.id },
      include: [{ model: models.BookingItem, as: 'items', attributes: ['id', 'item_type', 'title', 'total_price', 'status'] }],
      order: [['id', 'DESC']],
      limit: 5,
    }),
    models.LoyaltyTransaction.findOne({ where: { user_id: user.id }, order: [['id', 'DESC']], attributes: ['balance_after'] }),
    models.Notification.count({ where: { user_id: user.id, read_at: null } }),
    models.Booking.sum('paid_amount', { where: { customer_user_id: user.id, status: { [Op.in]: ['COMPLETED', 'CONFIRMED', 'IN_PROGRESS'] } } }),
  ]);

  return {
    bookings: {
      byStatus: Object.fromEntries(statusGroups.map((row) => [row.status, Number(row.count)])),
      upcoming: upcoming ? bookingService.serializeBookingSummary(upcoming) : null,
      recent: recent.map((row) => bookingService.serializeBookingSummary(row)),
    },
    loyaltyPoints: loyalty ? Number(loyalty.balance_after) : 0,
    unreadNotifications: unread,
    totalSpent: toAmount(spent || 0),
  };
}

module.exports = { adminDashboard, providerDashboard, customerDashboard };
