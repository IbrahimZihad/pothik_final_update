import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BadgePercent,
  Bell,
  Building2,
  CalendarCheck,
  Car,
  ClipboardList,
  Compass,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  HandCoins,
  Hotel,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Newspaper,
  Plane,
  ReceiptText,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../auth/AuthProvider';
import { useLanguage } from '../i18n/LanguageProvider';
import { useSeo } from '../lib/seo';

const CUSTOMER_NAV = [
  { to: '/account', label: 'account.dashboard', icon: LayoutDashboard, end: true },
  { to: '/account/bookings', label: 'booking.title', icon: CalendarCheck },
  { to: '/account/notifications', label: 'account.notifications', icon: Bell },
  { to: '/account/profile', label: 'account.profile', icon: UserRound },
];

const PROVIDER_NAV = [
  { to: '/provider', label: 'provider.dashboard', icon: LayoutDashboard, end: true },
  { to: '/provider/bookings', label: 'provider.bookings', icon: ClipboardList },
  { to: '/provider/finance', label: 'provider.finance', icon: Wallet },
  { to: '/provider/profile', label: 'provider.profile', icon: Building2 },
];

const PROVIDER_TYPE_NAV = {
  HOTEL: [
    { to: '/provider/hotels', label: 'provider.hotels', icon: Hotel },
    { to: '/provider/vehicles', label: 'provider.vehicles', icon: Car, hidden: true },
  ],
  TRANSPORT: [
    { to: '/provider/vehicles', label: 'provider.vehicles', icon: Car },
    { to: '/provider/drivers', label: 'Drivers', icon: Users },
  ],
  GUIDE: [{ to: '/provider/guide', label: 'provider.guideProfile', icon: Compass }],
};

const ADMIN_NAV = [
  { to: '/admin', label: 'admin.dashboard', icon: Gauge, end: true },
  { to: '/admin/users', label: 'admin.users', icon: Users },
  { to: '/admin/providers', label: 'admin.providers', icon: ShieldCheck },
  { to: '/admin/bookings', label: 'admin.bookings', icon: CalendarCheck },
  { to: '/admin/finance', label: 'admin.finance', icon: HandCoins },
  { to: '/admin/coupons', label: 'admin.coupons', icon: BadgePercent },
  { to: '/admin/reviews', label: 'admin.reviews', icon: Star },
  { to: '/admin/blogs', label: 'admin.blogs', icon: Newspaper },
  { to: '/admin/audit', label: 'admin.audit', icon: FileText },
];

function useNavFor(auth) {
  if (auth.isAdmin) {
    return [
      { title: 'admin.dashboard', items: ADMIN_NAV },
      {
        title: 'common.search',
        items: [{ to: '/destinations', label: 'common.destinations', icon: Plane, external: true }],
      },
    ];
  }
  if (auth.isProvider) {
    const typeItems = (PROVIDER_TYPE_NAV[auth.providerType] || []).filter((item) => !item.hidden);
    return [
      { title: 'provider.dashboard', items: PROVIDER_NAV },
      ...(typeItems.length ? [{ title: 'provider.profile', items: typeItems }] : []),
    ];
  }
  return [{ title: 'account.dashboard', items: CUSTOMER_NAV }];
}

export default function DashboardLayout() {
  const auth = useAuth();
  const { t, lang, setLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useSeo({ title: 'Dashboard', noindex: true });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function signOut() {
    await auth.logout();
    navigate('/login', { replace: true });
  }

  const groups = useNavFor(auth);
  const roleLabel = auth.isAdmin ? 'Administrator' : auth.isProvider ? t(`auth.${roleKey(auth.providerType)}`) : t('auth.customer');

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <div className="mx-3 rounded-xl bg-primary-50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-700">{roleLabel}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink-900">{auth.user?.name}</p>
      </div>
      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-2 pb-4" aria-label="Dashboard navigation">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t(group.title)}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(item.label)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <ExternalLink className="h-4 w-4" /> {t('common.home')}
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" /> {t('common.signOut')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="relative z-10 h-full w-72 max-w-[85%] bg-white shadow-float">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open dashboard navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Logo compact />
            </div>
            <p className="hidden text-sm font-semibold text-slate-700 sm:block">
              {t(auth.isAdmin ? 'admin.dashboard' : auth.isProvider ? 'provider.dashboard' : 'account.dashboard')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              aria-label="Switch language"
            >
              <Globe className="h-4 w-4" /> {t('common.language')}
            </button>
            {!auth.isAdmin && !auth.isProvider && (
              <Link to="/account/notifications" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={t('account.notifications')}>
                <Bell className="h-5 w-5" />
              </Link>
            )}
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:inline-flex">
              {auth.user?.name}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600 lg:hidden"
              aria-label={t('common.signOut')}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {auth.isProvider && auth.providerStatus && auth.providerStatus !== 'APPROVED' && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 sm:px-6">
            <MessageSquareText className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
            Your provider profile is <strong>{auth.providerStatus.toLowerCase()}</strong>. Listings and payouts unlock after admin approval.
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-4 py-4 text-xs text-slate-400 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} POTHIK</span>
            <span className="inline-flex items-center gap-1.5">
              <ReceiptText className="h-3.5 w-3.5" /> Every price is server-calculated.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function roleKey(type) {
  if (type === 'HOTEL') return 'hotelOwner';
  if (type === 'TRANSPORT') return 'transportProvider';
  if (type === 'GUIDE') return 'tourGuide';
  return 'customer';
}
