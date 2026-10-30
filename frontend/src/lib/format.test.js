import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateRange,
  nightsBetween,
  daysBetween,
  initials,
  humanize,
  textPreview,
  statusTone,
} from './format';

describe('format helpers', () => {
  it('formats BDT amounts and falls back to zero', () => {
    expect(formatCurrency(12500)).toBe('৳12,500');
    expect(formatCurrency('980.5')).toBe('৳980.5');
    expect(formatCurrency(null)).toBe('৳0');
    expect(formatCurrency('not-a-number')).toBe('৳0');
  });

  it('formats numbers with the en-BD locale', () => {
    expect(formatNumber(1500)).toBe('1,500');
    expect(formatNumber(undefined)).toBe('0');
  });

  it('formats dates and ranges', () => {
    expect(formatDate('2026-11-05')).toBe('05 Nov 2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDateRange('2026-11-05', '2026-11-09')).toBe('05 – 09 Nov 2026');
    expect(formatDateRange('2026-11-28', '2026-12-02')).toBe('28 Nov – 02 Dec 2026');
    expect(formatDateRange(null, null)).toBe('Dates to be confirmed');
  });

  it('counts nights and inclusive days', () => {
    expect(nightsBetween('2026-11-05', '2026-11-09')).toBe(4);
    expect(nightsBetween('2026-11-09', '2026-11-05')).toBe(0);
    expect(daysBetween('2026-11-05', '2026-11-09')).toBe(5);
  });

  it('derives initials, labels and previews', () => {
    expect(initials('Ayesha Rahman')).toBe('AR');
    expect(initials('  ')).toBe('');
    expect(humanize('AWAITING_PAYMENT')).toBe('Awaiting payment');
    expect(humanize('')).toBe('');
    expect(textPreview('one   two\nthree', 8)).toBe('one two…');
  });

  it('maps every booking status to a tone', () => {
    expect(statusTone('COMPLETED')).toBe('emerald');
    expect(statusTone('REFUND_PENDING')).toBe('amber');
    expect(statusTone('SOMETHING_ELSE')).toBe('slate');
  });
});
