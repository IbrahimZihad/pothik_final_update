import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hotel, Search } from 'lucide-react';
import { api, readData } from '../lib/api';
import PageIntro from '../components/site/PageIntro';
import { HotelCard } from '../components/site/Cards';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';

export default function Hotels() {
  const [filters, setFilters] = useState({ destination: '', stars: '', minPrice: '', maxPrice: '', sort: 'rating', search: '', page: 1 });
  const [term, setTerm] = useState('');

  const destinations = useQuery({
    queryKey: ['hotels', 'destination-options'],
    queryFn: () => readData(api.get('/destinations', { params: { limit: 50, sort: 'name' } })),
    staleTime: 10 * 60 * 1000,
  });

  const list = useQuery({
    queryKey: ['hotels', 'list', filters],
    queryFn: () =>
      readData(
        api.get('/hotels', {
          params: {
            page: filters.page,
            limit: 9,
            sort: filters.sort,
            ...(filters.destination ? { destination: filters.destination } : {}),
            ...(filters.stars ? { stars: filters.stars } : {}),
            ...(filters.minPrice ? { minPrice: filters.minPrice } : {}),
            ...(filters.maxPrice ? { maxPrice: filters.maxPrice } : {}),
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
        eyebrow="Where to stay"
        title="Verified hotels with live room inventory"
        description="Every property is operated by an approved provider. Availability and nightly rates are checked against real reservations."
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
              placeholder="Search hotels"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              aria-label="Search hotels"
            />
          </div>
          <Button type="submit" size="sm">Search</Button>
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

            <label className="mt-4 block">
              <span className="label">Star rating</span>
              <select className="input" value={filters.stars} onChange={(event) => update({ stars: event.target.value })}>
                <option value="">Any rating</option>
                {[5, 4, 3, 2, 1].map((star) => (
                  <option key={star} value={star}>
                    {star}-star
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Min ৳</span>
                <input type="number" min="0" className="input" placeholder="0" value={filters.minPrice} onChange={(event) => update({ minPrice: event.target.value })} />
              </label>
              <label className="block">
                <span className="label">Max ৳</span>
                <input type="number" min="0" className="input" placeholder="Any" value={filters.maxPrice} onChange={(event) => update({ maxPrice: event.target.value })} />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="label">Sort</span>
              <select className="input" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
                <option value="rating">Highest rated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>

            <Button
              variant="outline"
              size="sm"
              className="mt-5 w-full"
              onClick={() => {
                setTerm('');
                setFilters({ destination: '', stars: '', minPrice: '', maxPrice: '', sort: 'rating', search: '', page: 1 });
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
            <EmptyState icon={Hotel} title="Could not load hotels" description={list.error?.message} />
          ) : list.data?.items?.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.items.map((hotel) => (
                  <HotelCard key={hotel.id} hotel={hotel} />
                ))}
              </div>
              <Pagination meta={list.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            </>
          ) : (
            <EmptyState icon={Hotel} title="No hotels match those filters" description="Try another destination or widen the price range." />
          )}
        </div>
      </div>
    </>
  );
}
