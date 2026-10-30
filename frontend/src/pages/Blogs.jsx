import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { api, readData } from '../lib/api';
import PageIntro from '../components/site/PageIntro';
import { BlogCard } from '../components/site/Cards';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import { breadcrumb, collectionPage, graph, useSeo } from '../lib/seo';

const DESCRIPTION =
  'Route ideas, season advice and practical notes from the operators and guides on our platform.';

export default function Blogs() {
  const [page, setPage] = useState(1);
  useSeo({
    title: 'The POTHIK journal',
    description: DESCRIPTION,
    url: '/journal',
    jsonLd: graph(
      collectionPage({ name: 'The POTHIK journal', description: DESCRIPTION, path: '/journal' }),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'Journal', path: '/journal' },
      ])
    ),
  });
  const list = useQuery({
    queryKey: ['blogs', page],
    queryFn: () => readData(api.get('/blogs', { params: { page, limit: 9 } })),
  });

  return (
    <>
      <PageIntro
        eyebrow="The POTHIK journal"
        title="Field notes for travelling Bangladesh well"
        description="Route ideas, season advice and practical notes from the operators and guides on our platform."
      />
      <div className="container-page py-10">
        {list.isLoading ? (
          <CardSkeleton count={6} />
        ) : list.isError ? (
          <EmptyState icon={Newspaper} title="Could not load the journal" description={list.error?.message} />
        ) : list.data?.items?.length ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.data.items.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
            <Pagination meta={list.data.meta} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState icon={Newspaper} title="No stories published yet" description="The journal is being prepared. Check back soon." />
        )}
      </div>
    </>
  );
}
