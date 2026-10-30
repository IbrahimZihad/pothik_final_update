import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import Logo from './Logo';
import { useLanguage } from '../i18n/LanguageProvider';

const COLUMNS = [
  {
    title: 'footer.explore',
    links: [
      { to: '/destinations', key: 'common.destinations' },
      { to: '/packages', key: 'common.packages' },
      { to: '/hotels', key: 'common.hotels' },
      { to: '/transport', key: 'common.transport' },
      { to: '/guides', key: 'common.guides' },
    ],
  },
  {
    title: 'footer.company',
    links: [
      { to: '/journal', key: 'common.blog' },
      { to: '/about', key: 'footer.about' },
      { to: '/contact', key: 'footer.contact' },
      { to: '/plan', key: 'common.planTrip' },
    ],
  },
  {
    title: 'footer.support',
    links: [
      { to: '/help', key: 'footer.help' },
      { to: '/terms', key: 'footer.terms' },
      { to: '/privacy', key: 'footer.privacy' },
      { to: '/search', key: 'common.search' },
    ],
  },
];

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="mt-20 bg-ink-900 text-slate-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo inverted />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">{t('footer.blurb')}</p>
          <div className="mt-5 space-y-2 text-sm text-slate-400">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary-300" aria-hidden="true" /> Dhaka, Bangladesh
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary-300" aria-hidden="true" /> +880 9600 000 000
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary-300" aria-hidden="true" /> hello@pothik.test
            </p>
          </div>
          <div className="mt-5 flex items-center gap-2">
            {[Facebook, Instagram, Youtube].map((Icon, index) => (
              <span key={index} className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-slate-300">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white">{t(column.title)}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-slate-400 transition hover:text-white">
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {t('footer.copyright')}</p>
          <p>{t('footer.demoNote')}</p>
        </div>
      </div>
    </footer>
  );
}
