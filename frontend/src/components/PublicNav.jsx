import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Globe, LayoutDashboard, LogOut, Menu, Sparkles, User, X } from 'lucide-react';
import Logo from './Logo';
import Button from './ui/Button';
import { useAuth } from '../auth/AuthProvider';
import { useLanguage } from '../i18n/LanguageProvider';

const LINKS = [
  { to: '/destinations', key: 'common.destinations' },
  { to: '/packages', key: 'common.packages' },
  { to: '/hotels', key: 'common.hotels' },
  { to: '/transport', key: 'common.transport' },
  { to: '/guides', key: 'common.guides' },
  { to: '/journal', key: 'common.blog' },
];

export function dashboardPathFor(auth) {
  if (auth.isAdmin) return '/admin';
  if (auth.isProvider) return '/provider';
  return '/account';
}

export default function PublicNav() {
  const { t, lang, setLang } = useLanguage();
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const dashboardPath = dashboardPathFor(auth);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                clsx(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            aria-label="Switch language"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            {t('common.language')}
          </button>

          {auth.isAuthenticated ? (
            <>
              <Link to={dashboardPath} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                {auth.isAdmin ? <LayoutDashboard className="h-4 w-4" /> : <User className="h-4 w-4" />}
                <span className="max-w-[9rem] truncate">{auth.user?.name?.split(' ')[0] || t('common.account')}</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => auth.logout()} aria-label={t('common.signOut')}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              {t('common.signIn')}
            </Link>
          )}

          <Button as={Link} to="/plan" size="sm" className="ml-1">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t('common.planTrip')}
          </Button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Mobile navigation">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  clsx('rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-100')
                }
              >
                {t(link.key)}
              </NavLink>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
                className="btn-outline btn-sm flex-1"
              >
                <Globe className="h-4 w-4" /> {t('common.language')}
              </button>
              {auth.isAuthenticated ? (
                <>
                  <Link to={dashboardPath} className="btn-outline btn-sm flex-1">
                    <LayoutDashboard className="h-4 w-4" /> {t('common.account')}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => auth.logout()} aria-label={t('common.signOut')}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Link to="/login" className="btn-outline btn-sm flex-1">
                  {t('common.signIn')}
                </Link>
              )}
            </div>
            <Link to="/plan" className="btn-primary mt-2 w-full">
              <Sparkles className="h-4 w-4" /> {t('common.planTrip')}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
