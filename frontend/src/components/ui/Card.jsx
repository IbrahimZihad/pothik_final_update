import clsx from 'clsx';

export default function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={clsx('card', className)} {...props}>
      {children}
    </Tag>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary', className }) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700',
    secondary: 'bg-secondary-50 text-secondary-700',
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <div className={clsx('card p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tones[tone] || tones.primary)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
