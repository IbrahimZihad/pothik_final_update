import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Compass } from 'lucide-react';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BookingTable from '../../components/dashboard/BookingTable';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import { CardSkeleton } from '../../components/ui/Skeleton';

const STATUSES = ['', 'PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'REJECTED'];

export default function AccountBookings() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bookings', 'mine', { status, page }],
    queryFn: () =>
      readData(api.get('/bookings', { params: { page, limit: 10, ...(status ? { status } : {}) } })),
  });

  return (
    <div>
      <DashHead
        eyebrow="My bookings"
        title="Every reservation"
        description="Statuses, payments and refunds — all served by the booking engine."
        actions={
          <Button as={Link} to="/plan" variant="outline">
            <Compass className="h-4 w-4" /> New trip
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
            toBooking={(reference) => `/account/bookings/${reference}`}
            emptyTitle="No bookings in this view"
            emptyText="Try another status, or plan a new trip."
            emptyAction={
              <Button as={Link} to="/plan" size="sm">
                <CalendarPlus className="h-4 w-4" /> Plan a trip
              </Button>
            }
          />
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
