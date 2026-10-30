'use strict';

const logger = require('../../config/logger');
const { BusinessRuleError } = require('../../shared/errors');

const SANDBOX_BASE = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
const PRODUCTION_BASE = 'https://tokenized.pay.bka.sh/v1.2.0-beta';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * bKash Tokenized Checkout (PGW v1.2.0-beta) integration.
 *
 * createSession() opens a hosted bKash checkout and returns its redirect URL.
 * bKash sends the customer back with a GET request carrying paymentID and a
 * status hint. That hint is never trusted: verifyCallback() runs the
 * server-side execute call (or a status query if execute was already done) and
 * only reports SUCCEEDED when bKash itself reports the transaction as
 * Completed. providerTxnId is kept as the bKash paymentID so repeated
 * callbacks resolve to the same payment; the wallet trxID stays in the stored
 * gateway payload.
 *
 * Requires BKASH_APP_KEY / BKASH_APP_SECRET / BKASH_USERNAME / BKASH_PASSWORD.
 * Covered by provider-mock tests; not exercised against the sandbox because no
 * bKash sandbox credentials exist in this environment.
 */
class BkashGateway {
  constructor(settings = {}) {
    this.name = 'bkash';
    this.appKey = settings.appKey;
    this.appSecret = settings.appSecret;
    this.username = settings.username;
    this.password = settings.password;
    this.base = settings.baseUrl || (settings.sandbox ? SANDBOX_BASE : PRODUCTION_BASE);
    this.idToken = null;
    this.idTokenExpiresAt = 0;
  }

  assertConfigured() {
    if (!this.appKey || !this.appSecret || !this.username || !this.password) {
      throw new BusinessRuleError('bKash is selected but gateway credentials are not configured', 'GATEWAY_NOT_CONFIGURED');
    }
  }

  isConfigured() {
    return Boolean(this.appKey && this.appSecret && this.username && this.password);
  }

  async accessToken() {
    this.assertConfigured();
    if (this.idToken && Date.now() < this.idTokenExpiresAt) return this.idToken;

    const response = await fetch(`${this.base}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: this.username,
        password: this.password,
      },
      body: JSON.stringify({ app_key: this.appKey, app_secret: this.appSecret }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.id_token) {
      logger.error({ status: response.status, statusCode: data.statusCode, reason: data.statusMessage }, 'bkash token grant failed');
      throw new BusinessRuleError('bKash authentication failed', 'GATEWAY_AUTH_FAILED');
    }

    const lifetimeSeconds = Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600;
    this.idToken = data.id_token;
    this.idTokenExpiresAt = Date.now() + Math.max(0, lifetimeSeconds - 60) * 1000;
    return this.idToken;
  }

  async call(path, body) {
    const response = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: await this.accessToken(),
        'X-APP-Key': this.appKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      logger.error({ path, status: response.status, statusCode: data.statusCode, reason: data.statusMessage }, 'bkash request failed');
      throw new BusinessRuleError('bKash rejected the request', 'GATEWAY_REQUEST_FAILED');
    }
    return data;
  }

  async createSession({ payment, booking, urls }) {
    const data = await this.call('/tokenized/checkout/create', {
      mode: '0011',
      payerReference: String(booking.reference),
      callbackURL: urls.success,
      amount: Number(payment.amount).toFixed(2),
      currency: payment.currency || 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: String(payment.id),
    });

    if (!data.paymentID || !data.bkashURL) {
      logger.error({ statusCode: data.statusCode, reason: data.statusMessage }, 'bkash session creation failed');
      throw new BusinessRuleError('Payment gateway rejected the session request', 'GATEWAY_SESSION_FAILED');
    }

    return {
      gatewayUrl: data.bkashURL,
      providerTxnId: String(data.paymentID),
      raw: { paymentID: String(data.paymentID), callbackURL: data.callbackURL },
    };
  }

  async execute(paymentID) {
    const data = await this.call('/tokenized/checkout/execute', { paymentID });
    return data.transactionStatus === 'Completed' ? data : null;
  }

  async queryStatus(paymentID) {
    return this.call('/tokenized/checkout/payment/status', { paymentID });
  }

  async verifyCallback(payload) {
    this.assertConfigured();
    const paymentID = String(payload.paymentID || payload.paymentId || payload.payment_id || '');
    if (!paymentID) return { status: 'INVALID', reason: 'Missing bKash paymentID' };

    let completed = null;
    try {
      completed = await this.execute(paymentID);
    } catch (err) {
      logger.warn({ paymentID, reason: err.message }, 'bkash execute failed, querying payment status');
    }

    if (!completed) {
      const status = await this.queryStatus(paymentID).catch((err) => {
        logger.warn({ paymentID, reason: err.message }, 'bkash status query failed');
        return null;
      });
      if (status?.transactionStatus === 'Completed') completed = status;
    }

    if (completed) {
      return {
        status: 'SUCCEEDED',
        providerTxnId: paymentID,
        amount: completed.amount,
        reference: completed.merchantInvoiceNumber,
        raw: { ...completed, callback: payload },
      };
    }

    const hint = String(payload.status || payload.result || '').toLowerCase();
    if (['cancel', 'cancelled', 'canceled'].includes(hint)) {
      return { status: 'CANCELLED', providerTxnId: paymentID, raw: payload };
    }
    if (['failure', 'failed', 'fail'].includes(hint)) {
      return { status: 'FAILED', providerTxnId: paymentID, raw: payload };
    }

    return { status: 'INVALID', reason: 'bKash could not confirm this payment', raw: payload };
  }
}

module.exports = { BkashGateway };
