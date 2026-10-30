import { BadgeCheck, MessageSquareQuote } from 'lucide-react';
import Rating from '../ui/Rating';
import Pagination from '../ui/Pagination';
import { formatDate, initials } from '../../lib/format';

export default function ReviewList({ summary, title = 'Traveller reviews', meta, onPageChange }) {
  const items = summary?.items || [];
  return (
    <section id="reviews" className="card scroll-mt-24 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">Only travellers with a completed booking can review.</p>
        </div>
        <div className="text-right">
          <Rating value={summary?.average} size="lg" showValue={false} />
          <p className="mt-1 text-sm font-bold text-ink-900">
            {summary?.average ? Number(summary.average).toFixed(1) : '—'}
            <span className="ml-1 text-xs font-medium text-slate-500">/ 5 · {summary?.total || 0} reviews</span>
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No approved reviews yet. Be the first to travel and share your experience.
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {items.map((review) => (
            <li key={review.id} className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {initials(review.user?.name || 'P')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{review.user?.name || 'Traveller'}</p>
                    {review.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified stay
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                  </div>
                  <Rating value={review.rating} showValue={false} className="mt-1" />
                  {review.title && <p className="mt-2 text-sm font-semibold text-slate-800">{review.title}</p>}
                  {review.comment && <p className="mt-1 text-sm leading-6 text-slate-600">{review.comment}</p>}
                  {review.providerReply && (
                    <div className="mt-3 rounded-xl bg-primary-50/70 px-3.5 py-3 text-sm text-slate-700">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-700">
                        <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" /> Provider reply
                      </p>
                      <p className="mt-1 leading-6">{review.providerReply}</p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination meta={meta} onPageChange={onPageChange} className="mt-6 flex items-center justify-center gap-1.5" />
    </section>
  );
}
