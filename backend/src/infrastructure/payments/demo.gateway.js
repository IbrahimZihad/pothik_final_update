'use strict';

const crypto = require('crypto');
const config = require('../../../config');

function sign(payload) {
  return crypto
    .createHmac('sha256', config.payments.callbackSecret)
    .update(payload)
    .digest('hex');
}

/**
 * Sandbox gateway used when PAYMENT_GATEWAY=demo. It behaves like a provider:
 * it issues a signed redirect, and callbacks are only accepted when the HMAC
 * signature verifies. Production refuses to boot with this gateway enabled.
 */
class DemoGateway {
  constructor() {
    this.name = 'demo';
  }

  async createSession({ payment, booking }) {
    const signature = sign(`${payment.id}:${payment.amount}:${booking.reference}`);
    const redirectUrl = `${config.appUrl}/pay/demo/${payment.id}?sig=${signature}&amount=${payment.amount}`;
    return {
      gatewayUrl: redirectUrl,
      providerTxnId: `demo-${payment.id}-${Date.now()}`,
      raw: { sandbox: true },
    };
  }

  /**
   * Builds a provider-style callback payload. Used by the sandbox "pay" endpoint
   * so the verification path is identical to a real gateway callback.
   */
  buildCallback({ paymentId, amount, bookingReference, result = 'SUCCESS' }) {
    const base = `${paymentId}:${amount}:${bookingReference}:${result}`;
    return {
      paymentId: String(paymentId),
      amount: String(amount),
      bookingReference,
      result,
      signature: sign(base),
    };
  }

  async verifyCallback(payload) {
    const expected = sign(`${payload.paymentId}:${payload.amount}:${payload.bookingReference}:${payload.result}`);
    const provided = String(payload.signature || '');
    const valid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));

    if (!valid) {
      return { status: 'INVALID', reason: 'Signature verification failed' };
    }

    return {
      status: payload.result === 'SUCCESS' ? 'SUCCEEDED' : 'FAILED',
      providerTxnId: `demo-${payload.paymentId}-${payload.result}`,
      amount: payload.amount,
      reference: payload.bookingReference,
      raw: payload,
    };
  }
}

module.exports = { DemoGateway };
