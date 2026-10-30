import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarCheck, ClipboardList, Signal, Star, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BookingTable from '../../components/dashboard/BookingTable';
import { StatCard } from '../../components/ui/Card';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../auth/AuthProvider';
import { formatCurrency, formatDateRange } from '../../lib/format';

const TYPE_LABEL = { HOTEL: 'Hotel', TRANSPORT: 'Transport', GUIDE: 'Tour guide' };

export default function ProviderDashboard() {
  const auth = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', 'provider'],
    queryFn: () => readData(api.get('/provider/dashboard')),
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

  const bookings = data?.bookings || {};
  const finance = data?.finance || {};
  const series = finance.series || [];
  const type = data?.type || auth.providerType;

  return (
    <div>
      <DashHead
        eyebrow={`${TYPE_LABEL[type] || 'Provider'} dashboard`}
        title={auth.user?.providerProfile?.business_name || auth.user?.name}
        description="Bookings awaiting your decision, upcoming trips and payout balance."
        actions={
          <Button as={Link} to="/provider/bookings" variant="outline">
            <ClipboardList className="h-4 w-4" /> All bookings
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting acceptance" value={bookings.awaitingYourAcceptance || 0} icon={ClipboardList} tone={bookings.awaitingYourAcceptance ? 'amber' : 'slate'} />
        <StatCard label="Upcoming trips" value={bookings.upcoming?.length || 0} icon={CalendarCheck} />
        <StatCard label="Earned (net)" value={formatCurrency(finance.earned)} icon={Wallet} tone="emerald" />
        <StatCard label="Available to withdraw" value={formatCurrency(finance.available)} icon={BarChart3} tone="secondary" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink-900">Payout trend</h2>
              <p className="text-xs text-slate-500">Net payable from completed items, last six months.</p>
            </div>
            {data?.rating && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {Number(data.rating.average).toFixed(1)} · {data.rating.count} reviews
              </span>
            )}
          </div>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelStyle={{ fontSize: 12 }} />
                <Bar dataKey="amount" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-ink-900">Finance snapshot</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <Row label="Earned" value={formatCurrency(finance.earned)} />
            <Row label="Requested" value={formatCurrency(finance.requested)} />
            <Row label="Approved" value={formatCurrency(finance.approved)} />
            <Row label="Paid out" value={formatCurrency(finance.paidOut)} />
            <div className="border-t border-slate-100 pt-2.5">
              <Row label="Available" value={formatCurrency(finance.available)} strong />
            </div>
          </dl>
          {(finance.commissions || []).length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
              {finance.commissions.map((row) => (
                <p key={row.status} className="flex justify-between text-xs text-slate-500">
                  <span>{row.status.toLowerCase()} commission</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(row.total)}</span>
                </p>
              ))}
            </div>
          )}
          <Button as={Link} to="/provider/finance" variant="outline" className="mt-4 w-full" size="sm">
            Open finance
          </Button>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Upcoming trips</h2>
        </div>
        {(bookings.upcoming || []).length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {bookings.upcoming.map((booking) => (
              <Link
                key={booking.id}
                to={`/provider/bookings/${booking.reference}`}
                className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-float"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] font-semibold text-slate-400">{booking.reference}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatDateRange(booking.startDate, booking.endDate)}</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink-900">
                  {booking.items?.map((item) => item.title).join(' · ') || booking.type.replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {booking.customer?.name ? `${booking.customer.name} · ` : ''}
                  {booking.adults} adult{booking.adults === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarCheck} title="No upcoming trips" description="Confirmed bookings with future dates appear here." />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-ink-900">Recent bookings</h2>
        <BookingTable
          items={bookings.recent}
          toBooking={(reference) => `/provider/bookings/${reference}`}
          emptyTitle="No bookings yet"
          emptyText="When travellers book your services, they land here."
        />
      </section>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? 'text-base font-bold text-ink-900' : 'font-semibold text-slate-800'}>{value}</dd>
    </div>
  );
}
