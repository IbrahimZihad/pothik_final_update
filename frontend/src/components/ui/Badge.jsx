import clsx from 'clsx';
import { statusTone } from '../../lib/format';

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
};

export default function Badge({ tone = 'slate', className, children, dot = false }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset',
        TONES[tone] || TONES.slate,
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }) {
  if (!status) return null;
  return (
    <Badge tone={statusTone(status)} className={className} dot>
      {String(status).replaceAll('_', ' ').toLowerCase()}
    </Badge>
  );
}
