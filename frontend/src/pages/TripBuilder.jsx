import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Car,
  Check,
  Compass,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { api, readData, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/ToastProvider';
import { addDaysISO, formatCurrency, formatDate, formatDateRange, nightsBetween, todayISO } from '../lib/format';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import SmartImage from '../components/ui/SmartImage';
import { Input, Textarea } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/ui/Spinner';

const DRAFT_KEY = 'pothik_trip_draft';

const STEPS = [
  { key: 'destinations', label: 'Destinations', icon: MapPin },
  { key: 'dates', label: 'Dates', icon: CalendarDays },
  { key: 'hotel', label: 'Hotel', icon: BedDouble },
  { key: 'transport', label: 'Transport', icon: Car },
  { key: 'guide', label: 'Guide', icon: Compass },
  { key: 'addons', label: 'Add-ons', icon: Sparkles },
  { key: 'review', label: 'Review', icon: Check },
  { key: 'quote', label: 'Quotation', icon: ReceiptText },
  { key: 'book', label: 'Book', icon: Users },
];

function defaultDraft(params) {
  const today = todayISO();
  const startDate = params.get('startDate') || addDaysISO(today, 7);
  const endDate = params.get('endDate') || addDaysISO(startDate, 3);
  return {
    step: 1,
    destinations: [],
    spots: {},
    startDate,
    endDate,
    adults: Number(params.get('adults')) || 2,
    children: 0,
    hotel: null,
    transport: null,
    guide: null,
    addons: {},
    specialRequests: '',
    couponCode: '',
  };
}

function loadDraft(params) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    if (stored && typeof stored === 'object' && stored.startDate) {
      return { ...defaultDraft(params), ...stored };
    }
  } catch {
    /* ignore malformed drafts */
  }
  const initial = defaultDraft(params);
  const preselectedId = Number(params.get('destinationId'));
  if (preselectedId) {
    initial.destinations = [
      {
        id: preselectedId,
        slug: params.get('destinationSlug') || '',
        name: params.get('destinationName') || 'Selected destination',
      },
    ];
  }
  return initial;
}

function OptionCard({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition',
        active ? 'border-primary-500 bg-primary-50/50 ring-1 ring-primary-400' : 'border-slate-200 bg-white hover:border-primary-300',
        className
      )}
    >
      {children}
    </button>
  );
}

function StepHeader({ step }) {
  const meta = STEPS[step - 1];
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-700">
        <meta.icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-600">Step {step} of {STEPS.length}</p>
        <h2 className="text-lg font-bold text-ink-900">{meta.label}</h2>
      </div>
    </div>
  );
}

