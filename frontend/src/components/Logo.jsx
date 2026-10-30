import clsx from 'clsx';
import { Link } from 'react-router-dom';

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={clsx('h-9 w-9', className)} role="img" aria-label="POTHIK logo">
      <defs>
        <linearGradient id="pothik-mark" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0d9488" />
          <stop offset="1" stopColor="#034D41" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#pothik-mark)" />
      <path d="M13.5 29.5V12.5h6.9a5.6 5.6 0 0 1 0 11.2h-3.1" stroke="#ffffff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M17.3 18.5h4.6" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
      <circle cx="27.2" cy="12.8" r="2.5" fill="#f97316" />
    </svg>
  );
}

export default function Logo({ to = '/', inverted = false, compact = false, className }) {
  return (
    <Link to={to} className={clsx('inline-flex items-center gap-2.5', className)} aria-label="POTHIK home">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className={clsx('block text-lg font-extrabold tracking-[0.14em]', inverted ? 'text-white' : 'text-ink-900')}>POTHIK</span>
          <span className={clsx('mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em]', inverted ? 'text-primary-200' : 'text-primary-600')}>
            Travel Bangladesh
          </span>
        </span>
      )}
    </Link>
  );
}
