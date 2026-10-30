import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BedDouble, CheckCircle2, Clock, MapPin, Star, Utensils, Wifi } from 'lucide-react';
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
import { addDaysISO, formatCurrency, formatDate, nightsBetween, todayISO } from '../lib/format';

const FACILITY_ICONS = { wifi: Wifi, breakfast: Utensils, restaurant: Utensils };

export default function HotelDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  const today = todayISO();
  const [stay, setStay] = useState({ checkIn: addDaysISO(today, 1), checkOut: addDaysISO(today, 4), adults: 2, children: 0 });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [units, setUnits] = useState(1);
  const [bookingOpen, setBookingOpen] = useState(false);

  const hotel = useQuery({
    queryKey: ['hotel', slug],
    queryFn: () => readData(api.get(`/hotels/${slug}`)),
  });

  const hotelId = hotel.data?.id;
  const reviews = useQuery({
    queryKey: ['hotel', slug, 'reviews'],
    queryFn: () => readData(api.get('/reviews', { params: { targetType: 'HOTEL', targetId: hotelId, limit: 6 } })),
    enabled: Boolean(hotelId),
  });

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const availability = useQuery({
    queryKey: ['hotel', slug, 'availability', stay.checkIn, stay.checkOut],
    queryFn: () =>
      readData(api.get(`/hotels/${slug}/availability`, { params: { checkIn: stay.checkIn, checkOut: stay.checkOut, rooms: 1 } })),
    enabled: Boolean(slug) && nights > 0,
  });

  const rooms = useMemo(() => {
    const rows = hotel.data?.rooms || [];
    const availabilityById = new Map((availability.data?.rooms || []).map((row) => [row.roomId, row]));
    return rows.map((room) => {
      const live = availabilityById.get(room.id);
      return {
        ...room,
        available: live ? live.available : true,
        remainingUnits: live ? live.remainingUnits : room.totalUnits,
        stayTotal: live ? live.stayTotal : room.basePrice * Math.max(nights, 1),
      };
    });
  }, [hotel.data, availability.data, nights]);

  const reviewSummary = useMemo(() => {
    const rows = reviews.data?.items || [];
    const approved = rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      createdAt: row.created_at,
      verified: row.is_verified,
      providerReply: row.provider_reply,
      user: row.user ? { id: row.user.id, name: row.user.name } : null,
    }));
    const average = approved.length ? approved.reduce((sum, row) => sum + row.rating, 0) / approved.length : 0;
    return { average: Number(average.toFixed(2)), total: reviews.data?.meta?.total || approved.length, items: approved };
  }, [reviews.data]);

  if (hotel.isLoading) return <PageLoader label="Loading hotel…" />;
  if (hotel.isError || !hotel.data) {
    return (
      <div className="container-page py-20">
        <EmptyState title="Hotel not found" description={hotel.error?.message} action={<Button as={Link} to="/hotels" variant="outline">Browse hotels</Button>} />
      </div>
    );
  }

  const data = hotel.data;
  const chosen = rooms.find((room) => room.id === selectedRoom) || null;
  const estimated = chosen ? chosen.stayTotal * units : 0;
  const adultCapacity = chosen ? chosen.capacityAdults * units : 0;

  function beginBooking() {
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: `/hotels/${slug}` } });
      return;
    }
    if (!chosen) return;
    setBookingOpen(true);
  }

  const payload = chosen
    ? {
        type: 'HOTEL',
        composition: {
          adults: Number(stay.adults),
          children: Number(stay.children),
          hotel: {
            hotelId: data.id,
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            rooms: [{ roomId: chosen.id, units: Number(units) }],
          },
        },
      }
    : null;

  return (
    <>
      <section className="relative">
        <SmartImage src={data.image} alt={data.name} wrapperClassName="h-[42vh] min-h-[300px] w-full" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/30 to-transparent" aria-hidden="true" />
        <div className="container-page absolute inset-x-0 bottom-0 pb-8">
          <Link to="/hotels" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> All hotels
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-white">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden="true" /> {data.starRating || 3}-star
            </span>
            {data.destination && <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">{data.destination.name}</span>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-5xl">{data.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-200">
            <MapPin className="h-4 w-4" aria-hidden="true" /> {data.address || data.destination?.name}
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-900">About this stay</h2>
                {data.provider && <p className="mt-1 text-xs font-medium text-slate-500">Operated by {data.provider.businessName}</p>}
              </div>
              <Rating value={data.rating?.average} count={data.rating?.count} />
            </div>
            <p className="prose-pothik mt-3 whitespace-pre-line">{data.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(data.facilities || []).map((facility) => {
                const Icon = FACILITY_ICONS[facility.toLowerCase()] || CheckCircle2;
                return (
                  <span key={facility} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <Icon className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" /> {facility}
                  </span>
                );
              })}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Check-in / out
                </span>
                <p className="mt-1 font-semibold">{data.checkinTime || '14:00'} → {data.checkoutTime || '12:00'}</p>
              </div>
              {data.phone && (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Reception</span>
                  <p className="mt-1 font-semibold">{data.phone}</p>
                </div>
              )}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Rooms & availability</h2>
                <p className="mt-1 text-xs text-slate-500">Live inventory for your selected dates.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input label="Check-in" type="date" min={today} value={stay.checkIn} onChange={(event) => setStay({ ...stay, checkIn: event.target.value })} wrapperClassName="w-36" />
                <Input
                  label="Check-out"
                  type="date"
                  min={addDaysISO(stay.checkIn, 1)}
                  value={stay.checkOut}
                  onChange={(event) => setStay({ ...stay, checkOut: event.target.value })}
                  wrapperClassName="w-36"
                />
                <label className="block">
                  <span className="label">Guests</span>
                  <select className="input" value={stay.adults} onChange={(event) => setStay({ ...stay, adults: Number(event.target.value) })}>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
                      <option key={count} value={count}>{count} adults</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {nights > 0 && (
              <p className="mt-3 text-xs font-semibold text-primary-700">
                {nights} night{nights > 1 ? 's' : ''} · {formatDate(stay.checkIn)} → {formatDate(stay.checkOut)}
              </p>
            )}
            {nights <= 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Check-out must be after check-in.</p>}

            <div className="mt-5 space-y-4">
              {availability.isLoading && <p className="text-sm text-slate-500">Checking live availability…</p>}
              {availability.isError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{availability.error?.message}</p>
              )}
              {rooms.map((room) => {
                const disabled = !room.available || nights <= 0;
                const active = selectedRoom === room.id;
                return (
                  <div
                    key={room.id}
                    className={`rounded-2xl border p-4 transition ${active ? 'border-primary-500 bg-primary-50/40' : 'border-slate-200'} ${disabled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <SmartImage src={room.image} alt={room.name} wrapperClassName="h-36 w-full rounded-xl sm:w-48" className="h-36 w-full rounded-xl object-cover sm:w-48" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-ink-900">{room.name}</h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Sleeps {room.capacityAdults} adults{room.capacityChildren ? ` + ${room.capacityChildren} children` : ''} · {room.totalUnits} units
                            </p>
                          </div>
                          <Badge tone={room.available ? 'emerald' : 'rose'} dot>
                            {nights <= 0 ? 'Select dates' : room.available ? `${room.remainingUnits} left` : 'Sold out'}
                          </Badge>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-600">{room.description}</p>
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-base font-extrabold text-ink-900">{formatCurrency(room.stayTotal)}</p>
                            <p className="text-[11px] text-slate-500">total for {Math.max(nights, 1)} night{Math.max(nights, 1) > 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {active && (
                              <select
                                aria-label="Room units"
                                className="input w-24 py-1.5 text-xs"
                                value={units}
                                onChange={(event) => setUnits(Number(event.target.value))}
                              >
                                {Array.from({ length: Math.max(1, Math.min(room.remainingUnits, 5)) }).map((_, index) => (
                                  <option key={index + 1} value={index + 1}>
                                    {index + 1} room{index > 0 ? 's' : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            <Button
                              size="sm"
                              variant={active ? 'primary' : 'outline'}
                              disabled={disabled}
                              onClick={() => {
                                setSelectedRoom(room.id);
                                setUnits(1);
                              }}
                            >
                              {active ? 'Selected' : 'Select'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {data.gallery?.length > 0 && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.gallery.slice(0, 6).map((image) => (
                <SmartImage key={image} src={image} alt={data.name} wrapperClassName="h-36 w-full rounded-xl" className="h-36 w-full rounded-xl object-cover" />
              ))}
            </section>
          )}

          <ReviewList summary={reviewSummary} title={`Reviews for ${data.name}`} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Your stay</p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">{formatCurrency(estimated)}</p>
            <p className="text-xs text-slate-500">{chosen ? `${chosen.name} · ${units} room${units > 1 ? 's' : ''}` : 'Select a room to continue'}</p>

            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Nights</dt>
                <dd className="font-semibold text-slate-800">{Math.max(nights, 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Travellers</dt>
                <dd className="font-semibold text-slate-800">{stay.adults} adult{stay.adults > 1 ? 's' : ''}</dd>
              </div>
              {chosen && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Room capacity</dt>
                  <dd className={`font-semibold ${adultCapacity < stay.adults ? 'text-rose-600' : 'text-slate-800'}`}>
                    {adultCapacity < stay.adults ? `Sleeps ${adultCapacity} — add a room` : `${adultCapacity} adults`}
                  </dd>
                </div>
              )}
            </dl>

            <Button className="mt-4 w-full" onClick={beginBooking} disabled={!chosen || nights <= 0 || adultCapacity < stay.adults}>
              {auth.isAuthenticated ? 'Reserve this room' : 'Sign in to book'}
            </Button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
              Room rates and availability are verified by the server again when you book.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <BedDouble className="h-4 w-4 text-primary-600" aria-hidden="true" /> Good to know
            </h3>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
              <li>Free cancellation is governed by the booking cancellation policy.</li>
              <li>Room inventory is held while the hotel confirms your booking.</li>
              <li>Extra beds are charged by the property on arrival.</li>
            </ul>
          </div>
        </aside>
      </div>

      <ContactBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        payload={payload || {}}
        title="Confirm guest details"
        summary={
          chosen
            ? `${data.name} · ${chosen.name} · ${formatDate(stay.checkIn)} → ${formatDate(stay.checkOut)} · ${units} room${units > 1 ? 's' : ''}`
            : undefined
        }
        onCreated={(booking) => navigate(`/account/bookings/${booking.reference}`)}
      />
    </>
  );
}
