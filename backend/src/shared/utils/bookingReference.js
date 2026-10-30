'use strict';

const { randomInt } = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Human readable, non-sequential booking reference: PTK-20261030-7KQ2M4 */
function generateBookingReference(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `PTK-${y}${m}${d}-${randomCode(6)}`;
}

module.exports = { generateBookingReference, randomCode };
