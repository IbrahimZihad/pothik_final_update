'use strict';

const { Op } = require('sequelize');
const { models } = require('../../models');
const { enqueue } = require('../../infrastructure/jobs/queue');
const { sendMail } = require('../../infrastructure/email/mailer');
const { NotFoundError, ForbiddenError, BusinessRuleError } = require('../../shared/errors');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');
const logger = require('../../config/logger');

function serializeNotification(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    type: plain.type,
    title: plain.title,
    body: plain.body,
    data: plain.data || null,
    channel: plain.channel,
    readAt: plain.read_at,
    sentAt: plain.sent_at,
    createdAt: plain.created_at,
  };
}

function serializeMessage(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    bookingId: plain.booking_id,
    senderUserId: plain.sender_user_id,
    recipientUserId: plain.recipient_user_id,
    body: plain.body,
    readAt: plain.read_at,
    createdAt: plain.created_at,
  };
}

async function deliverEmail(user, { title, body, data }) {
  if (!user?.email) return;
  await enqueue('notification.email', {
    to: user.email,
    subject: title,
    text: `${body || ''}${data?.reference ? `\n\nBooking reference: ${data.reference}` : ''}`,
  });
}

/**
 * Persists an in-app notification and optionally emails the user. Email delivery
 * goes through the job queue so a slow SMTP server never blocks the request.
 */
async function notify(userId, { type, title, body = null, data = null, channel = 'IN_APP', transaction } = {}) {
  const notification = await models.Notification.create(
    {
      user_id: userId,
      type,
      title,
      body,
      data,
      channel,
      sent_at: new Date(),
    },
    { transaction }
  );

  if (channel !== 'IN_APP') {
    try {
      const user = await models.User.findByPk(userId, { attributes: ['id', 'email', 'name'] });
      await deliverEmail(user, { title, body, data });
    } catch (err) {
      logger.error({ userId, err: err.message }, 'notification email enqueue failed');
    }
  }

  return notification;
}

async function notifyCustomer(booking, { type, title, body }) {
  return notify(booking.customer_user_id, { type, title, body, data: { reference: booking.reference, bookingId: booking.id } });
}

async function notifyProviders(booking, { type, title, body }) {
  const items = await models.BookingItem.findAll({ where: { booking_id: booking.id }, attributes: ['provider_profile_id'] });
  const providerIds = [...new Set(items.map((item) => Number(item.provider_profile_id)).filter(Boolean))];
  if (!providerIds.length) return [];

  const profiles = await models.ProviderProfile.findAll({ where: { id: { [Op.in]: providerIds } }, attributes: ['id', 'user_id'] });
  return Promise.all(
    profiles.map((profile) =>
      notify(profile.user_id, { type, title, body, data: { reference: booking.reference, bookingId: booking.id } })
    )
  );
}

async function notifyPaymentReceived(booking, payment) {
  await notifyCustomer(booking, {
    type: 'PAYMENT_RECEIVED',
    title: `Payment received for ${booking.reference}`,
    body: `We received BDT ${Number(payment.amount).toFixed(2)}. ${booking.status === 'CONFIRMED' ? 'Your booking is confirmed.' : 'Your trip is ready.'}`,
  });
  if (booking.status === 'CONFIRMED') {
    await notifyProviders(booking, {
      type: 'BOOKING_CONFIRMED',
      title: `Booking ${booking.reference} is confirmed`,
      body: 'Payment is verified. Please prepare for the trip.',
    });
  }
}

async function notifyBookingCreated(booking) {
  await notifyProviders(booking, {
    type: 'BOOKING_REQUEST',
    title: `New booking request ${booking.reference}`,
    body: 'Review the booking and accept or reject the items assigned to you.',
  });
}

async function notifyRefundUpdate(refund, status) {
  const booking = await models.Booking.findByPk(refund.booking_id);
  if (!booking) return;
  await notifyCustomer(booking, {
    type: 'REFUND_UPDATE',
    title: `Refund ${status.toLowerCase()} for ${booking.reference}`,
    body: `Refund of BDT ${Number(refund.amount).toFixed(2)} is now ${status.toLowerCase()}.`,
  });
}

async function notifyPayoutRequested(payoutId) {
  const payout = await models.ProviderPayout.findByPk(payoutId, {
    include: [{ model: models.ProviderProfile, as: 'provider', attributes: ['id', 'business_name', 'user_id'] }],
  });
  if (!payout) return;

  await notify(payout.provider.user_id, {
    type: 'PAYOUT_REQUESTED',
    title: `Payout request of BDT ${Number(payout.amount).toFixed(2)} submitted`,
    body: 'Our finance team will review your payout request.',
    data: { payoutId: payout.id },
  });

  const admins = await models.User.findAll({ include: [{ model: models.Role, as: 'roles', where: { code: 'ADMIN' }, attributes: [] }], attributes: ['id'] });
  await Promise.all(
    admins.map((admin) =>
      notify(admin.id, {
        type: 'PAYOUT_REQUESTED',
        title: `Payout request from ${payout.provider.business_name}`,
        body: `BDT ${Number(payout.amount).toFixed(2)} requested.`,
        data: { payoutId: payout.id },
      })
    )
  );
}

