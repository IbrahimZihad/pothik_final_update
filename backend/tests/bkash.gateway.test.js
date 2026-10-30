'use strict';

const { BkashGateway } = require('../src/infrastructure/payments/bkash.gateway');
const { BusinessRuleError } = require('../src/shared/errors');

const SANDBOX_BASE = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
const SETTINGS = { appKey: 'app-key', appSecret: 'app-secret', username: 'merchant-user', password: 'merchant-pass', sandbox: true };

function reply(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function tokenGrant() {
  return reply({ id_token: 'id-token-1', expires_in: 3600, token_type: 'Bearer' });
}

describe('bKash tokenized checkout adapter', () => {
  const realFetch = global.fetch;
  let gateway;
  let fetchMock;

  beforeEach(() => {
    gateway = new BkashGateway(SETTINGS);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('refuses network calls when credentials are missing', async () => {
    const unconfigured = new BkashGateway({});
    expect(unconfigured.isConfigured()).toBe(false);
    expect(gateway.isConfigured()).toBe(true);

    await expect(unconfigured.verifyCallback({ paymentID: 'TR1' })).rejects.toMatchObject({
      code: 'GATEWAY_NOT_CONFIGURED',
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('grants a token once and reuses it', async () => {
    fetchMock.mockResolvedValueOnce(tokenGrant());

    expect(await gateway.accessToken()).toBe('id-token-1');
    expect(await gateway.accessToken()).toBe('id-token-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SANDBOX_BASE}/tokenized/checkout/token/grant`);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ username: 'merchant-user', password: 'merchant-pass' });
    expect(JSON.parse(init.body)).toEqual({ app_key: 'app-key', app_secret: 'app-secret' });
  });

  it('creates a checkout session with the invoice number and returns bKash identifiers', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenGrant())
      .mockResolvedValueOnce(
        reply({ paymentID: 'TR0011ABC', bkashURL: 'https://sandbox.bka.sh/pay/TR0011ABC', callbackURL: 'https://api.test/callback/bkash' })
      );

    const session = await gateway.createSession({
      payment: { id: 42, amount: '100.00', currency: 'BDT' },
      booking: { reference: 'PTK-2026-0001' },
      urls: { success: 'https://api.test/callback/bkash', fail: 'https://api.test/callback/bkash/fail', cancel: 'https://api.test/callback/bkash/cancel' },
    });

    expect(session.gatewayUrl).toBe('https://sandbox.bka.sh/pay/TR0011ABC');
    expect(session.providerTxnId).toBe('TR0011ABC');
    expect(session.raw).toEqual({ paymentID: 'TR0011ABC', callbackURL: 'https://api.test/callback/bkash' });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${SANDBOX_BASE}/tokenized/checkout/create`);
    expect(init.headers.Authorization).toBe('id-token-1');
    expect(init.headers['X-APP-Key']).toBe('app-key');
    expect(JSON.parse(init.body)).toEqual({
      mode: '0011',
      payerReference: 'PTK-2026-0001',
      callbackURL: 'https://api.test/callback/bkash',
      amount: '100.00',
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: '42',
    });
  });

  it('fails the session when bKash answers without a redirect URL', async () => {
    fetchMock.mockResolvedValueOnce(tokenGrant()).mockResolvedValueOnce(reply({ statusCode: '2001', statusMessage: 'Invalid request' }));

    await expect(
      gateway.createSession({ payment: { id: 7, amount: 10 }, booking: { reference: 'PTK-1' }, urls: { success: 'https://api.test/cb' } })
    ).rejects.toMatchObject({ code: 'GATEWAY_SESSION_FAILED' });
  });

  it('confirms a payment through execute and treats non-completed states as pending', async () => {
    fetchMock.mockResolvedValueOnce(tokenGrant()).mockResolvedValueOnce(reply({ transactionStatus: 'Completed', trxID: '9XK1' }));
    const completed = await gateway.execute('TR1');
    expect(completed.trxID).toBe('9XK1');

    fetchMock.mockResolvedValueOnce(reply({ transactionStatus: 'Pending' }));
    expect(await gateway.execute('TR2')).toBeNull();
  });

  it('verifies a successful callback by executing it, not by trusting the status hint', async () => {
    fetchMock.mockResolvedValueOnce(tokenGrant()).mockResolvedValueOnce(
      reply({ transactionStatus: 'Completed', amount: '25.00', merchantInvoiceNumber: 'PTK-2026-0001', trxID: '9XK1' })
    );

    const verified = await gateway.verifyCallback({ paymentID: 'TR1', status: 'failure' });

    expect(verified).toMatchObject({
      status: 'SUCCEEDED',
      providerTxnId: 'TR1',
      amount: '25.00',
      reference: 'PTK-2026-0001',
    });
    expect(verified.raw.callback).toEqual({ paymentID: 'TR1', status: 'failure' });
  });

  it('falls back to the status query when execute is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenGrant())
      .mockResolvedValueOnce(reply({ statusCode: '2028', statusMessage: 'Already executed' }, { ok: false, status: 400 }))
      .mockResolvedValueOnce(reply({ transactionStatus: 'Completed', amount: '25.00', merchantInvoiceNumber: 'PTK-2026-0001' }));

    const verified = await gateway.verifyCallback({ paymentID: 'TR1', status: 'success' });
    expect(verified.status).toBe('SUCCEEDED');

    const [url] = fetchMock.mock.calls[2];
    expect(url).toBe(`${SANDBOX_BASE}/tokenized/checkout/payment/status`);
  });

  it('maps user-facing outcomes only after bKash declines to complete the payment', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenGrant())
      .mockResolvedValueOnce(reply({ transactionStatus: 'Initiated' }))
      .mockResolvedValueOnce(reply({ transactionStatus: 'Initiated' }));
    expect((await gateway.verifyCallback({ paymentID: 'TR1', status: 'cancel' })).status).toBe('CANCELLED');

    fetchMock.mockResolvedValueOnce(reply({ transactionStatus: 'Initiated' })).mockResolvedValueOnce(reply({ transactionStatus: 'Initiated' }));
    expect((await gateway.verifyCallback({ paymentID: 'TR1', status: 'failure' })).status).toBe('FAILED');

    fetchMock.mockResolvedValueOnce(reply({ transactionStatus: 'Initiated' })).mockResolvedValueOnce(reply({ transactionStatus: 'Initiated' }));
    expect((await gateway.verifyCallback({ paymentID: 'TR1' })).status).toBe('INVALID');
  });

  it('rejects callbacks without a paymentID before touching the network', async () => {
    const verified = await gateway.verifyCallback({ status: 'success' });
    expect(verified.status).toBe('INVALID');
    expect(verified.reason).toMatch(/paymentID/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a BusinessRuleError when bKash rejects authentication', async () => {
    fetchMock.mockResolvedValue(reply({ statusCode: '4013', statusMessage: 'Invalid credentials' }, { ok: false, status: 401 }));

    await expect(gateway.accessToken()).rejects.toBeInstanceOf(BusinessRuleError);
    await expect(gateway.accessToken()).rejects.toMatchObject({ code: 'GATEWAY_AUTH_FAILED' });
  });
});
