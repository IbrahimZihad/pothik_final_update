import clsx from 'clsx';
import { Compass } from 'lucide-react';

export default function EmptyState({ icon: Icon = Compass, title, description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center', className)}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-50 text-primary-600">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
