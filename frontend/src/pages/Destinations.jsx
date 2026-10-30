import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Compass, Search } from 'lucide-react';
import { api, readData } from '../lib/api';
import PageIntro from '../components/site/PageIntro';
import { DestinationCard } from '../components/site/Cards';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import { useLanguage } from '../i18n/LanguageProvider';
import { breadcrumb, collectionPage, graph, useSeo } from '../lib/seo';

const DESCRIPTION =
  'Beaches, hill tracts, tea gardens and the Sundarbans. Filter by landscape and start a custom trip from any destination.';

export default function Destinations() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState({ category: '', sort: 'newest', search: '', page: 1 });
  const [term, setTerm] = useState('');
  useSeo({
    title: 'Destinations in Bangladesh',
    description: DESCRIPTION,
    url: '/destinations',
    jsonLd: graph(
      collectionPage({ name: 'Destinations in Bangladesh', description: DESCRIPTION, path: '/destinations' }),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'Destinations', path: '/destinations' },
      ])
    ),
  });

  const meta = useQuery({
    queryKey: ['destinations', 'meta'],
    queryFn: () => readData(api.get('/destinations/meta')),
    staleTime: 10 * 60 * 1000,
  });

  const list = useQuery({
    queryKey: ['destinations', 'list', filters],
    queryFn: () =>
      readData(
        api.get('/destinations', {
          params: {
            page: filters.page,
            limit: 9,
            sort: filters.sort,
            ...(filters.category ? { category: filters.category } : {}),
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
        eyebrow="Destinations"
        title="Nine corners of Bangladesh, one booking engine"
        description="Beaches, hill tracts, tea gardens and the Sundarbans. Filter by landscape and start a custom trip from any destination."
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
              placeholder="Search destinations"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              aria-label="Search destinations"
            />
          </div>
          <select
            className="input w-auto"
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value })}
            aria-label="Sort destinations"
          >
            <option value="newest">Newest first</option>
            <option value="popular">Most popular</option>
            <option value="rating">Highest rated</option>
            <option value="name">Name A–Z</option>
          </select>
          <Button type="submit" size="sm">
            {t('common.search')}
          </Button>
        </form>
      </PageIntro>

      <div className="container-page py-10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => update({ category: '' })}
            className={filters.category === '' ? 'chip bg-primary-600 text-white' : 'chip bg-white ring-1 ring-slate-200'}
          >
            All landscapes
          </button>
          {(meta.data?.categories || []).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => update({ category: category.slug })}
              className={filters.category === category.slug ? 'chip bg-primary-600 text-white' : 'chip bg-white ring-1 ring-slate-200'}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {list.isLoading ? (
            <CardSkeleton count={9} />
          ) : list.isError ? (
            <EmptyState icon={Compass} title="Could not load destinations" description={list.error?.message} />
          ) : list.data?.items?.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.data.items.map((destination) => (
                  <DestinationCard key={destination.id} destination={destination} />
                ))}
              </div>
              <Pagination meta={list.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            </>
          ) : (
            <EmptyState
              icon={Compass}
              title="No destinations match those filters"
              description="Try a different landscape or clear your search."
              action={
                <Button variant="outline" size="sm" onClick={() => { setTerm(''); setFilters({ category: '', sort: 'newest', search: '', page: 1 }); }}>
                  Clear filters
                </Button>
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
