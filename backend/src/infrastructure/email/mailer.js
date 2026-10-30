'use strict';

const logger = require('../../config/logger');
const config = require('../../config');

/**
 * Development mailer. Without SMTP configuration mail is logged only, so no
 * real messages leave the machine. Swap in an SMTP/API provider here for
 * production; callers only depend on sendMail().
 */
async function sendMail({ to, subject, text, html }) {
  if (config.isTest) return { skipped: true };
  logger.info({ to, subject, preview: text?.slice(0, 240), html: Boolean(html) }, 'outbound email (dev log transport)');
  return { logged: true };
}

module.exports = { sendMail };
