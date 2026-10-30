import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, CalendarDays, Clock, Compass, Languages, MapPin, Sparkles } from 'lucide-react';
import { api, readData } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Rating from '../components/ui/Rating';
import SmartImage from '../components/ui/SmartImage';
import { Input } from '../components/ui/Field';
import ReviewList from '../components/site/ReviewList';
import ContactBookingModal from '../components/booking/ContactBookingModal';
import { addDaysISO, formatCurrency, formatDate, formatDateRange, daysBetween, initials, todayISO } from '../lib/format';
import { absoluteUrl, breadcrumb, graph, truncate, useSeo } from '../lib/seo';
import useTargetReviews from '../lib/useTargetReviews';

export default function GuideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  const today = todayISO();
  const [trip, setTrip] = useState({
    startDate: addDaysISO(today, 2),
    endDate: addDaysISO(today, 4),
    adults: 2,
    children: 0,
    hours: '',
  });
  const [bookingOpen, setBookingOpen] = useState(false);

  const guide = useQuery({
    queryKey: ['guide', id],
    queryFn: () => readData(api.get(`/guides/${id}`)),
  });

  const guideName = guide.data?.provider?.businessName || 'Local guide';
  const guideRate = Number(guide.data?.dailyRate) || 0;

  useSeo({
    title: guide.data ? guideName : undefined,
    description: guide.data?.bio,
    image: guide.data?.photo,
    url: `/guides/${id}`,
    jsonLd: guide.data
      ? graph(
          {
            '@type': 'Service',
            name: `${guideName} — local guide`,
            serviceType: 'Guided tours',
            description: truncate(guide.data.bio, 300),
            image: absoluteUrl(guide.data.photo),
            areaServed: (guide.data.serviceLocations || []).join(', ') || 'Bangladesh',
            provider: { '@type': 'Person', name: guideName },
            offers:
              guideRate > 0
                ? {
                    '@type': 'Offer',
                    price: guideRate,
                    priceCurrency: 'BDT',
                    availability: 'https://schema.org/InStock',
                    url: absoluteUrl(`/guides/${guide.data.id}`),
                  }
                : undefined,
          },
          breadcrumb([
            { name: 'Home', path: '/' },
            { name: 'Guides', path: '/guides' },
            { name: guideName, path: `/guides/${guide.data.id}` },
          ])
        )
      : null,
  });

  const validRange = Boolean(trip.startDate && trip.endDate && trip.endDate >= trip.startDate);
  const availability = useQuery({
    queryKey: ['guide', id, 'availability', trip.startDate, trip.endDate],
    queryFn: () =>
      readData(api.get(`/guides/${id}/availability`, { params: { startDate: trip.startDate, endDate: trip.endDate } })),
    enabled: Boolean(id) && validRange,
  });

  const reviews = useTargetReviews('GUIDE', guide.data?.id || id);

  if (guide.isLoading) return <PageLoader label="Loading guide…" />;
  if (guide.isError || !guide.data) {
    return (
      <div className="container-page py-20">
        <EmptyState
          title="Guide not found"
          description={guide.error?.message}
          action={<Button as={Link} to="/guides" variant="outline">Browse guides</Button>}
        />
      </div>
    );
  }

  const data = guide.data;
  const days = validRange ? Math.max(1, daysBetween(trip.startDate, trip.endDate)) : 0;
  const hours = Number(trip.hours || 0);
  const estimate = hours && data.hourlyRate ? data.hourlyRate * hours : data.dailyRate * days;
  const unavailable = validRange && availability.data && !availability.data.available;
  const blockedDates = availability.data?.blockedDates || [];
  const name = data.provider?.businessName || 'Local guide';

  function beginBooking() {
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: `/guides/${id}` } });
      return;
    }
    if (!validRange || unavailable) return;
    setBookingOpen(true);
  }

  const payload = {
    type: 'GUIDE',
    composition: {
      adults: Number(trip.adults),
      children: Number(trip.children),
      guide: {
        guideId: data.id,
        startDate: trip.startDate,
        endDate: trip.endDate,
        ...(hours ? { hours } : {}),
      },
    },
  };

  return (
    <>
      <section className="hero-mask border-b border-slate-200 bg-white">
        <div className="container-page py-10">
          <Link to="/guides" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900">
            <ArrowLeft className="h-3.5 w-3.5" /> All guides
          </Link>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <SmartImage
              src={data.photo}
              alt={name}
              wrapperClassName="h-28 w-28 shrink-0 rounded-3xl"
              className="h-28 w-28 rounded-3xl object-cover"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold text-ink-900">{name}</h1>
                <Badge tone="emerald" dot>Verified guide</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <Rating value={data.rating?.average} count={data.rating?.count} />
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary-600" aria-hidden="true" /> {data.yearsExperience || 0} years guiding
                </span>
                {data.serviceLocations?.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary-600" aria-hidden="true" /> {data.serviceLocations.slice(0, 3).join(' · ')}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(data.languages || []).map((language) => (
                  <span key={language} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                    <Languages className="h-3 w-3" aria-hidden="true" /> {language}
                  </span>
                ))}
                {(data.expertise || []).map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="text-lg font-bold text-ink-900">About your guide</h2>
            <p className="prose-pothik mt-3 whitespace-pre-line">{data.bio || 'A local guide ready to shape a route around your interests.'}</p>
            {data.provider?.description && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {initials(name)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{name}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">{data.provider.description}</p>
                </div>
              </div>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Daily rate
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(data.dailyRate)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Hourly rate
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{data.hourlyRate ? formatCurrency(data.hourlyRate) : 'Not offered'}</p>
              </div>
            </div>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Check availability</h2>
                <p className="mt-1 text-xs text-slate-500">Guides work within one calendar window per booking.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Start date" type="date" min={today} value={trip.startDate} onChange={(event) => {
                  const startDate = event.target.value;
                  setTrip((current) => ({ ...current, startDate, endDate: current.endDate < startDate ? startDate : current.endDate }));
                }} wrapperClassName="w-36" />
                <Input label="End date" type="date" min={trip.startDate} value={trip.endDate} onChange={(event) => setTrip({ ...trip, endDate: event.target.value })} wrapperClassName="w-36" />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 px-4 py-4">
              {!validRange ? (
                <p className="text-sm text-amber-700">The end date cannot be before the start date.</p>
              ) : availability.isLoading ? (
                <p className="text-sm text-slate-500">Checking the guide calendar…</p>
              ) : availability.isError ? (
                <p className="text-sm text-rose-700">{availability.error?.message}</p>
              ) : unavailable ? (
                <div>
                  <p className="text-sm font-semibold text-rose-700">The guide is unavailable on these dates.</p>
                  <p className="mt-1 text-xs text-slate-500">Blocked: {blockedDates.map((date) => formatDate(date)).join(', ')}</p>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  Available {formatDateRange(trip.startDate, trip.endDate)} · {days} day{days > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </section>

          <ReviewList summary={reviews.summary} meta={reviews.meta} onPageChange={reviews.changePage} title={`Reviews for ${name}`} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Guide estimate</p>
            <p className="mt-1 text-3xl font-extrabold text-ink-900">{formatCurrency(estimate)}</p>
            <p className="text-xs text-slate-500">
              {hours && data.hourlyRate ? `${formatCurrency(data.hourlyRate)} × ${hours} hours` : `${formatCurrency(data.dailyRate)} per day`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Adults</span>
                <select className="input" value={trip.adults} onChange={(event) => setTrip({ ...trip, adults: Number(event.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Children</span>
                <select className="input" value={trip.children} onChange={(event) => setTrip({ ...trip, children: Number(event.target.value) })}>
                  {[0, 1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
            </div>

            {data.hourlyRate ? (
              <Input
                label="Hours (optional)"
                type="number"
                min="1"
                max="24"
                placeholder="Full days if empty"
                value={trip.hours}
                onChange={(event) => setTrip({ ...trip, hours: event.target.value })}
                wrapperClassName="mt-3"
                hint="Leave empty for the daily rate."
              />
            ) : null}

            <Button className="mt-4 w-full" onClick={beginBooking} disabled={!validRange || Boolean(unavailable)}>
              {auth.isAuthenticated ? 'Request this guide' : 'Sign in to book'}
            </Button>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-slate-500">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary-500" aria-hidden="true" />
              The server recalculates the guide fee from the published daily or hourly rate.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Compass className="h-4 w-4 text-primary-600" aria-hidden="true" /> Service areas
            </h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(data.serviceLocations || []).map((location) => (
                <span key={location} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {location}
                </span>
              ))}
            </div>
            {data.provider?.phone && <p className="mt-4 text-xs text-slate-500">Coordinator: {data.provider.phone}</p>}
          </div>
        </aside>
      </div>

      <ContactBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        payload={payload}
        title="Confirm traveller details"
        summary={`${name} · ${formatDateRange(trip.startDate, trip.endDate)} · ${trip.adults + trip.children} traveller${trip.adults + trip.children > 1 ? 's' : ''}`}
        onCreated={(booking) => navigate(`/account/bookings/${booking.reference}`)}
      />
    </>
  );
}
