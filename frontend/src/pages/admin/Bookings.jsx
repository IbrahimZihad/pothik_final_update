import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BookingTable from '../../components/dashboard/BookingTable';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const STATUSES = ['', 'PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'REJECTED'];
const TYPES = ['', 'PACKAGE', 'CUSTOM_TRIP', 'HOTEL', 'TRANSPORT', 'GUIDE'];

export default function AdminBookings() {
  const [filters, setFilters] = useState({ status: '', type: '', search: '', from: '', to: '' });
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'bookings', { ...filters, page }],
    queryFn: () =>
      readData(
        api.get('/admin/bookings', {
          params: {
            page,
            limit: 25,
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.type ? { type: filters.type } : {}),
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
          },
        })
      ),
  });

  function update(patch) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  return (
    <div>
      <DashHead eyebrow="Bookings" title="All reservations" description="Read-only view across every traveller and provider." />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <form
          className="flex flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update({ search: term.trim() });
          }}
        >
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input className="input pl-9" placeholder="Reference or traveller" value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Search bookings" />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>
        <select className="input w-auto" value={filters.status} onChange={(event) => update({ status: event.target.value })} aria-label="Filter by status">
          {STATUSES.map((entry) => <option key={entry || 'all'} value={entry}>{entry ? entry.replaceAll('_', ' ').toLowerCase() : 'All statuses'}</option>)}
        </select>
        <select className="input w-auto" value={filters.type} onChange={(event) => update({ type: event.target.value })} aria-label="Filter by type">
          {TYPES.map((entry) => <option key={entry || 'all'} value={entry}>{entry ? entry.replaceAll('_', ' ').toLowerCase() : 'All types'}</option>)}
        </select>
        <input type="date" className="input w-auto" value={filters.from} onChange={(event) => update({ from: event.target.value })} aria-label="From date" />
        <input type="date" className="input w-auto" value={filters.to} onChange={(event) => update({ to: event.target.value })} aria-label="To date" />
      </Card>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <EmptyState title="Bookings could not be loaded" />
      ) : (
        <>
          <BookingTable
            items={data?.items}
            toBooking={(reference) => `/admin/bookings/${reference}`}
            emptyTitle="No bookings match these filters"
          />
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