export default function TripBuilder() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [draft, setDraft] = useState(() => loadDraft(params));
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [booking, setBooking] = useState(false);
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });

  const step = Math.min(Math.max(draft.step || 1, 1), STEPS.length);

  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    setContact({
      name: auth.user?.name || '',
      phone: auth.user?.phone || '',
      email: auth.user?.email || '',
    });
  }, [auth.user]);

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated && draft.step > 7) {
      setDraft((current) => ({ ...current, step: 7 }));
    }
  }, [auth.loading, auth.isAuthenticated, draft.step]);

  const nights = nightsBetween(draft.startDate, draft.endDate);
  const travellers = Number(draft.adults) + Number(draft.children);
  const canQuote = Boolean(draft.hotel || draft.transport || draft.guide || Object.values(draft.addons).some((quantity) => quantity > 0));

  const destinationsQuery = useQuery({
    queryKey: ['trip', 'destinations'],
    queryFn: () => readData(api.get('/destinations', { params: { limit: 50, sort: 'popular' } })),
    staleTime: 10 * 60 * 1000,
  });

  const destinationDetails = useQueries({
    queries: draft.destinations.map((destination) => ({
      queryKey: ['trip', 'destination-detail', destination.slug],
      queryFn: () => readData(api.get(`/destinations/${destination.slug}`)),
      enabled: Boolean(destination.slug),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const destinationSlug = draft.destinations[0]?.slug;
  const destinationName = draft.destinations[0]?.name;

  const hotelsQuery = useQuery({
    queryKey: ['trip', 'hotels', destinationSlug],
    queryFn: () => readData(api.get('/hotels', { params: { limit: 8, sort: 'rating', ...(destinationSlug ? { destination: destinationSlug } : {}) } })),
    enabled: step === 3,
  });

  const selectedHotelQuery = useQuery({
    queryKey: ['trip', 'hotel', draft.hotel?.slug],
    queryFn: () => readData(api.get(`/hotels/${draft.hotel.slug}`)),
    enabled: Boolean(draft.hotel?.slug),
  });

  const hotelAvailability = useQuery({
    queryKey: ['trip', 'hotel-availability', draft.hotel?.slug, draft.startDate, draft.endDate],
    queryFn: () =>
      readData(
        api.get(`/hotels/${draft.hotel.slug}/availability`, {
          params: { checkIn: draft.startDate, checkOut: draft.endDate, rooms: 1 },
        })
      ),
    enabled: Boolean(draft.hotel?.slug) && nights > 0,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['trip', 'vehicles', travellers],
    queryFn: () => readData(api.get('/vehicles', { params: { limit: 12, minCapacity: travellers, sort: 'price_asc' } })),
    enabled: step === 4,
  });

  const vehicleAvailability = useQuery({
    queryKey: ['trip', 'vehicle-availability', draft.transport?.id, draft.startDate, draft.endDate],
    queryFn: () =>
      readData(
        api.get(`/vehicles/${draft.transport.id}/availability`, {
          params: { startDate: draft.startDate, endDate: draft.endDate },
        })
      ),
    enabled: Boolean(draft.transport?.id) && nights > 0,
  });

  const guidesQuery = useQuery({
    queryKey: ['trip', 'guides', destinationName],
    queryFn: () => readData(api.get('/guides', { params: { limit: 9, sort: 'rating', ...(destinationName ? { location: destinationName } : {}) } })),
    enabled: step === 5,
  });

  const guideAvailability = useQuery({
    queryKey: ['trip', 'guide-availability', draft.guide?.id, draft.startDate, draft.endDate],
    queryFn: () =>
      readData(
        api.get(`/guides/${draft.guide.id}/availability`, {
          params: { startDate: draft.startDate, endDate: draft.endDate },
        })
      ),
    enabled: Boolean(draft.guide?.id) && nights >= 0,
  });

  const addonsQuery = useQuery({
    queryKey: ['trip', 'addons'],
    queryFn: () => readData(api.get('/trips/addons')),
    enabled: step === 6,
    staleTime: 30 * 60 * 1000,
  });

  const composition = useMemo(() => {
    const rows = {
      startDate: draft.startDate,
      endDate: draft.endDate,
      adults: Number(draft.adults),
      children: Number(draft.children),
    };
    if (draft.destinations.length) {
      rows.destinations = draft.destinations.map((destination) => ({
        destinationId: Number(destination.id),
        ...(draft.spots[destination.id]?.length ? { touristSpotIds: draft.spots[destination.id] } : {}),
      }));
    }
    if (draft.hotel) {
      rows.hotel = {
        hotelId: Number(draft.hotel.id),
        checkIn: draft.startDate,
        checkOut: draft.endDate,
        rooms: [{ roomId: Number(draft.hotel.roomId), units: Number(draft.hotel.units || 1) }],
      };
    }
    if (draft.transport) {
      rows.transport = {
        vehicleId: Number(draft.transport.id),
        startDate: draft.startDate,
        endDate: draft.endDate,
      };
    }
    if (draft.guide) {
      rows.guide = {
        guideId: Number(draft.guide.id),
        startDate: draft.startDate,
        endDate: draft.endDate,
      };
    }
    const addons = Object.entries(draft.addons)
      .filter(([, quantity]) => quantity > 0)
      .map(([code, quantity]) => ({ code, quantity: Number(quantity) }));
    if (addons.length) rows.addons = addons;
    if (draft.specialRequests.trim()) rows.specialRequests = draft.specialRequests.trim();
    return rows;
  }, [draft]);

  function go(next) {
    setQuoteError('');
    setDraft((current) => ({ ...current, step: next }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function requestQuote(code = draft.couponCode) {
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: '/plan' } });
      return;
    }
    setQuoting(true);
    setQuoteError('');
    try {
      const data = await readData(api.post('/trips/quote', { composition, couponCode: code || undefined }));
      setQuote(data);
      setDraft((current) => ({ ...current, step: 8, couponCode: code }));
    } catch (error) {
      setQuoteError(errorMessage(error));
    } finally {
      setQuoting(false);
    }
  }

  async function createBooking(event) {
    event.preventDefault();
    if (!quote) return;
    setBooking(true);
    try {
      const created = await readData(
        api.post('/bookings', {
          type: 'CUSTOM_TRIP',
          composition,
          contact,
          ...(quote.coupon?.code ? { couponCode: quote.coupon.code } : {}),
        })
      );
      sessionStorage.removeItem(DRAFT_KEY);
      toast.success(`Trip ${created.reference} created. Providers will confirm each service.`);
      navigate(`/account/bookings/${created.reference}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBooking(false);
    }
  }

  function toggleDestination(destination) {
    setDraft((current) => {
      const exists = current.destinations.some((row) => row.id === destination.id);
      if (exists) {
        return { ...current, destinations: current.destinations.filter((row) => row.id !== destination.id) };
      }
      if (current.destinations.length >= 3) return current;
      return { ...current, destinations: [...current.destinations, { id: destination.id, slug: destination.slug, name: destination.name }] };
    });
    setQuote(null);
  }

  function toggleSpot(destinationId, spotId) {
    setDraft((current) => {
      const ids = current.spots[destinationId] || [];
      const next = ids.includes(spotId) ? ids.filter((id) => id !== spotId) : [...ids, spotId];
      return { ...current, spots: { ...current.spots, [destinationId]: next } };
    });
  }

  function chooseRoom(room) {
    setDraft((current) => ({
      ...current,
      hotel: {
        id: current.hotel?.id || selectedHotelQuery.data?.id,
        slug: current.hotel?.slug,
        name: current.hotel?.name,
        roomId: room.id,
        roomName: room.name,
        units: current.hotel?.roomId === room.id ? current.hotel.units || 1 : 1,
      },
    }));
    setQuote(null);
  }

  function selectHotel(hotel) {
    setDraft((current) => ({ ...current, hotel: { id: hotel.id, slug: hotel.slug, name: hotel.name, roomId: null } }));
    setQuote(null);
  }

  function selectVehicle(vehicle) {
    setDraft((current) => ({
      ...current,
      transport: current.transport?.id === vehicle.id ? null : { id: vehicle.id, name: vehicle.name },
    }));
    setQuote(null);
  }

  function selectGuide(guide) {
    setDraft((current) => ({
      ...current,
      guide: current.guide?.id === guide.id ? null : { id: guide.id, name: guide.provider?.businessName || 'Local guide' },
    }));
    setQuote(null);
  }

  function setAddon(code, quantity) {
    setDraft((current) => ({ ...current, addons: { ...current.addons, [code]: Math.max(0, Math.min(10, quantity)) } }));
    setQuote(null);
  }

  const hotelRooms = selectedHotelQuery.data?.rooms || [];
  const liveRooms = new Map((hotelAvailability.data?.rooms || []).map((row) => [row.roomId, row]));

  function renderStep() {
    if (step === 1) {
      const items = destinationsQuery.data?.items || [];
      return (
        <>
          <StepHeader step={1} />
          <p className="mt-2 text-sm leading-6 text-slate-600">Pick up to three destinations. This shapes hotel and guide suggestions, but you can skip it and add services directly.</p>
          {destinationsQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading destinations…</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((destination) => {
                const active = draft.destinations.some((row) => row.id === destination.id);
                return (
                  <OptionCard key={destination.id} active={active} onClick={() => toggleDestination(destination)}>
                    <SmartImage src={destination.coverImage} alt={destination.name} wrapperClassName="h-16 w-16 shrink-0 rounded-xl" className="h-16 w-16 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-ink-900">{destination.name}</span>
                        {active && <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">{destination.summary}</span>
                    </span>
                  </OptionCard>
                );
              })}
            </div>
          )}

          {draft.destinations.length > 0 && (
            <div className="mt-6 space-y-4">
              {draft.destinations.map((destination, index) => {
                const detail = destinationDetails[index]?.data;
                const chosen = draft.spots[destination.id] || [];
                return (
                  <div key={destination.id} className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-bold text-ink-900">{destination.name} · optional stops</p>
                    {destinationDetails[index]?.isLoading && <p className="mt-2 text-xs text-slate-500">Loading attractions…</p>}
                    {!destinationDetails[index]?.isLoading && !detail?.touristSpots?.length && (
                      <p className="mt-2 text-xs text-slate-500">No listed attractions for this destination.</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(detail?.touristSpots || []).map((spot) => (
                        <button
                          key={spot.id}
                          type="button"
                          onClick={() => toggleSpot(destination.id, spot.id)}
                          className={clsx(
                            'rounded-full border px-3 py-1 text-xs font-semibold transition',
                            chosen.includes(spot.id)
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-slate-200 text-slate-600 hover:border-primary-300'
                          )}
                        >
                          {spot.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <StepHeader step={2} />
          <p className="mt-2 text-sm leading-6 text-slate-600">The server derives the travel window from your dates. Hotels and transport are held against these dates.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Start date"
              type="date"
              min={todayISO()}
              value={draft.startDate}
              onChange={(event) => {
                const startDate = event.target.value;
                setDraft((current) => ({
                  ...current,
                  startDate,
                  endDate: current.endDate <= startDate ? addDaysISO(startDate, 2) : current.endDate,
                }));
                setQuote(null);
              }}
              required
            />
            <Input
              label="End date"
              type="date"
              min={addDaysISO(draft.startDate, 1)}
              value={draft.endDate}
              onChange={(event) => {
                setDraft((current) => ({ ...current, endDate: event.target.value }));
                setQuote(null);
              }}
              required
            />
            <label className="block">
              <span className="label">Adults</span>
              <select className="input" value={draft.adults} onChange={(event) => { setDraft((current) => ({ ...current, adults: Number(event.target.value) })); setQuote(null); }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Children</span>
              <select className="input" value={draft.children} onChange={(event) => { setDraft((current) => ({ ...current, children: Number(event.target.value) })); setQuote(null); }}>
                {[0, 1, 2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {nights > 0 ? (
              <span>
                {formatDateRange(draft.startDate, draft.endDate)} · {nights} night{nights > 1 ? 's' : ''} · {travellers} traveller{travellers > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-amber-700">The end date must be after the start date.</span>
            )}
          </div>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <StepHeader step={3} />
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {destinationSlug ? `Stays in ${destinationName}.` : 'All published hotels.'} Rooms are checked against live inventory for {formatDateRange(draft.startDate, draft.endDate)}.
          </p>
          {nights <= 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Set a valid date range before choosing a room.</p>}
          {hotelsQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading hotels…</p>
          ) : hotelsQuery.data?.items?.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {hotelsQuery.data.items.map((hotel) => (
                <OptionCard key={hotel.id} active={draft.hotel?.id === hotel.id} onClick={() => selectHotel(hotel)}>
                  <SmartImage src={hotel.image} alt={hotel.name} wrapperClassName="h-16 w-20 shrink-0 rounded-xl" className="h-16 w-20 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink-900">{hotel.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{hotel.starRating || 3}-star · {formatCurrency(hotel.minPrice)} / night</span>
                  </span>
                </OptionCard>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">No hotels listed for this destination. You can skip this step.</p>
          )}

          {draft.hotel && (
            <div className="mt-6 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink-900">Rooms at {draft.hotel.name}</p>
                {hotelAvailability.isFetching && <span className="text-xs text-slate-500">Checking inventory…</span>}
              </div>
              {selectedHotelQuery.isLoading ? (
                <p className="mt-2 text-xs text-slate-500">Loading rooms…</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {hotelRooms.map((room) => {
                    const live = liveRooms.get(room.id);
                    const soldOut = live ? !live.available : false;
                    const stayTotal = live?.stayTotal ?? Number(room.basePrice) * Math.max(nights, 1);
                    return (
                      <div
                        key={room.id}
                        className={clsx(
                          'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3',
                          draft.hotel.roomId === room.id ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200',
                          soldOut && 'opacity-60'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{room.name}</p>
                          <p className="text-xs text-slate-500">
                            Sleeps {room.capacityAdults} adults · {soldOut ? 'sold out' : live ? `${live.remainingUnits} left` : `${room.totalUnits} units`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-ink-900">{formatCurrency(stayTotal)}</span>
                          {draft.hotel.roomId === room.id ? (
                            <select
                              aria-label="Room units"
                              className="input w-24 py-1 text-xs"
                              value={draft.hotel.units || 1}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  hotel: { ...current.hotel, units: Number(event.target.value) },
                                }))
                              }
                            >
                              {Array.from({ length: Math.max(1, Math.min(live?.remainingUnits || room.totalUnits || 1, 5)) }).map((_, index) => (
                                <option key={index + 1} value={index + 1}>{index + 1} room{index > 0 ? 's' : ''}</option>
                              ))}
                            </select>
                          ) : (
                            <Button size="sm" variant="outline" disabled={soldOut || nights <= 0} onClick={() => chooseRoom(room)}>
                              Select
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button type="button" className="mt-3 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline" onClick={() => setDraft((current) => ({ ...current, hotel: null }))}>
                Remove stay
              </button>
            </div>
          )}
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          <StepHeader step={4} />
          <p className="mt-2 text-sm leading-6 text-slate-600">Vehicles are filtered to your group size ({travellers} travellers). Rental days follow pickup → return.</p>
          {vehiclesQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading vehicles…</p>
          ) : vehiclesQuery.data?.items?.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {vehiclesQuery.data.items.map((vehicle) => {
                const active = draft.transport?.id === vehicle.id;
                const blocked = active && vehicleAvailability.data && !vehicleAvailability.data.available;
                return (
                  <OptionCard key={vehicle.id} active={active} onClick={() => selectVehicle(vehicle)}>
                    <SmartImage src={vehicle.image} alt={vehicle.name} wrapperClassName="h-16 w-20 shrink-0 rounded-xl" className="h-16 w-20 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">{vehicle.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {vehicle.capacity} seats · {formatCurrency(vehicle.pricePerDay)} / day
                        {vehicle.provider?.businessName ? ` · ${vehicle.provider.businessName}` : ''}
                      </span>
                      {active && (
                        <span className="mt-1 block text-[11px] font-semibold">
                          {vehicleAvailability.isFetching ? (
                            <span className="text-slate-500">Checking calendar…</span>
                          ) : blocked ? (
                            <span className="text-rose-600">Blocked on these dates</span>
                          ) : vehicleAvailability.data ? (
                            <span className="text-emerald-600">Available for your dates</span>
                          ) : null}
                        </span>
                      )}
                    </span>
                  </OptionCard>
                );
              })}
            </div>
          ) : (
            <EmptyState className="mt-5" icon={Car} title="No vehicles for this group size" description="Reduce travellers or skip transport and arrange it later." />
          )}
          {draft.transport && (
            <button type="button" className="mt-4 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline" onClick={() => setDraft((current) => ({ ...current, transport: null }))}>
              Remove transport
            </button>
          )}
        </>
      );
    }

    if (step === 5) {
      return (
        <>
          <StepHeader step={5} />
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {destinationName ? `Guides who work around ${destinationName}.` : 'All approved guides.'} Daily rates apply to {formatDateRange(draft.startDate, draft.endDate)}.
          </p>
          {guidesQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading guides…</p>
          ) : guidesQuery.data?.items?.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {guidesQuery.data.items.map((guide) => {
                const active = draft.guide?.id === guide.id;
                const blocked = active && guideAvailability.data && !guideAvailability.data.available;
                return (
                  <OptionCard key={guide.id} active={active} onClick={() => selectGuide(guide)}>
                    <SmartImage src={guide.photo} alt={guide.provider?.businessName || 'Guide'} wrapperClassName="h-16 w-16 shrink-0 rounded-xl" className="h-16 w-16 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">{guide.provider?.businessName || 'Local guide'}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {formatCurrency(guide.dailyRate)} / day · {(guide.languages || []).slice(0, 3).join(', ')}
                      </span>
                      {active && (
                        <span className="mt-1 block text-[11px] font-semibold">
                          {guideAvailability.isFetching ? (
                            <span className="text-slate-500">Checking calendar…</span>
                          ) : blocked ? (
                            <span className="text-rose-600">Unavailable on these dates</span>
                          ) : guideAvailability.data ? (
                            <span className="text-emerald-600">Available for your dates</span>
                          ) : null}
                        </span>
                      )}
                    </span>
                  </OptionCard>
                );
              })}
            </div>
          ) : (
            <EmptyState className="mt-5" icon={Compass} title="No guides found here" description="Skip this step or browse all guides later." />
          )}
          {draft.guide && (
            <button type="button" className="mt-4 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline" onClick={() => setDraft((current) => ({ ...current, guide: null }))}>
              Remove guide
            </button>
          )}
        </>
      );
    }

    if (step === 6) {
      const addons = addonsQuery.data || [];
      return (
        <>
          <StepHeader step={6} />
          <p className="mt-2 text-sm leading-6 text-slate-600">Fixed-price platform services. Quantities are multiplied server-side.</p>
          {addonsQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading add-ons…</p>
          ) : (
            <div className="mt-5 space-y-2">
              {addons.map((addon) => {
                const quantity = draft.addons[addon.code] || 0;
                return (
                  <div key={addon.code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{addon.name}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(addon.price)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-primary-400" onClick={() => setAddon(addon.code, quantity - 1)} aria-label={`Remove one ${addon.name}`}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-slate-800">{quantity}</span>
                      <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-primary-400" onClick={() => setAddon(addon.code, quantity + 1)} aria-label={`Add one ${addon.name}`}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      );
    }

    if (step === 7) {
      return (
        <>
          <StepHeader step={7} />
          <p className="mt-2 text-sm leading-6 text-slate-600">Check the composition, then let the booking engine price it. You can go back and change anything.</p>

          <dl className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-slate-500">Destinations</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">
                {draft.destinations.length ? draft.destinations.map((row) => row.name).join(' · ') : 'Not selected'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-slate-500">Dates</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">
                {formatDateRange(draft.startDate, draft.endDate)} · {travellers} traveller{travellers > 1 ? 's' : ''}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-slate-500">Hotel</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">
                {draft.hotel?.roomId ? `${draft.hotel.name} · ${draft.hotel.roomName} × ${draft.hotel.units || 1}` : 'Not included'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-slate-500">Transport</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">{draft.transport?.name || 'Not included'}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-slate-500">Guide</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">{draft.guide?.name || 'Not included'}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-slate-500">Add-ons</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">
                {Object.values(draft.addons).some((quantity) => quantity > 0)
                  ? Object.entries(draft.addons).filter(([, quantity]) => quantity > 0).map(([code, quantity]) => `${code.replaceAll('_', ' ').toLowerCase()} × ${quantity}`).join(', ')
                  : 'None'}
              </dd>
            </div>
          </dl>

          <Textarea
            label="Special requests (optional)"
            className="mt-4"
            rows={3}
            maxLength={2000}
            value={draft.specialRequests}
            onChange={(event) => setDraft((current) => ({ ...current, specialRequests: event.target.value }))}
            placeholder="Dietary needs, accessible rooms, a slower pace…"
          />

          {!canQuote && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Add at least one hotel, vehicle, guide or add-on so the booking engine has something to price.
            </p>
          )}
          {quoteError && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{quoteError}</p>}
          {!auth.isAuthenticated && (
            <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              You need an account to see live quotations. Your draft is kept while you sign in.
            </p>
          )}
        </>
      );
    }

    if (step === 8) {
      if (!quote) {
        return (
          <>
            <StepHeader step={8} />
            <EmptyState
              className="mt-5"
              icon={ReceiptText}
              title="No quotation yet"
              description="Go back to the review step and request a quotation."
              action={<Button variant="outline" onClick={() => go(7)}>Back to review</Button>}
            />
          </>
        );
      }
      return (
        <>
          <StepHeader step={8} />
          <p className="mt-2 text-sm leading-6 text-slate-600">Calculated by the POTHIK booking engine from live inventory and published rates.</p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-head">Service</th>
                  <th className="table-head text-right">Qty</th>
                  <th className="table-head text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quote.items.map((item, index) => (
                  <tr key={`${item.itemType}-${item.refId || item.title}-${index}`}>
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      {item.startDate && (
                        <p className="text-[11px] text-slate-500">
                          {formatDate(item.startDate)} → {formatDate(item.endDate)}
                        </p>
                      )}
                    </td>
                    <td className="table-cell text-right">{item.quantity}</td>
                    <td className="table-cell text-right font-semibold">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Coupon code"
                value={draft.couponCode}
                onChange={(event) => setDraft((current) => ({ ...current, couponCode: event.target.value.toUpperCase() }))}
                placeholder="POTHIK10"
                hint={quote.coupon ? `${quote.coupon.code} applied` : 'Applied coupons are re-checked on the server.'}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                loading={quoting}
                disabled={!draft.couponCode.trim()}
                onClick={() => requestQuote(draft.couponCode.trim())}
              >
                <Tag className="h-3.5 w-3.5" /> Apply coupon
              </Button>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">{formatCurrency(quote.subtotal)}</span>
              </div>
              {Number(quote.discountTotal) > 0 && (
                <div className="flex justify-between py-1 text-emerald-700">
                  <span>Discount</span>
                  <span className="font-semibold">− {formatCurrency(quote.discountTotal)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-bold text-ink-900">Total payable</span>
                <span className="font-extrabold text-ink-900">{formatCurrency(quote.totalAmount)}</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">Prices are held when the booking is created and re-checked again at payment.</p>
            </div>
          </div>
          {quoteError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{quoteError}</p>}
        </>
      );
    }

    return (
      <>
        <StepHeader step={9} />
        <p className="mt-2 text-sm leading-6 text-slate-600">We create the booking and hold inventory while each provider confirms. Nothing is charged yet.</p>

        <form id="trip-booking-form" onSubmit={createBooking} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} required minLength={2} autoComplete="name" />
          <Input label="Phone" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} required placeholder="01XXXXXXXXX" autoComplete="tel" />
          <Input label="Email" type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} required autoComplete="email" wrapperClassName="sm:col-span-2" />
          <div className="sm:col-span-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {quote ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{formatDateRange(quote.startDate, quote.endDate)} · {quote.adults} adult{quote.adults > 1 ? 's' : ''}{quote.children ? ` · ${quote.children} children` : ''}</span>
                <span className="text-base font-extrabold text-ink-900">{formatCurrency(quote.totalAmount)}</span>
              </div>
            ) : (
              <span>No quotation available. Go back and request one.</span>
            )}
          </div>
          <Button type="submit" form="trip-booking-form" className="sm:col-span-2" loading={booking} disabled={!quote}>
            {booking ? 'Creating booking…' : 'Create booking'}
          </Button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Badge tone="emerald" dot>Server-priced</Badge>
          <span>You can pay from the booking page once providers confirm.</span>
        </div>
      </>
    );
  }

  if (auth.loading) return <PageLoader label="Checking your session…" />;

  return (
    <div className="bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="container-page py-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Custom trip</p>
          <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Build your Bangladesh trip</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Nine steps, one quotation. Every price is checked server-side before you book.</p>

          <ol className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Trip builder steps">
            {STEPS.map((entry, index) => {
              const number = index + 1;
              const done = number < step;
              const current = number === step;
              return (
                <li key={entry.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (number < step && (number !== 8 || quote)) setDraft((current) => ({ ...current, step: number }));
                    }}
                    disabled={number >= step || (number === 8 && !quote)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      current ? 'bg-primary-600 text-white' : done ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-400'
                    )}
                    aria-current={current ? 'step' : undefined}
                  >
                    <entry.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {entry.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_300px]">
        <div className="card p-6">{renderStep()}</div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Trip summary</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Dates</dt>
                <dd className="text-right font-semibold text-slate-800">{nights > 0 ? `${nights} night${nights > 1 ? 's' : ''}` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Travellers</dt>
                <dd className="font-semibold text-slate-800">{travellers}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Hotel</dt>
                <dd className="text-right font-semibold text-slate-800">{draft.hotel?.roomId ? 'Selected' : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Transport</dt>
                <dd className="text-right font-semibold text-slate-800">{draft.transport ? 'Selected' : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Guide</dt>
                <dd className="text-right font-semibold text-slate-800">{draft.guide ? 'Selected' : '—'}</dd>
              </div>
              {quote && (
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                  <dt className="text-slate-500">Quoted total</dt>
                  <dd className="font-extrabold text-ink-900">{formatCurrency(quote.totalAmount)}</dd>
                </div>
              )}
            </dl>
          </div>
          {draft.destinations.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Destinations</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {draft.destinations.map((destination) => (
                  <li key={destination.id} className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" /> {destination.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="px-1 text-[11px] leading-5 text-slate-400">Your draft is saved in this browser tab until you book.</p>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="container-page flex items-center justify-between gap-3 py-3">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? navigate('/') : go(step - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> {step === 1 ? 'Home' : 'Back'}
          </Button>
          <div className="flex items-center gap-2">
            {[3, 4, 5, 6].includes(step) && <span className="hidden text-xs text-slate-400 sm:inline">Optional step</span>}
            {step < 7 && (
              <Button
                onClick={() => go(step + 1)}
                disabled={step === 2 && nights <= 0}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 7 && (
              <Button onClick={() => requestQuote()} loading={quoting} disabled={!canQuote}>
                {auth.isAuthenticated ? 'Request quotation' : 'Sign in to quote'} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 8 && (
              <Button onClick={() => go(9)} disabled={!quote}>
                Traveller details <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 9 && (
              <Button type="submit" form="trip-booking-form" loading={booking} disabled={!quote}>
                Create booking
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