async function sendBookingReminder(bookingId) {
  const booking = await models.Booking.findByPk(bookingId);
  if (!booking || !['AWAITING_PAYMENT', 'CONFIRMED'].includes(booking.status)) return;
  const title =
    booking.status === 'AWAITING_PAYMENT'
      ? `Complete payment for ${booking.reference}`
      : `Your trip ${booking.reference} starts soon`;
  const body =
    booking.status === 'AWAITING_PAYMENT'
      ? `BDT ${Number(booking.due_amount).toFixed(2)} is still due. Pay now to secure your seats.`
      : `Your trip starts on ${booking.start_date}. Check your voucher for pickup details.`;
  await notify(booking.customer_user_id, { type: 'BOOKING_REMINDER', title, body, channel: 'BOTH', data: { reference: booking.reference } });
}

async function listNotifications(user, query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const where = { user_id: user.id };
  if (query.unread === 'true') where.read_at = null;
  if (query.type) where.type = query.type;

  const { rows, count } = await models.Notification.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { items: rows.map(serializeNotification), meta: buildMeta({ page, limit, total: count }) };
}

async function unreadCount(user) {
  const count = await models.Notification.count({ where: { user_id: user.id, read_at: null } });
  return { unread: count };
}

async function markRead(user, id) {
  const notification = await models.Notification.findOne({ where: { id, user_id: user.id } });
  if (!notification) throw new NotFoundError('Notification');
  if (!notification.read_at) await notification.update({ read_at: new Date() });
  return serializeNotification(notification);
}

async function markAllRead(user) {
  const [updated] = await models.Notification.update({ read_at: new Date() }, { where: { user_id: user.id, read_at: null } });
  return { updated };
}

async function messageParticipants(user, booking) {
  if (Number(booking.customer_user_id) === Number(user.id)) {
    const items = await models.BookingItem.findAll({ where: { booking_id: booking.id }, attributes: ['provider_profile_id'] });
    const providerIds = [...new Set(items.map((item) => Number(item.provider_profile_id)).filter(Boolean))];
    const profiles = await models.ProviderProfile.findAll({ where: { id: { [Op.in]: providerIds } }, attributes: ['user_id'] });
    return profiles.map((profile) => Number(profile.user_id));
  }

  const items = await models.BookingItem.findAll({ where: { booking_id: booking.id }, attributes: ['provider_profile_id'] });
  const providerIds = [...new Set(items.map((item) => Number(item.provider_profile_id)).filter(Boolean))];
  const profiles = await models.ProviderProfile.findAll({ where: { id: { [Op.in]: providerIds } }, attributes: ['user_id'] });
  if (profiles.some((profile) => Number(profile.user_id) === Number(user.id))) {
    return [Number(booking.customer_user_id)];
  }
  throw new ForbiddenError('You are not a participant of this booking');
}

async function sendMessage(user, { bookingReference, recipientUserId = null, body }) {
  const booking = await models.Booking.findOne({ where: { reference: bookingReference } });
  if (!booking) throw new NotFoundError('Booking');

  const participants = await messageParticipants(user, booking);
  let recipient = Number(recipientUserId);
  if (!recipient) {
    if (participants.length !== 1) {
      throw new BusinessRuleError('Choose who to message for this booking', 'RECIPIENT_REQUIRED', { recipients: participants });
    }
    [recipient] = participants;
  } else if (!participants.includes(recipient)) {
    throw new ForbiddenError('You can only message other participants of this booking');
  }
  if (!body || !body.trim()) throw new BusinessRuleError('Message cannot be empty', 'MESSAGE_EMPTY');

  const message = await models.Message.create({
    booking_id: booking.id,
    sender_user_id: user.id,
    recipient_user_id: recipient,
    body: body.trim(),
  });

  try {
    const recipientUser = await models.User.findByPk(recipient, { attributes: ['id', 'email', 'name'] });
    await deliverEmail(recipientUser, {
      title: `New message about ${booking.reference}`,
      body: `${user.name || 'POTHIK'}: ${body.trim().slice(0, 500)}`,
      data: { reference: booking.reference },
    });
  } catch (err) {
    logger.error({ err: err.message }, 'message email enqueue failed');
  }

  return serializeMessage(message);
}

async function listThread(user, { bookingReference, withUserId = null, page = 1, limit = 50 }) {
  const booking = await models.Booking.findOne({ where: { reference: bookingReference } });
  if (!booking) throw new NotFoundError('Booking');
  const participants = await messageParticipants(user, booking);
  const other = withUserId ? Number(withUserId) : participants[0];

  const where = {
    booking_id: booking.id,
    [Op.or]: [
      { sender_user_id: user.id, recipient_user_id: other },
      { sender_user_id: other, recipient_user_id: user.id },
    ],
  };
  const { page: current, limit: size, offset } = getPagination({ page, limit }, { defaultLimit: 50, maxLimit: 200 });
  const { rows, count } = await models.Message.findAndCountAll({ where, order: [['id', 'ASC']], limit: size, offset });

  await models.Message.update(
    { read_at: new Date() },
    { where: { booking_id: booking.id, recipient_user_id: user.id, sender_user_id: other, read_at: null } }
  );

  return { items: rows.map(serializeMessage), meta: buildMeta({ page: current, limit: size, total: count }) };
}

module.exports = {
  notify,
  notifyCustomer,
  notifyProviders,
  notifyPaymentReceived,
  notifyBookingCreated,
  notifyRefundUpdate,
  notifyPayoutRequested,
  sendBookingReminder,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  sendMessage,
  listThread,
  serializeNotification,
  serializeMessage,
  sendMail,
};
