import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Clock, MapPin, Sparkles, Ticket, Trees } from 'lucide-react';
import { api, readData } from '../lib/api';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Rating from '../components/ui/Rating';
import SmartImage from '../components/ui/SmartImage';
import ReviewList from '../components/site/ReviewList';
import { PackageCard } from '../components/site/Cards';
import { formatCurrency, formatDate } from '../lib/format';

export default function DestinationDetail() {
  const { slug } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['destination', slug],
    queryFn: () => readData(api.get(`/destinations/${slug}`)),
  });

  if (isLoading) return <PageLoader label="Loading destination…" />;
  if (isError || !data) {
    return (
      <div className="container-page py-20">
        <EmptyState
          title="Destination not found"
          description={error?.message || 'This destination may have been archived.'}
          action={<Button as={Link} to="/destinations" variant="outline">Browse destinations</Button>}
        />
      </div>
    );
  }

  const planHref = `/plan?destinationId=${data.id}&destinationSlug=${data.slug}&destinationName=${encodeURIComponent(data.name)}`;

  return (
    <>
      <section className="relative">
        <SmartImage src={data.coverImage} alt={data.name} wrapperClassName="h-[46vh] min-h-[320px] w-full" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/40 to-transparent" aria-hidden="true" />
        <div className="container-page absolute inset-x-0 bottom-0 pb-8">
          <Link to="/destinations" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> All destinations
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {(data.district || data.category) && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                {[data.district?.name, data.district?.division, data.category?.name].filter(Boolean).join(' · ')}
              </span>
            )}
            <Rating value={data.ratingAvg} count={data.ratingCount} className="[&_span]:text-white" />
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-5xl">{data.name}</h1>
          {data.nameBn && <p className="mt-1 text-lg text-primary-100">{data.nameBn}</p>}
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">{data.summary}</p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="text-lg font-bold text-ink-900">About {data.name}</h2>
            <p className="prose-pothik mt-3 whitespace-pre-line">{data.description}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { icon: CalendarDays, label: 'Best season', value: data.bestSeason || 'Year round' },
                { icon: Clock, label: 'Suggested time', value: data.estimatedDurationHours ? `${data.estimatedDurationHours} hours` : 'Flexible' },
                { icon: Ticket, label: 'Entry fee', value: data.entryFee ? formatCurrency(data.entryFee) : 'Free' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <item.icon className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" /> {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {data.touristSpots?.length > 0 && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
                <Trees className="h-5 w-5 text-primary-600" aria-hidden="true" /> Places around {data.name}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {data.touristSpots.map((spot) => (
                  <div key={spot.id} className="overflow-hidden rounded-xl border border-slate-100">
                    <SmartImage src={spot.image} alt={spot.name} wrapperClassName="h-36 w-full" className="h-36 w-full object-cover" />
                    <div className="p-4">
                      <p className="text-sm font-bold text-slate-900">{spot.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{spot.description}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        {spot.durationHours ? `${spot.durationHours}h` : 'Flexible'} · {spot.entryFee ? formatCurrency(spot.entryFee) : 'No entry fee'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.travelInfo && (
            <section className="card p-6">
              <h2 className="text-lg font-bold text-ink-900">Getting there</h2>
              <p className="prose-pothik mt-3 whitespace-pre-line">{data.travelInfo}</p>
            </section>
          )}

          {data.packages?.length > 0 && (
            <section>
              <div className="flex items-end justify-between">
                <h2 className="text-lg font-bold text-ink-900">Packages including {data.name}</h2>
                <Link to="/packages" className="text-sm font-semibold text-primary-700 hover:underline">
                  All packages
                </Link>
              </div>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {data.packages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={{
                      ...pkg,
                      durationNights: Math.max(pkg.durationDays - 1, 0),
                      destinations: [data],
                      summary: data.summary,
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          <ReviewList summary={data.reviews} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">Plan around {data.name}</p>
            <h2 className="mt-2 text-lg font-bold text-ink-900">Build a custom trip</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add a hotel, vehicle and local guide for these dates. All prices are calculated server-side before you book.
            </p>
            <Button as={Link} to={planHref} className="mt-4 w-full">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Start planning
            </Button>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {data.district?.name || 'Bangladesh'}
            </div>
          </div>
          <div className="card p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quick facts</p>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Best season</dt>
                <dd className="font-semibold text-slate-800">{data.bestSeason || 'Year round'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Entry fee</dt>
                <dd className="font-semibold text-slate-800">{data.entryFee ? formatCurrency(data.entryFee) : 'Free'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Last reviewed</dt>
                <dd className="font-semibold text-slate-800">{formatDate(data.updatedAt || new Date())}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
