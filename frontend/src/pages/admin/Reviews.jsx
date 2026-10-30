import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Star, X } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Rating from '../../components/ui/Rating';
import Pagination from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatDate } from '../../lib/format';

const STATUSES = ['', 'PENDING', 'APPROVED', 'REJECTED'];
const TARGETS = ['', 'HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION'];

export default function AdminReviews() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: 'PENDING', targetType: '' });
  const [page, setPage] = useState(1);

  const reviews = useQuery({
    queryKey: ['admin', 'reviews', { ...filters, page }],
    queryFn: () =>
      readData(
        api.get('/admin/reviews', {
          params: {
            page,
            limit: 20,
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.targetType ? { targetType: filters.targetType } : {}),
          },
        })
      ),
  });

  const moderate = useMutation({
    mutationFn: ({ id, status }) => readData(api.post(`/admin/reviews/${id}/moderate`, { status })),
    onSuccess: (_, variables) => {
      toast.success(`Review ${variables.status.toLowerCase()}.`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'admin'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div>
      <DashHead eyebrow="Moderation" title="Traveller reviews" description="Only reviews from completed bookings reach the queue." />

      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input w-auto" value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }} aria-label="Filter by status">
          {STATUSES.map((entry) => <option key={entry || 'all'} value={entry}>{entry ? entry.toLowerCase() : 'All statuses'}</option>)}
        </select>
        <select className="input w-auto" value={filters.targetType} onChange={(event) => { setFilters({ ...filters, targetType: event.target.value }); setPage(1); }} aria-label="Filter by target">
          {TARGETS.map((entry) => <option key={entry || 'all'} value={entry}>{entry ? entry.toLowerCase() : 'All targets'}</option>)}
        </select>
      </div>

      {reviews.isLoading ? (
        <PageLoader />
      ) : reviews.isError ? (
        <EmptyState icon={Star} title="Reviews could not be loaded" />
      ) : reviews.data?.items?.length ? (
        <>
          <div className="space-y-3">
            {reviews.data.items.map((review) => (
              <Card key={review.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{review.user?.name || `User #${review.user_id}`}</p>
                      <span className="chip bg-slate-100 text-[10px] text-slate-600">{review.target_type.toLowerCase()} #{review.target_id}</span>
                      {review.booking?.reference && <span className="font-mono text-[10px] text-slate-400">{review.booking.reference}</span>}
                      <StatusBadge status={review.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Rating value={review.rating} showValue={false} />
                      <span className="text-xs text-slate-400">{formatDate(review.created_at)}</span>
                    </div>
                    {review.title && <p className="mt-2 text-sm font-semibold text-slate-800">{review.title}</p>}
                    {review.comment && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{review.comment}</p>}
                  </div>
                  <div className="flex gap-2">
                    {review.status !== 'APPROVED' && (
                      <Button size="sm" loading={moderate.isPending} onClick={() => moderate.mutate({ id: review.id, status: 'APPROVED' })}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                    {review.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50"
                        loading={moderate.isPending}
                        onClick={() => moderate.mutate({ id: review.id, status: 'REJECTED' })}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination meta={reviews.data.meta} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={Star} title="Queue is clear" description="No reviews match these filters." />
      )}
    </div>
  );
}
