import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BookingTable from '../../components/dashboard/BookingTable';
import Pagination from '../../components/ui/Pagination';
import { CardSkeleton } from '../../components/ui/Skeleton';

const STATUSES = ['', 'AWAITING_CONFIRMATION', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'];

export default function ProviderBookings() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['provider', 'bookings', { status, page }],
    queryFn: () => readData(api.get('/provider/bookings', { params: { page, limit: 10, ...(status ? { status } : {}) } })),
  });

  return (
    <div>
      <DashHead
        eyebrow="Provider bookings"
        title="Trips that include your services"
        description="Accept requests, start trips and mark them complete."
      />

      <div className="mb-4">
        <select className="input w-auto" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
          {STATUSES.map((entry) => (
            <option key={entry || 'all'} value={entry}>
              {entry ? entry.replaceAll('_', ' ').toLowerCase() : 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Bookings could not be loaded. Please refresh.</p>
      ) : (
        <>
          <BookingTable
            items={data?.items}
            toBooking={(reference) => `/provider/bookings/${reference}`}
            emptyTitle="No bookings in this view"
            emptyText="Bookings that include your listings appear here."
          />
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <ClipboardList className="h-3.5 w-3.5" /> Only your own booking lines are visible; totals are server-calculated.
      </p>
    </div>
  );
}
