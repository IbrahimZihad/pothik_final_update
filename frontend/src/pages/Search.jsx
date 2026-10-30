import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Car, Compass, Hotel, MapPin, Plane, Search as SearchIcon } from 'lucide-react';
import { api, readData } from '../lib/api';
import SmartImage from '../components/ui/SmartImage';
import Rating from '../components/ui/Rating';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import { formatCurrency } from '../lib/format';

function Section({ title, icon: Icon, count, children }) {
  if (!count) return null;
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
        <Icon className="h-5 w-5 text-primary-600" aria-hidden="true" /> {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{count}</span>
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ResultLink({ to, image, title, meta, price, rating, count }) {
  return (
    <Link to={to} className="group card flex gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-float">
      <SmartImage src={image} alt={title} wrapperClassName="h-20 w-24 shrink-0 rounded-xl" className="h-20 w-24 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900 group-hover:text-primary-700">{title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{meta}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {price ? <span className="text-xs font-bold text-slate-800">{price}</span> : <span />}
          <Rating value={rating} count={count} />
        </div>
      </div>
    </Link>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') || '';
  const [term, setTerm] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);

  useEffect(() => {
    setTerm(initial);
    setSubmitted(initial);
  }, [initial]);

  const results = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => readData(api.get('/search', { params: { q: submitted } })),
    enabled: submitted.trim().length >= 2,
    retry: false,
  });

  function submit(event) {
    event.preventDefault();
    const value = term.trim();
    setParams(value ? { q: value } : {});
    setSubmitted(value);
  }

  const data = results.data;
  const total = data ? data.totals.destinations + data.totals.packages + data.totals.hotels + data.totals.guides : 0;

  return (
    <div className="container-page py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Search</p>
      <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Find a place, package or provider</h1>

      <form onSubmit={submit} className="mt-6 flex max-w-2xl gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className="input pl-9"
            placeholder="Cox's Bazar, Sundarbans, beach…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label="Search POTHIK"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {submitted.trim().length < 2 ? (
        <div className="mt-10">
          <EmptyState icon={SearchIcon} title="Start with at least two characters" description="Search destinations, packages, hotels or guides." />
        </div>
      ) : results.isLoading ? (
        <div className="mt-8">
          <CardSkeleton count={3} />
        </div>
      ) : results.isError ? (
        <div className="mt-8">
          <EmptyState icon={SearchIcon} title="Search unavailable" description={results.error?.message} />
        </div>
      ) : total === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={SearchIcon}
            title={`No results for “${data?.query || submitted}”`}
            description="Try a shorter phrase, a district name, or browse all packages."
            action={<Button as={Link} to="/destinations" variant="outline">Browse destinations</Button>}
          />
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm text-slate-500">
            {total} result{total === 1 ? '' : 's'} for <span className="font-semibold text-slate-800">“{data.query}”</span>
          </p>

          <Section title="Destinations" icon={MapPin} count={data.destinations.length}>
            {data.destinations.map((row) => (
              <ResultLink
                key={row.id}
                to={`/destinations/${row.slug}`}
                image={row.cover_image}
                title={row.name}
                meta={row.summary}
                rating={row.rating_avg}
              />
            ))}
          </Section>

          <Section title="Packages" icon={Plane} count={data.packages.length}>
            {data.packages.map((row) => (
              <ResultLink
                key={row.id}
                to={`/packages/${row.slug}`}
                image={row.cover_image}
                title={row.title}
                meta={`${row.duration_days} days`}
                price={`${formatCurrency(row.base_price_per_person)} pp`}
              />
            ))}
          </Section>

          <Section title="Hotels" icon={Hotel} count={data.hotels.length}>
            {data.hotels.map((row) => (
              <ResultLink
                key={row.id}
                to={`/hotels/${row.slug}`}
                image={row.image_url}
                title={row.name}
                meta={row.address || `${row.star_rating || 3}-star hotel`}
                rating={row.rating_avg}
              />
            ))}
          </Section>

          <Section title="Guides" icon={Compass} count={data.guides.length}>
            {data.guides.map((row) => (
              <ResultLink
                key={row.id}
                to={`/guides/${row.id}`}
                image={row.photo_url}
                title={row.provider?.business_name || 'Local guide'}
                meta={(row.service_locations || []).slice(0, 2).join(' · ') || (row.languages || []).join(', ')}
                price={`${formatCurrency(row.daily_rate)} / day`}
                rating={row.rating_avg}
              />
            ))}
          </Section>

          <div className="mt-10 flex flex-wrap gap-2">
            <Button as={Link} to="/packages" variant="outline" size="sm">All packages</Button>
            <Button as={Link} to="/hotels" variant="outline" size="sm">All hotels</Button>
            <Button as={Link} to="/transport" variant="outline" size="sm">
              <Car className="h-3.5 w-3.5" /> All transport
            </Button>
            <Button as={Link} to="/guides" variant="outline" size="sm">All guides</Button>
          </div>
        </>
      )}
    </div>
  );
}
