import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch, Search } from 'lucide-react';
import { api, readData } from '../lib/api';
import PageIntro from '../components/site/PageIntro';
import { PackageCard } from '../components/site/Cards';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';

const SORTS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'duration', label: 'Shortest first' },
  { value: 'newest', label: 'Newest' },
];

export default function Packages() {
  const [filters, setFilters] = useState({ destination: '', minPrice: '', maxPrice: '', maxDays: '', sort: 'popular', search: '', page: 1 });
  const [term, setTerm] = useState('');

  const destinations = useQuery({
    queryKey: ['packages', 'destination-options'],
    queryFn: () => readData(api.get('/destinations', { params: { limit: 50, sort: 'name' } })),
    staleTime: 10 * 60 * 1000,
  });

  const list = useQuery({
    queryKey: ['packages', 'list', filters],
    queryFn: () =>
      readData(
        api.get('/packages', {
          params: {
            page: filters.page,
            limit: 9,
            sort: filters.sort,
            ...(filters.destination ? { destination: filters.destination } : {}),
            ...(filters.minPrice ? { minPrice: filters.minPrice } : {}),
            ...(filters.maxPrice ? { maxPrice: filters.maxPrice } : {}),
            ...(filters.maxDays ? { maxDays: filters.maxDays } : {}),
            ...(filters.search ? { search: filters.search } : {}),
          },
        })
      ),
  });

  function update(patch) {
    setFilters((current) => ({ ...current, page: 1, ...patch }));
  }

  return (
    <>
      <PageIntro
        eyebrow="Ready-made journeys"
        title="Fixed departures with transparent inclusions"
        description="Curated multi-day trips with scheduled departures, clear inclusions and seats held in real time."
      >
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update({ search: term.trim() });
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className="input w-64 pl-9"
              placeholder="Search packages"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              aria-label="Search packages"
            />
          </div>
          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
      </PageIntro>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Filters</p>

            <label className="mt-4 block">
              <span className="label">Destination</span>
              <select className="input" value={filters.destination} onChange={(event) => update({ destination: event.target.value })}>
                <option value="">All destinations</option>
                {(destinations.data?.items || []).map((destination) => (
                  <option key={destination.id} value={destination.slug}>
                    {destination.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Min ৳</span>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(event) => update({ minPrice: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">Max ৳</span>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="Any"
                  value={filters.maxPrice}
                  onChange={(event) => update({ maxPrice: event.target.value })}
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="label">Maximum days</span>
              <select className="input" value={filters.maxDays} onChange={(event) => update({ maxDays: event.target.value })}>
                <option value="">Any length</option>
                <option value="3">Up to 3 days</option>
                <option value="5">Up to 5 days</option>
                <option value="7">Up to 7 days</option>
                <option value="10">Up to 10 days</option>
              </select>
            </label>

            <label className="mt-4 block">
              <span className="label">Sort</span>
              <select className="input" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
                {SORTS.map((sort) => (
                  <option key={sort.value} value={sort.value}>
                    {sort.label}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="outline"
              size="sm"
              className="mt-5 w-full"
              onClick={() => {
                setTerm('');
                setFilters({ destination: '', minPrice: '', maxPrice: '', maxDays: '', sort: 'popular', search: '', page: 1 });
              }}
            >
              Clear filters
            </Button>
          </div>
        </aside>

        <div>
          {list.isLoading ? (
            <CardSkeleton count={6} />
          ) : list.isError ? (
            <EmptyState icon={PackageSearch} title="Could not load packages" description={list.error?.message} />
          ) : list.data?.items?.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.items.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
              <Pagination meta={list.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            </>
          ) : (
            <EmptyState icon={PackageSearch} title="No packages match those filters" description="Widen your price range or pick another destination." />
          )}
        </div>
      </div>
    </>
  );
}
