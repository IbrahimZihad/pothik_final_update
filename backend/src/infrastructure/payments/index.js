'use strict';

const config = require('../../config');
const { DemoGateway } = require('./demo.gateway');
const { SslcommerzGateway } = require('./sslcommerz.gateway');

const gateways = {
  demo: new DemoGateway(),
  sslcommerz: new SslcommerzGateway(config.payments.sslcommerz),
};

function getGateway(name = config.payments.gateway) {
  const gateway = gateways[name];
  if (!gateway) throw new Error(`Unknown payment gateway: ${name}`);
  return gateway;
}

function listGateways() {
  return Object.keys(gateways);
}

module.exports = { getGateway, listGateways };
