import dayjs from 'dayjs';

export function formatCurrency(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '৳0';
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;
}

export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-BD');
}

export function formatDate(value, pattern = 'DD MMM YYYY') {
  if (!value) return '—';
  return dayjs(value).format(pattern);
}

export function formatDateRange(start, end) {
  if (!start || !end) return 'Dates to be confirmed';
  const from = dayjs(start);
  const to = dayjs(end);
  if (from.isSame(to, 'day')) return from.format('DD MMM YYYY');
  if (from.isSame(to, 'month')) return `${from.format('DD')} – ${to.format('DD MMM YYYY')}`;
  return `${from.format('DD MMM')} – ${to.format('DD MMM YYYY')}`;
}

export function nightsBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(dayjs(end).diff(dayjs(start), 'day'), 0);
}

export function daysBetween(start, end) {
  if (!start || !end) return 0;
  return dayjs(end).diff(dayjs(start), 'day') + 1;
}

export function todayISO() {
  return dayjs().format('YYYY-MM-DD');
}

export function addDaysISO(date, days) {
  return dayjs(date).add(days, 'day').format('YYYY-MM-DD');
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function humanize(value) {
  if (!value) return '';
  const text = String(value).replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const STATUS_TONES = {
  PENDING: 'amber',
  AWAITING_CONFIRMATION: 'amber',
  QUOTED: 'sky',
  AWAITING_PAYMENT: 'orange',
  CONFIRMED: 'emerald',
  IN_PROGRESS: 'sky',
  COMPLETED: 'emerald',
  CANCELLED: 'slate',
  REJECTED: 'rose',
  REFUND_PENDING: 'amber',
  REFUNDED: 'slate',
  REQUESTED: 'amber',
  APPROVED: 'sky',
  PAID: 'emerald',
  PROCESSED: 'emerald',
  EARNED: 'emerald',
  REVERSED: 'slate',
  ACTIVE: 'emerald',
  SUSPENDED: 'rose',
  DRAFT: 'slate',
  PUBLISHED: 'emerald',
  ARCHIVED: 'slate',
  VERIFIED: 'emerald',
  PENDING_REVIEW: 'amber',
};

export function statusTone(status) {
  return STATUS_TONES[status] || 'slate';
}

export function textPreview(text, max = 160) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
