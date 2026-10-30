import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, CheckCircle2, Languages, MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { api, readData } from '../lib/api';
import { useLanguage } from '../i18n/LanguageProvider';
import { useSeo } from '../lib/seo';
import { todayISO, addDaysISO } from '../lib/format';
import Button from '../components/ui/Button';
import SectionHeading from '../components/ui/SectionHeading';
import { DestinationCard, HotelCard, PackageCard } from '../components/site/Cards';
import Slider from '../components/ui/Slider';
import { CardSkeleton } from '../components/ui/Skeleton';

function useHomeData() {
  return {
    destinations: useQuery({
      queryKey: ['home', 'destinations'],
      queryFn: () => readData(api.get('/destinations', { params: { featured: 'true', limit: 10 } })),
    }),
    packages: useQuery({
      queryKey: ['home', 'packages'],
      queryFn: () => readData(api.get('/packages', { params: { limit: 8 } })),
    }),
    hotels: useQuery({
      queryKey: ['home', 'hotels'],
      queryFn: () => readData(api.get('/hotels', { params: { limit: 8 } })),
    }),
    allDestinations: useQuery({
      queryKey: ['home', 'destination-options'],
      queryFn: () => readData(api.get('/destinations', { params: { limit: 50, sort: 'name' } })),
    }),
  };
}

export default function Home() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { destinations, packages, hotels, allDestinations } = useHomeData();
  useSeo({});
  const [form, setForm] = useState({
    destinationSlug: '',
    startDate: addDaysISO(todayISO(), 14),
    endDate: addDaysISO(todayISO(), 17),
    adults: 2,
  });

  const options = allDestinations.data?.items || [];

  function submitSearch(event) {
    event.preventDefault();
    const selected = options.find((row) => row.slug === form.destinationSlug);
    const params = new URLSearchParams({
      startDate: form.startDate,
      endDate: form.endDate,
      adults: String(form.adults),
    });
    if (selected) {
      params.set('destinationId', String(selected.id));
      params.set('destinationSlug', selected.slug);
      params.set('destinationName', selected.name);
    }
    navigate(`/plan?${params.toString()}`);
  }

  return (
    <>
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <img src="/hero.svg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-ink-900/40" aria-hidden="true" />
        <div className="container-page relative py-16 sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-100 ring-1 ring-white/15">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t('home.eyebrow')}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t('home.title')}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">{t('home.subtitle')}</p>

          <form onSubmit={submitSearch} className="mt-8 max-w-4xl rounded-2xl bg-white p-3 shadow-float sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.9fr_auto]">
              <label className="block">
                <span className="label">{t('home.searchDestination')}</span>
                <span className="relative block">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-600" aria-hidden="true" />
                  <select
                    value={form.destinationSlug}
                    onChange={(event) => setForm({ ...form, destinationSlug: event.target.value })}
                    className="input pl-9"
                  >
                    <option value="">Anywhere in Bangladesh</option>
                    {options.map((destination) => (
                      <option key={destination.id} value={destination.slug}>
                        {destination.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="block">
                <span className="label">{t('common.checkIn')}</span>
                <input
                  type="date"
                  className="input"
                  min={todayISO()}
                  value={form.startDate}
                  onChange={(event) => {
                    const startDate = event.target.value;
                    setForm((current) => ({
                      ...current,
                      startDate,
                      endDate: current.endDate <= startDate ? addDaysISO(startDate, 2) : current.endDate,
                    }));
                  }}
                  required
                />
              </label>
              <label className="block">
                <span className="label">{t('common.checkOut')}</span>
                <input
                  type="date"
                  className="input"
                  min={addDaysISO(form.startDate, 1)}
                  value={form.endDate}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="label">{t('home.searchTravellers')}</span>
                <select
                  className="input"
                  value={form.adults}
                  onChange={(event) => setForm({ ...form, adults: Number(event.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'adult' : 'adults'}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" className="h-full w-full lg:w-auto">
                <Search className="h-4 w-4" aria-hidden="true" /> {t('home.build')}
              </Button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
            {[
              { icon: ShieldCheck, text: t('home.trustServer') },
              { icon: BadgeCheck, text: t('home.trustVerified') },
              { icon: Languages, text: t('home.trustSupport') },
            ].map((item) => (
              <span key={item.text} className="inline-flex items-center gap-1.5">
                <item.icon className="h-4 w-4 text-primary-300" aria-hidden="true" /> {item.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <SectionHeading
          eyebrow="Explore"
          title={t('home.featuredDestinations')}
          description={t('home.featuredDestinationsSub')}
          action={t('common.viewAll')}
          actionTo="/destinations"
        />
        <div className="mt-8">
          {destinations.isLoading ? (
            <CardSkeleton count={6} />
          ) : (
            <Slider label="Featured destinations">
              {(destinations.data?.items || []).map((destination) => (
                <DestinationCard key={destination.id} destination={destination} />
              ))}
            </Slider>
          )}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container-page py-14">
          <SectionHeading
            eyebrow="Curated"
            title={t('home.popularPackages')}
            description={t('home.popularPackagesSub')}
            action={t('common.viewAll')}
            actionTo="/packages"
          />
          <div className="mt-8">
            {packages.isLoading ? (
              <CardSkeleton count={3} />
            ) : (
              <Slider label="Latest packages">
                {(packages.data?.items || []).map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </Slider>
            )}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <SectionHeading
          eyebrow="Stay"
          title={t('home.stays')}
          description={t('home.staysSub')}
          action={t('common.viewAll')}
          actionTo="/hotels"
        />
        <div className="mt-8">
          {hotels.isLoading ? (
            <CardSkeleton count={3} />
          ) : (
            <Slider label="Latest stays">
              {(hotels.data?.items || []).map((hotel) => (
                <HotelCard key={hotel.id} hotel={hotel} />
              ))}
            </Slider>
          )}
        </div>
      </section>

      <section className="grid-pattern border-y border-slate-200 bg-slate-100/60">
        <div className="container-page py-14">
          <SectionHeading eyebrow="How it works" title={t('home.how')} description={t('home.howSub')} align="center" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { title: t('home.how1Title'), text: t('home.how1Text'), icon: Search },
              { title: t('home.how2Title'), text: t('home.how2Text'), icon: CheckCircle2 },
              { title: t('home.how3Title'), text: t('home.how3Text'), icon: ShieldCheck },
            ].map((step, index) => (
              <div key={step.title} className="card p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-700">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-3xl font-extrabold text-slate-200">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="overflow-hidden rounded-3xl bg-ink-900 px-6 py-10 text-white sm:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-extrabold sm:text-3xl">{t('home.ctaTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{t('home.ctaText')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button as={Link} to="/plan" className="px-5 py-3 text-base">
                {t('home.build')} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button as={Link} to="/packages" variant="outline" className="border-white/30 bg-transparent text-white hover:border-white hover:text-white">
                {t('home.browsePackages')}
              </Button>
            </div>
          </div>
          <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: t('home.trustServer'), text: t('home.trustServerText') },
              { icon: BadgeCheck, title: t('home.trustVerified'), text: t('home.trustVerifiedText') },
              { icon: Languages, title: t('home.trustSupport'), text: t('home.trustSupportText') },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-400">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
