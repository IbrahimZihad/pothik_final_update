import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export default function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className={clsx('inline-flex items-center gap-2 text-sm text-slate-500', className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-primary-600" aria-hidden="true" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
