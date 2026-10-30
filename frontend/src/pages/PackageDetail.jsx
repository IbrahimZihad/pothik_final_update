import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Sparkles, Users, XCircle } from 'lucide-react';
import { api, readData } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Rating from '../components/ui/Rating';
import SmartImage from '../components/ui/SmartImage';
import ReviewList from '../components/site/ReviewList';
import ContactBookingModal from '../components/booking/ContactBookingModal';
import { formatCurrency, formatDateRange, todayISO } from '../lib/format';

export default function PackageDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['package', slug],
    queryFn: () => readData(api.get(`/packages/${slug}`)),
  });

  const departures = useMemo(
    () => (data?.departures || []).filter((row) => row.startDate >= todayISO() && row.seatsLeft > 0),
    [data]
  );
  const [departureId, setDepartureId] = useState('');

  if (isLoading) return <PageLoader label="Loading package…" />;
  if (isError || !data) {
    return (
      <div className="container-page py-20">
        <EmptyState title="Package not found" description={error?.message} action={<Button as={Link} to="/packages" variant="outline">Browse packages</Button>} />
      </div>
    );
  }

  const selectedDeparture = departures.find((row) => String(row.id) === String(departureId)) || departures[0];
  const travellers = Number(adults) + Number(children);
  const seatsLeft = selectedDeparture?.seatsLeft ?? 0;
  const seatsShort = travellers > seatsLeft;
  const adultPrice = selectedDeparture?.price ?? data.pricePerPerson;
  const childPrice = data.childPrice ?? Math.round(adultPrice * 0.6);
  const estimated = adultPrice * Number(adults) + childPrice * Number(children);

  function startBooking() {
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: `/packages/${slug}` } });
      return;
    }
    if (!selectedDeparture) return;
    setBookingOpen(true);
  }

  const payload = selectedDeparture
    ? {
        type: 'PACKAGE',
        composition: {
          adults: Number(adults),
          children: Number(children),
          package: { packageId: data.id, departureId: selectedDeparture.id },
        },
      }
    : null;

  return (
    <>
      <section className="relative">
        <SmartImage src={data.coverImage} alt={data.title} wrapperClassName="h-[44vh] min-h-[300px] w-full" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/35 to-transparent" aria-hidden="true" />
        <div className="container-page absolute inset-x-0 bottom-0 pb-8">
          <Link to="/packages" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> All packages
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="primary" className="bg-white/95">
              {data.durationDays} days / {data.durationNights} nights
            </Badge>
            {data.destinations.map((destination) => (
              <Link key={destination.id} to={`/destinations/${destination.slug}`} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 hover:bg-white/25">
                {destination.name}
              </Link>
            ))}
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-extrabold text-white sm:text-5xl">{data.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-200">
            <Rating value={data.ratingAvg} count={data.ratingCount} className="[&_span]:text-white" />
            {data.operator && <span>Operated by {data.operator.name}</span>}
          </div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="text-lg font-bold text-ink-900">Trip overview</h2>
            <p className="prose-pothik mt-3 whitespace-pre-line">{data.description || data.summary}</p>
            {data.highlights?.length > 0 && (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {data.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm text-slate-700">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-secondary-500" aria-hidden="true" /> {highlight}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold text-ink-900">Day-by-day itinerary</h2>
            {data.itineraries?.length ? (
              <ol className="mt-4 space-y-4">
                {data.itineraries.map((day) => (
                  <li key={day.day} className="relative border-l-2 border-primary-100 pl-5">
                    <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white bg-primary-500" aria-hidden="true" />
                    <p className="text-xs font-bold uppercase tracking-wide text-primary-600">Day {day.day}</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{day.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{day.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                      {day.meals?.length > 0 && <span className="rounded bg-slate-100 px-2 py-0.5">Meals: {day.meals.join(', ')}</span>}
                      {day.accommodation && <span className="rounded bg-slate-100 px-2 py-0.5">Stay: {day.accommodation}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">An itinerary will be shared by the operator after confirmation.</p>
            )}
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Included
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(data.includes?.length ? data.includes : ['Accommodation as per itinerary', 'Listed transport']).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
                <XCircle className="h-5 w-5 text-rose-500" aria-hidden="true" /> Not included
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(data.excludes?.length ? data.excludes : ['Personal expenses', 'Travel insurance']).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold text-ink-900">Scheduled departures</h2>
            <div className="mt-4 space-y-2">
              {departures.length === 0 && <p className="text-sm text-slate-500">No open departures right now. Contact the operator or plan a custom trip.</p>}
              {departures.map((departure) => (
                <label
                  key={departure.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                    String(selectedDeparture?.id) === String(departure.id) ? 'border-primary-500 bg-primary-50/60' : 'border-slate-200 hover:border-primary-300'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="departure"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                      checked={String(selectedDeparture?.id) === String(departure.id)}
                      onChange={() => setDepartureId(String(departure.id))}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{formatDateRange(departure.startDate, departure.endDate)}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" /> {departure.seatsLeft} of {departure.capacity} seats left
                      </span>
                    </span>
                  </span>
                  <span className="text-sm font-bold text-ink-900">{formatCurrency(departure.price)}<span className="ml-1 text-xs font-medium text-slate-500">pp</span></span>
                </label>
              ))}
            </div>
            {data.cancellationPolicy && (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{data.cancellationPolicy}</p>
            )}
          </section>

          <ReviewList summary={data.reviews} title={`Reviews for ${data.title}`} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">From</p>
            <p className="mt-1 text-3xl font-extrabold text-ink-900">{formatCurrency(adultPrice)}</p>
            <p className="text-xs text-slate-500">per adult · child {formatCurrency(childPrice)}</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Adults</span>
                <select className="input" value={adults} onChange={(event) => setAdults(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Children</span>
                <select className="input" value={children} onChange={(event) => setChildren(Number(event.target.value))}>
                  {[0, 1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedDeparture ? (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <CalendarDays className="h-4 w-4 text-primary-600" aria-hidden="true" />
                  {formatDateRange(selectedDeparture.startDate, selectedDeparture.endDate)}
                </span>
                <span className="font-bold text-ink-900">{formatCurrency(estimated)}</span>
              </div>
            ) : null}

            {seatsShort && selectedDeparture && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Only {seatsLeft} seats remain on this departure. Reduce travellers or choose another date.
              </p>
            )}

            <Button className="mt-4 w-full" onClick={startBooking} disabled={!selectedDeparture || seatsShort}>
              {auth.isAuthenticated ? 'Reserve this departure' : 'Sign in to book'}
            </Button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
              Final price is recalculated by the server. Seats are held during provider confirmation.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <MapPin className="h-4 w-4 text-primary-600" aria-hidden="true" /> Destinations
            </h3>
            <ul className="mt-3 space-y-2">
              {data.destinations.map((destination) => (
                <li key={destination.id}>
                  <Link to={`/destinations/${destination.slug}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary-700">
                    <SmartImage src={destination.coverImage} alt="" wrapperClassName="h-9 w-9 rounded-lg" className="h-9 w-9 rounded-lg object-cover" />
                    {destination.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <ContactBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        payload={payload || {}}
        title="Confirm travellers for this departure"
        summary={
          selectedDeparture
            ? `${data.title} · ${formatDateRange(selectedDeparture.startDate, selectedDeparture.endDate)} · ${travellers} traveller${travellers > 1 ? 's' : ''}`
            : undefined
        }
        onCreated={(booking) => navigate(`/account/bookings/${booking.reference}`)}
      />
    </>
  );
}
