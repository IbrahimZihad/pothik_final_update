import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Banknote, CalendarCheck, ShieldCheck, Star, Users, Wallet } from 'lucide-react';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BookingTable from '../../components/dashboard/BookingTable';
import { StatCard } from '../../components/ui/Card';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency, formatNumber } from '../../lib/format';

export default function AdminDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: () => readData(api.get('/admin/stats')),
  });

  if (isLoading) return <PageLoader />;
  if (isError) return <EmptyState icon={ShieldCheck} title="Statistics unavailable" description={error?.message} />;

  const revenue = data.revenue || {};
  const series = (revenue.series || []).map((row) => ({ ...row, amount: Number(row.amount) }));
  const statuses = Object.entries(data.bookings?.byStatus || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <DashHead
        eyebrow="Platform overview"
        title="Operations at a glance"
        description="Revenue, bookings, approvals and moderation across POTHIK."
        actions={
          <>
            {(data.providers?.pendingApproval || 0) > 0 && (
              <Button as={Link} to="/admin/providers" variant="secondary">
                {data.providers.pendingApproval} provider{data.providers.pendingApproval === 1 ? '' : 's'} pending
              </Button>
            )}
            <Button as={Link} to="/admin/finance" variant="outline">
              <Wallet className="h-4 w-4" /> Finance queues
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (6 months)" value={formatCurrency(revenue.last6Months)} icon={Banknote} tone="emerald" hint="Paid amounts on confirmed or completed bookings" />
        <StatCard label="Bookings" value={formatNumber(data.bookings?.total)} icon={CalendarCheck} />
        <StatCard label="Users" value={formatNumber(data.users?.total)} icon={Users} tone="slate" />
        <StatCard label="Providers" value={formatNumber(data.providers?.total)} icon={ShieldCheck} tone="secondary" hint={`${data.providers?.pendingApproval || 0} awaiting approval`} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="text-base font-bold text-ink-900">Revenue trend</h2>
          <p className="text-xs text-slate-500">Paid amounts by booking creation month.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="amount" stroke="#0d9488" strokeWidth={2} fill="url(#adminRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-ink-900">Booking pipeline</h2>
          <ul className="mt-3 space-y-2">
            {statuses.length ? (
              statuses.map(([status, count]) => (
                <li key={status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize text-slate-600">{status.replaceAll('_', ' ').toLowerCase()}</span>
                  <span className="font-semibold text-slate-800">{formatNumber(count)}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500">No bookings yet.</li>
            )}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <Link to="/admin/reviews" className="rounded-xl bg-amber-50 px-3 py-3 transition hover:bg-amber-100">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800"><Star className="h-3.5 w-3.5" /> Reviews</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{data.moderation?.pendingReviews || 0}</p>
              <p className="text-[11px] text-amber-700">pending moderation</p>
            </Link>
            <Link to="/admin/finance" className="rounded-xl bg-sky-50 px-3 py-3 transition hover:bg-sky-100">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-800"><Wallet className="h-3.5 w-3.5" /> Refunds</p>
              <p className="mt-1 text-xl font-bold text-sky-900">{data.moderation?.refundsRequested || 0}</p>
              <p className="text-[11px] text-sky-700">awaiting decision</p>
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="text-lg font-bold text-ink-900">Recent bookings</h2>
          <div className="mt-3">
            <BookingTable items={data.bookings?.recent} toBooking={(reference) => `/admin/bookings/${reference}`} emptyTitle="No bookings yet" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-ink-900">Commission leaders</h2>
          <p className="text-xs text-slate-500">Earned + paid commission by provider.</p>
          <ul className="mt-3 space-y-3">
            {data.commissions?.topProviders?.length ? (
              data.commissions.topProviders.map((provider) => (
                <li key={provider.providerProfileId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{provider.businessName}</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{provider.type || 'provider'}</span>
                  </span>
                  <span className="font-semibold text-slate-900">{formatCurrency(provider.commission)}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500">No commission has accrued yet.</li>
            )}
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
            {(data.commissions?.byStatus || []).map((row) => (
              <p key={row.status} className="flex justify-between text-xs text-slate-500">
                <span>{row.status.toLowerCase()} ({row.count})</span>
                <span className="font-semibold text-slate-700">{formatCurrency(row.total)}</span>
              </p>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
