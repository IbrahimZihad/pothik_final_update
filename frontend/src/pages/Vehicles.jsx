import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car } from 'lucide-react';
import { api, readData } from '../lib/api';
import PageIntro from '../components/site/PageIntro';
import { VehicleCard } from '../components/site/Cards';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import { breadcrumb, collectionPage, graph, useSeo } from '../lib/seo';

const DESCRIPTION =
  'Choose by group size and route. Prices are quoted per rental day and checked against driver availability before the booking is created.';

export default function Vehicles() {
  const [filters, setFilters] = useState({ category: '', minCapacity: '', sort: 'rating', page: 1 });
  useSeo({
    title: 'Transport and vehicle hire in Bangladesh',
    description: DESCRIPTION,
    url: '/transport',
    jsonLd: graph(
      collectionPage({ name: 'Transport and vehicle hire in Bangladesh', description: DESCRIPTION, path: '/transport' }),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'Transport', path: '/transport' },
      ])
    ),
  });

  const categories = useQuery({
    queryKey: ['vehicles', 'categories'],
    queryFn: () => readData(api.get('/vehicle-categories')),
    staleTime: 30 * 60 * 1000,
  });

  const list = useQuery({
    queryKey: ['vehicles', 'list', filters],
    queryFn: () =>
      readData(
        api.get('/vehicles', {
          params: {
            page: filters.page,
            limit: 9,
            sort: filters.sort,
            ...(filters.category ? { category: filters.category } : {}),
            ...(filters.minCapacity ? { minCapacity: filters.minCapacity } : {}),
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
        eyebrow="On the road"
        title="Vehicles with verified operators and drivers"
        description="Choose by group size and route. Prices are quoted per rental day and checked against driver availability before the booking is created."
      />

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Filters</p>

            <label className="mt-4 block">
              <span className="label">Vehicle type</span>
              <select className="input" value={filters.category} onChange={(event) => update({ category: event.target.value })}>
                <option value="">All vehicles</option>
                {(categories.data || []).map((category) => (
                  <option key={category.id} value={category.code}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="label">Minimum seats</span>
              <select className="input" value={filters.minCapacity} onChange={(event) => update({ minCapacity: event.target.value })}>
                <option value="">Any capacity</option>
                {[4, 6, 7, 12, 20, 30, 45].map((seats) => (
                  <option key={seats} value={seats}>
                    {seats}+ seats
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="label">Sort</span>
              <select className="input" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
                <option value="rating">Highest rated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="capacity">Largest first</option>
              </select>
            </label>

            <Button
              variant="outline"
              size="sm"
              className="mt-5 w-full"
              onClick={() => setFilters({ category: '', minCapacity: '', sort: 'rating', page: 1 })}
            >
              Clear filters
            </Button>
          </div>
        </aside>

        <div>
          {list.isLoading ? (
            <CardSkeleton count={6} />
          ) : list.isError ? (
            <EmptyState icon={Car} title="Could not load vehicles" description={list.error?.message} />
          ) : list.data?.items?.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.items.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
              <Pagination meta={list.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            </>
          ) : (
            <EmptyState icon={Car} title="No vehicles match those filters" description="Try a smaller group size or another vehicle type." />
          )}
        </div>
      </div>
    </>
  );
}
