'use strict';

/**
 * Platform-priced extra services. Clients may only choose a code and quantity -
 * prices always come from this catalogue, never from the request body.
 */
const ADDON_SERVICES = {
  AIRPORT_TRANSFER: { code: 'AIRPORT_TRANSFER', name: 'Airport / station transfer', price: 1500 },
  TRAVEL_INSURANCE: { code: 'TRAVEL_INSURANCE', name: 'Travel insurance', price: 350 },
  PHOTOGRAPHER: { code: 'PHOTOGRAPHER', name: 'Trip photographer (half day)', price: 4500 },
  LOCAL_SIM: { code: 'LOCAL_SIM', name: 'Local SIM with data', price: 500 },
  BREAKFAST_PACK: { code: 'BREAKFAST_PACK', name: 'Breakfast pack', price: 400 },
};

function getAddon(code) {
  return ADDON_SERVICES[code] || null;
}

function listAddons() {
  return Object.values(ADDON_SERVICES);
}

module.exports = { ADDON_SERVICES, getAddon, listAddons };
