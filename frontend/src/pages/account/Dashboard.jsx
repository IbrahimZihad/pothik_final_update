import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarCheck, Compass, HeartHandshake, Signal, Wallet } from 'lucide-react';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BookingTable from '../../components/dashboard/BookingTable';
import { StatCard } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../auth/AuthProvider';
import { formatCurrency, formatDateRange } from '../../lib/format';

export default function AccountDashboard() {
  const auth = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', 'customer'],
    queryFn: () => readData(api.get('/dashboard')),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <EmptyState
        icon={Signal}
        title="Could not load your dashboard"
        description={error?.message}
        action={<Button onClick={() => window.location.reload()}>Try again</Button>}
      />
    );
  }

  const upcoming = data?.bookings?.upcoming ? [data.bookings.upcoming] : [];
  const recent = data?.bookings?.recent || [];
  const unread = data?.unreadNotifications || 0;

  return (
    <div>
      <DashHead
        eyebrow="Traveller dashboard"
        title={`Welcome back, ${auth.user?.name?.split(' ')[0] || 'traveller'}`}
        description="Your next trip, payments and loyalty in one place."
        actions={
          <Button as={Link} to="/plan" variant="primary">
            <Compass className="h-4 w-4" /> Plan a trip
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming trips" value={upcoming.length} icon={CalendarCheck} />
        <StatCard label="Total spent" value={formatCurrency(data?.totalSpent)} icon={Wallet} tone="emerald" />
        <StatCard label="Loyalty points" value={Number(data?.loyaltyPoints || 0).toLocaleString()} icon={HeartHandshake} tone="secondary" />
        <StatCard label="Unread notifications" value={unread} icon={Bell} tone={unread ? 'rose' : 'slate'} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Upcoming trip</h2>
          <Link to="/account/bookings" className="text-xs font-semibold text-primary-700 hover:underline">
            All bookings
          </Link>
        </div>
        {upcoming.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {upcoming.slice(0, 2).map((booking) => (
              <Link
                key={booking.id}
                to={`/account/bookings/${booking.reference}`}
                className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-float"
              >
                <p className="font-mono text-[11px] font-semibold text-slate-400">{booking.reference}</p>
                <p className="mt-1 text-lg font-bold text-ink-900">{formatDateRange(booking.startDate, booking.endDate)}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {booking.items?.map((item) => item.title).join(' · ') || booking.type.replaceAll('_', ' ')}
                </p>
                <p className="mt-3 text-sm font-semibold text-primary-700">{formatCurrency(booking.totalAmount)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No upcoming trips"
            description="Start with a destination and dates — we price the whole trip on the server."
            action={
              <Button as={Link} to="/plan" size="sm">
                Build my trip
              </Button>
            }
          />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-ink-900">Recent bookings</h2>
        <BookingTable
          items={recent}
          toBooking={(reference) => `/account/bookings/${reference}`}
          emptyTitle="No bookings yet"
          emptyText="Your reservations will appear here once you book."
        />
      </section>
    </div>
  );
}
