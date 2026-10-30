'use strict';

const { sendMail } = require('../email/mailer');

const handlers = {
  'notification.email': async ({ to, subject, text, html }) => {
    await sendMail({ to, subject, text, html });
  },
  'booking.reminder': async ({ bookingId }) => {
    // Reminder content is produced by the notification service to keep templates in one place.
    const { sendBookingReminder } = require('../../modules/notifications/notification.service');
    await sendBookingReminder(bookingId);
  },
  'payout.requested': async ({ payoutId }) => {
    const { notifyPayoutRequested } = require('../../modules/notifications/notification.service');
    await notifyPayoutRequested(payoutId);
  },
};

module.exports = { handlers };
