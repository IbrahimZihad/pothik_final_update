'use strict';

const config = require('../../config');
const { DemoGateway } = require('./demo.gateway');
const { SslcommerzGateway } = require('./sslcommerz.gateway');
const { BkashGateway } = require('./bkash.gateway');

const gateways = {
  demo: new DemoGateway(),
  sslcommerz: new SslcommerzGateway(config.payments.sslcommerz),
  bkash: new BkashGateway(config.payments.bkash),
};

function getGateway(name = config.payments.gateway) {
  const gateway = gateways[name];
  if (!gateway) throw new Error(`Unknown payment gateway: ${name}`);
  return gateway;
}

function listGateways() {
  return Object.keys(gateways);
}

function gatewayStatus() {
  return {
    default: config.payments.gateway,
    items: Object.entries(gateways).map(([name, gateway]) => ({ name, configured: gateway.isConfigured() })),
  };
}

module.exports = { getGateway, listGateways, gatewayStatus };
