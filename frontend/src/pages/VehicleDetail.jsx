import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Car, CheckCircle2, Gauge, MapPin, Route, Users } from 'lucide-react';
import { api, readData } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Rating from '../components/ui/Rating';
import SmartImage from '../components/ui/SmartImage';
import { Input } from '../components/ui/Field';
import ContactBookingModal from '../components/booking/ContactBookingModal';
import { addDaysISO, formatCurrency, formatDate, formatDateRange, pluralize, todayISO } from '../lib/format';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  const today = todayISO();
  const [trip, setTrip] = useState({
    startDate: addDaysISO(today, 1),
    endDate: addDaysISO(today, 3),
    adults: 2,
    children: 0,
    distanceKm: '',
  });
  const [bookingOpen, setBookingOpen] = useState(false);

  const vehicle = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => readData(api.get(`/vehicles/${id}`)),
  });

  const validRange = Boolean(trip.startDate && trip.endDate && trip.endDate > trip.startDate);
  const availability = useQuery({
    queryKey: ['vehicle', id, 'availability', trip.startDate, trip.endDate],
    queryFn: () =>
      readData(api.get(`/vehicles/${id}/availability`, { params: { startDate: trip.startDate, endDate: trip.endDate } })),
    enabled: Boolean(id) && validRange,
  });

  const travellers = Number(trip.adults) + Number(trip.children);

  const estimate = useMemo(() => {
    if (!vehicle.data) return 0;
    const days = Math.max(1, Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000));
    const perDay = Number(vehicle.data.pricePerDay || 0);
    const perKm = Number(vehicle.data.pricePerKm || 0);
    const distance = Number(trip.distanceKm || 0);
    if (perKm && distance > 0) return perDay * days + perKm * distance;
    if (perDay) return perDay * days;
    return 0;
  }, [vehicle.data, trip]);

  if (vehicle.isLoading) return <PageLoader label="Loading vehicle…" />;
  if (vehicle.isError || !vehicle.data) {
    return (
      <div className="container-page py-20">
        <EmptyState
          title="Vehicle not found"
          description={vehicle.error?.message}
          action={<Button as={Link} to="/transport" variant="outline">Browse transport</Button>}
        />
      </div>
    );
  }

  const data = vehicle.data;
  const seatsShort = travellers > data.capacity;
  const unavailable = validRange && availability.data && !availability.data.available;
  const blockedDates = availability.data?.blockedDates || [];
  const needsDistance = !data.pricePerDay && data.pricePerKm;

  function beginBooking() {
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: `/transport/${id}` } });
      return;
    }
    if (!validRange || seatsShort || unavailable) return;
    setBookingOpen(true);
  }

  const payload = {
    type: 'TRANSPORT',
    composition: {
      adults: Number(trip.adults),
      children: Number(trip.children),
      transport: {
        vehicleId: data.id,
        startDate: trip.startDate,
        endDate: trip.endDate,
        ...(trip.distanceKm ? { distanceKm: Number(trip.distanceKm) } : {}),
      },
    },
  };

  return (
    <>
      <section className="relative">
        <SmartImage src={data.image} alt={data.name} wrapperClassName="h-[40vh] min-h-[280px] w-full" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/30 to-transparent" aria-hidden="true" />
        <div className="container-page absolute inset-x-0 bottom-0 pb-8">
          <Link to="/transport" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> All transport
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-white">
            {data.category && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
                <Car className="h-3.5 w-3.5" aria-hidden="true" /> {data.category.name}
              </span>
            )}
            <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
              {pluralize(data.capacity, 'seat')}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
              {data.driverIncluded ? 'Driver included' : 'Self drive'}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-5xl">{data.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-200">
            {data.provider?.businessName || 'Verified operator'}
            {data.model ? <span className="text-slate-300">· {data.model}</span> : null}
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-900">About this vehicle</h2>
                {data.provider?.description && <p className="mt-1 text-xs font-medium text-slate-500">Operated by {data.provider.businessName}</p>}
              </div>
              <Rating value={data.rating?.average} count={data.rating?.count} />
            </div>
            <p className="prose-pothik mt-3">
              {data.provider?.description || `${data.name} is maintained by ${data.provider?.businessName || 'an approved POTHIK operator'} and seats ${data.capacity} passengers.`}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> Capacity
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{pluralize(data.capacity, 'passenger')}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Daily rate
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(data.pricePerDay)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <Route className="h-3.5 w-3.5" aria-hidden="true" /> Per km
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{data.pricePerKm ? formatCurrency(data.pricePerKm) : 'Included'}</p>
              </div>
            </div>
            {data.features?.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {data.features.map((feature) => (
                  <span key={feature} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {feature}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Availability</h2>
                <p className="mt-1 text-xs text-slate-500">Pickup on the start date, return on the end date.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Start date" type="date" min={today} value={trip.startDate} onChange={(event) => {
                  const startDate = event.target.value;
                  setTrip((current) => ({ ...current, startDate, endDate: current.endDate <= startDate ? addDaysISO(startDate, 1) : current.endDate }));
                }} wrapperClassName="w-36" />
                <Input label="End date" type="date" min={addDaysISO(trip.startDate, 1)} value={trip.endDate} onChange={(event) => setTrip({ ...trip, endDate: event.target.value })} wrapperClassName="w-36" />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 px-4 py-4">
              {!validRange ? (
                <p className="text-sm text-amber-700">The return date must be after the pickup date.</p>
              ) : availability.isLoading ? (
                <p className="text-sm text-slate-500">Checking the operator calendar…</p>
              ) : availability.isError ? (
                <p className="text-sm text-rose-700">{availability.error?.message}</p>
              ) : unavailable ? (
                <div>
                  <p className="text-sm font-semibold text-rose-700">Not available on these dates.</p>
                  <p className="mt-1 text-xs text-slate-500">Blocked: {blockedDates.map((date) => formatDate(date)).join(', ')}</p>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Available {formatDateRange(trip.startDate, trip.endDate)}
                </p>
              )}
            </div>

            {data.provider && (
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" /> {data.provider.address || 'Dhaka, Bangladesh'}
                </span>
                {data.provider.phone && <span>Operator: {data.provider.phone}</span>}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Rental estimate</p>
            <p className="mt-1 text-3xl font-extrabold text-ink-900">{formatCurrency(estimate)}</p>
            <p className="text-xs text-slate-500">
              {data.pricePerDay ? `${formatCurrency(data.pricePerDay)} per day` : `${formatCurrency(data.pricePerKm)} per km`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Adults</span>
                <select className="input" value={trip.adults} onChange={(event) => setTrip({ ...trip, adults: Number(event.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20].map((count) => (
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

            {(data.pricePerKm || needsDistance) && (
              <Input
                label="Estimated distance (km)"
                type="number"
                min="0"
                placeholder="e.g. 320"
                value={trip.distanceKm}
                onChange={(event) => setTrip({ ...trip, distanceKm: event.target.value })}
                wrapperClassName="mt-3"
              />
            )}

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Travellers</span>
                <span className={`font-semibold ${seatsShort ? 'text-rose-600' : 'text-slate-800'}`}>
                  {travellers} / {data.capacity} seats
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Dates</span>
                <span className="font-semibold text-slate-800">{validRange ? formatDateRange(trip.startDate, trip.endDate) : '—'}</span>
              </div>
              {availability.data && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Operator calendar</span>
                  <Badge tone={availability.data.available ? 'emerald' : 'rose'} dot>
                    {availability.data.available ? 'Open' : 'Blocked'}
                  </Badge>
                </div>
              )}
            </div>

            {seatsShort && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This vehicle seats {data.capacity}. Reduce travellers or choose a larger vehicle.
              </p>
            )}
            {needsDistance && !Number(trip.distanceKm) && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This vehicle is priced per kilometre — add an estimated distance.
              </p>
            )}

            <Button
              className="mt-4 w-full"
              onClick={beginBooking}
              disabled={!validRange || seatsShort || Boolean(unavailable) || (needsDistance && !Number(trip.distanceKm))}
            >
              {auth.isAuthenticated ? 'Request this vehicle' : 'Sign in to book'}
            </Button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
              Final rental price is calculated by the server from the published rates.
            </p>
          </div>
        </aside>
      </div>

      <ContactBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        payload={payload}
        title="Confirm booking details"
        summary={`${data.name} · ${formatDateRange(trip.startDate, trip.endDate)} · ${pluralize(travellers, 'traveller')}`}
        onCreated={(booking) => navigate(`/account/bookings/${booking.reference}`)}
      />
    </>
  );
}
