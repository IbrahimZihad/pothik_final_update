import { Link } from 'react-router-dom';
import { BadgeCheck, Languages, ShieldCheck } from 'lucide-react';
import Logo from '../Logo';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-page grid min-h-[calc(100vh-4rem)] items-center gap-10 py-12 lg:grid-cols-2">
      <div className="hidden lg:block">
        <div className="rounded-3xl bg-ink-900 p-10 text-white">
          <Logo inverted />
          <h2 className="mt-8 text-3xl font-extrabold leading-tight">One account for trips, providers and payouts.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Travellers plan and pay. Hotels, transport operators and guides manage their listings, bookings and finance from the same platform.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-slate-200">
            {[
              { icon: ShieldCheck, text: 'Server-calculated prices and verified payment callbacks.' },
              { icon: BadgeCheck, text: 'Provider ownership is enforced on every backend action.' },
              { icon: Languages, text: 'Bangla and English across the whole journey.' },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-300" aria-hidden="true" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="lg:hidden">
          <Logo />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-ink-900 lg:mt-0">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-sm text-slate-600">{footer}</div>}
        <p className="mt-8 text-center text-[11px] text-slate-400">
          By continuing you agree to our{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-slate-600">Terms</Link> and{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-slate-600">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
