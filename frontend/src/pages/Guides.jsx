import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { api, readData } from '../lib/api';
import PageIntro from '../components/site/PageIntro';
import { GuideCard } from '../components/site/Cards';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import { breadcrumb, collectionPage, graph, useSeo } from '../lib/seo';

const LANGUAGES = ['Bangla', 'English', 'German', 'French', 'Japanese', 'Arabic'];
const DESCRIPTION =
  'Approved guides set their languages, expertise and daily rate. Check their calendar before booking so your dates are held correctly.';

export default function Guides() {
  const [filters, setFilters] = useState({ language: '', location: '', sort: 'rating', page: 1 });
  useSeo({
    title: 'Local tour guides in Bangladesh',
    description: DESCRIPTION,
    url: '/guides',
    jsonLd: graph(
      collectionPage({ name: 'Local tour guides in Bangladesh', description: DESCRIPTION, path: '/guides' }),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'Guides', path: '/guides' },
      ])
    ),
  });

  const list = useQuery({
    queryKey: ['guides', 'list', filters],
    queryFn: () =>
      readData(
        api.get('/guides', {
          params: {
            page: filters.page,
            limit: 9,
            sort: filters.sort,
            ...(filters.language ? { language: filters.language } : {}),
            ...(filters.location ? { location: filters.location } : {}),
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
        eyebrow="People who know the ground"
        title="Local guides for routes that reward context"
        description="Approved guides set their languages, expertise and daily rate. Check their calendar before booking so your dates are held correctly."
      />

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Filters</p>

            <label className="mt-4 block">
              <span className="label">Language</span>
              <select className="input" value={filters.language} onChange={(event) => update({ language: event.target.value })}>
                <option value="">Any language</option>
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="label">Service location</span>
              <input
                className="input"
                placeholder="e.g. Cox's Bazar"
                value={filters.location}
                onChange={(event) => update({ location: event.target.value })}
              />
            </label>

            <label className="mt-4 block">
              <span className="label">Sort</span>
              <select className="input" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
                <option value="rating">Highest rated</option>
                <option value="experience">Most experienced</option>
                <option value="rate_asc">Daily rate: low to high</option>
                <option value="rate_desc">Daily rate: high to low</option>
              </select>
            </label>

            <Button
              variant="outline"
              size="sm"
              className="mt-5 w-full"
              onClick={() => setFilters({ language: '', location: '', sort: 'rating', page: 1 })}
            >
              Clear filters
            </Button>
          </div>
        </aside>

        <div>
          {list.isLoading ? (
            <CardSkeleton count={6} />
          ) : list.isError ? (
            <EmptyState icon={Compass} title="Could not load guides" description={list.error?.message} />
          ) : list.data?.items?.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.items.map((guide) => (
                  <GuideCard key={guide.id} guide={guide} />
                ))}
              </div>
              <Pagination meta={list.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
            </>
          ) : (
            <EmptyState icon={Compass} title="No guides match those filters" description="Try another language or a nearby service location." />
          )}
        </div>
      </div>
    </>
  );
}
