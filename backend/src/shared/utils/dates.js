'use strict';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const DATE_FORMAT = 'YYYY-MM-DD';

function isValidDate(value) {
  return typeof value === 'string' && dayjs(value, DATE_FORMAT, true).isValid();
}

function today() {
  return dayjs.utc().format(DATE_FORMAT);
}

/** Inclusive list of dates between start and end (YYYY-MM-DD). */
function enumerateDates(start, end) {
  const dates = [];
  let cursor = dayjs.utc(start, DATE_FORMAT);
  const last = dayjs.utc(end, DATE_FORMAT);
  if (!cursor.isValid() || !last.isValid() || last.isBefore(cursor)) return dates;
  while (cursor.isBefore(last) || cursor.isSame(last)) {
    dates.push(cursor.format(DATE_FORMAT));
    cursor = cursor.add(1, 'day');
  }
  return dates;
}

function nightsBetween(start, end) {
  return dayjs.utc(end, DATE_FORMAT).diff(dayjs.utc(start, DATE_FORMAT), 'day');
}

function addDays(date, days) {
  return dayjs.utc(date, DATE_FORMAT).add(days, 'day').format(DATE_FORMAT);
}

function isBeforeOrEqual(a, b) {
  return !dayjs.utc(a, DATE_FORMAT).isAfter(dayjs.utc(b, DATE_FORMAT));
}

function isPast(date) {
  return dayjs.utc(date, DATE_FORMAT).isBefore(dayjs.utc().startOf('day'));
}

module.exports = {
  DATE_FORMAT,
  dayjs,
  isValidDate,
  today,
  enumerateDates,
  nightsBetween,
  addDays,
  isBeforeOrEqual,
  isPast,
};
