import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function SectionHeading({ eyebrow, title, description, action, actionTo, className, align = 'left' }) {
  return (
    <div className={clsx('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', align === 'center' && 'sm:flex-col sm:items-center sm:text-center', className)}>
      <div className={clsx('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">{eyebrow}</p>}
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {action && actionTo && (
        <Link to={actionTo} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800">
          {action}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
