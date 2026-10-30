import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Newspaper, PenLine } from 'lucide-react';
import { api, readData } from '../lib/api';
import { useLanguage } from '../i18n/LanguageProvider';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import SmartImage from '../components/ui/SmartImage';
import { formatDate } from '../lib/format';
import { absoluteUrl, breadcrumb, graph, truncate, useSeo } from '../lib/seo';

export default function BlogDetail() {
  const { slug } = useParams();
  const { isBangla } = useLanguage();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['blog', slug],
    queryFn: () => readData(api.get(`/blogs/${slug}`)),
  });

  const title = data ? (isBangla && data.titleBn ? data.titleBn : data.title) : undefined;

  useSeo({
    title,
    description: data?.excerpt,
    image: data?.coverImage,
    url: `/journal/${slug}`,
    type: 'article',
    publishedTime: data?.publishedAt,
    jsonLd: data
      ? graph(
          {
            '@type': 'BlogPosting',
            headline: title,
            description: truncate(data.excerpt, 300),
            image: absoluteUrl(data.coverImage),
            datePublished: data.publishedAt,
            dateModified: data.publishedAt,
            inLanguage: isBangla ? 'bn' : 'en',
            author: {
              '@type': data.author ? 'Person' : 'Organization',
              name: data.author || 'POTHIK Editorial',
            },
            publisher: {
              '@type': 'Organization',
              name: 'POTHIK',
              logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.svg') },
            },
            mainEntityOfPage: absoluteUrl(`/journal/${data.slug}`),
          },
          breadcrumb([
            { name: 'Home', path: '/' },
            { name: 'Journal', path: '/journal' },
            { name: title, path: `/journal/${data.slug}` },
          ])
        )
      : null,
  });

  if (isLoading) return <PageLoader label="Loading story…" />;
  if (isError || !data) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={Newspaper}
          title="Story not found"
          description={error?.message}
          action={<Button as={Link} to="/journal" variant="outline">Back to the journal</Button>}
        />
      </div>
    );
  }

  const paragraphs = String(data.content || data.excerpt || '').split(/\n{2,}/).filter(Boolean);

  return (
    <>
      <section className="relative">
        <SmartImage src={data.coverImage} alt={title} wrapperClassName="h-[38vh] min-h-[260px] w-full" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/40 to-transparent" aria-hidden="true" />
        <div className="container-page absolute inset-x-0 bottom-0 pb-8">
          <Link to="/journal" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> The journal
          </Link>
          <h1 className="mt-2 max-w-4xl text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> {data.author || 'POTHIK Editorial'}
            </span>
            {data.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {formatDate(data.publishedAt, 'DD MMM YYYY')}
              </span>
            )}
          </p>
        </div>
      </section>

      <article className="container-page max-w-3xl py-10">
        {data.excerpt && <p className="border-l-4 border-primary-500 pl-4 text-base font-medium leading-7 text-slate-700">{data.excerpt}</p>}
        <div className="mt-6 space-y-4 text-[15px] leading-8 text-slate-600">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-900 px-5 py-5 text-white">
          <div>
            <p className="text-sm font-bold">Ready to put this into an itinerary?</p>
            <p className="mt-0.5 text-xs text-slate-300">Build a trip and let verified providers confirm each line.</p>
          </div>
          <Button as={Link} to="/plan" variant="secondary">Plan a trip</Button>
        </div>
      </article>
    </>
  );
}
