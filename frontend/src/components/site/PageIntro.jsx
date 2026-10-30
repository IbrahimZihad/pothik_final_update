import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function PageIntro({ eyebrow, title, description, breadcrumbs = [], children }) {
  return (
    <section className="hero-mask border-b border-slate-200 bg-white">
      <div className="container-page py-10 sm:py-14">
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <Link to="/" className="hover:text-primary-700">
              Home
            </Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.label} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-primary-700">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-700">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
