'use strict';

const Decimal = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const ZERO = new Decimal(0);

function money(value) {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(value);
}

function round2(value) {
  return money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Returns a plain string with exactly two decimals - safe to store in DECIMAL columns. */
function toAmount(value) {
  return round2(value).toFixed(2);
}

function multiply(a, b) {
  return money(a).times(money(b));
}

function percentOf(amount, rate) {
  return money(amount).times(money(rate)).dividedBy(100);
}

function sum(values = []) {
  return values.reduce((acc, v) => acc.plus(money(v)), ZERO);
}

function max(a, b) {
  return Decimal.max(money(a), money(b));
}

function isPositive(value) {
  return money(value).greaterThan(0);
}

module.exports = { Decimal, money, round2, toAmount, multiply, percentOf, sum, max, isPositive, ZERO };
