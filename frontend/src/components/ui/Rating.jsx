import { Star } from 'lucide-react';
import clsx from 'clsx';

export default function Rating({ value = 0, count, size = 'sm', showValue = true, className }) {
  const rating = Number(value) || 0;
  const starSize = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)} aria-label={`Rated ${rating} out of 5`}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((step) => (
          <Star
            key={step}
            className={clsx(starSize, step <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200')}
            aria-hidden="true"
          />
        ))}
      </span>
      {showValue && <span className="text-xs font-semibold text-slate-700">{rating ? rating.toFixed(1) : 'New'}</span>}
      {count !== undefined && count > 0 && <span className="text-xs text-slate-500">({count})</span>}
    </span>
  );
}

export function RatingInput({ value = 5, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={value === step}
          aria-label={`${step} star${step > 1 ? 's' : ''}`}
          disabled={disabled}
          onClick={() => onChange(step)}
          className="rounded p-0.5 transition hover:scale-110 disabled:cursor-not-allowed"
        >
          <Star
            className={clsx('h-7 w-7', step <= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300')}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
