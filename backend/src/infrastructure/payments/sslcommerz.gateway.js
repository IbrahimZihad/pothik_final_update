'use strict';

const config = require('../../config');
const logger = require('../../config/logger');
const { BusinessRuleError } = require('../../shared/errors');

/**
 * SSLCommerz hosted checkout integration.
 *
 * createSession() creates a payment session and returns the hosted gateway URL.
 * verifyCallback() re-validates the transaction with SSLCommerz's validation
 * API using val_id - the browser return parameters alone are never trusted.
 *
 * Requires SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD. The integration is
 * covered by provider-mock tests; it has not been exercised against the live
 * sandbox because no sandbox credentials exist in this environment.
 */
class SslcommerzGateway {
  constructor(settings) {
    this.name = 'sslcommerz';
    this.storeId = settings.storeId;
    this.storePassword = settings.storePassword;
    this.base = settings.sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
  }

  assertConfigured() {
    if (!this.storeId || !this.storePassword) {
      throw new BusinessRuleError('SSLCommerz is selected but store credentials are not configured', 'GATEWAY_NOT_CONFIGURED');
    }
  }

  async createSession({ payment, booking, customer, urls }) {
    this.assertConfigured();
    const body = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: String(payment.amount),
      currency: payment.currency || 'BDT',
      tran_id: String(payment.id),
      success_url: urls.success,
      fail_url: urls.fail,
      cancel_url: urls.cancel,
      cus_name: customer?.name || booking.contact_name || 'POTHIK Customer',
      cus_email: customer?.email || booking.contact_email || 'customer@pothik.com',
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: customer?.phone || booking.contact_phone || '01700000000',
      shipping_method: 'NO',
      product_name: `POTHIK booking ${booking.reference}`,
      product_category: 'travel',
      product_profile: 'general',
    });

    const response = await fetch(`${this.base}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      logger.error({ status: response.status, reason: data.failedreason }, 'sslcommerz session creation failed');
      throw new BusinessRuleError('Payment gateway rejected the session request', 'GATEWAY_SESSION_FAILED');
    }

    return {
      gatewayUrl: data.GatewayPageURL,
      providerTxnId: String(payment.id),
      raw: { sessionkey: data.sessionkey },
    };
  }

  async verifyCallback(payload) {
    this.assertConfigured();
    const status = String(payload.status || '').toUpperCase();

    if (status === 'FAILED' || status === 'CANCELLED') {
      return { status: status === 'FAILED' ? 'FAILED' : 'CANCELLED', providerTxnId: payload.tran_id, raw: payload };
    }

    if (!payload.val_id) return { status: 'INVALID', reason: 'Missing val_id' };

    const query = new URLSearchParams({
      val_id: payload.val_id,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: 'json',
    });
    const response = await fetch(`${this.base}/validator/api/validationserverAPI.php?${query.toString()}`);
    const data = await response.json().catch(() => ({}));
    const validStatus = String(data.status || '').toUpperCase();

    if (!response.ok || !['VALID', 'VALIDATED'].includes(validStatus)) {
      return { status: 'INVALID', reason: data.error || 'Gateway validation failed', raw: data };
    }

    const expectedAmount = Number(payload.amount);
    if (Number.isFinite(expectedAmount) && Math.abs(Number(data.amount) - expectedAmount) > 0.009) {
      return { status: 'INVALID', reason: 'Amount mismatch', raw: data };
    }

    return {
      status: 'SUCCEEDED',
      providerTxnId: String(data.tran_id || payload.tran_id),
      amount: data.amount,
      reference: data.tran_id,
      raw: data,
    };
  }
}

module.exports = { SslcommerzGateway };
