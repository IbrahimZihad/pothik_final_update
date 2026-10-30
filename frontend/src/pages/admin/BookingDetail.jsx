import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency, formatDate, formatDateRange } from '../../lib/format';

export default function AdminBookingDetail() {
  const { reference } = useParams();
  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ['admin', 'booking', reference],
    queryFn: () => readData(api.get(`/admin/bookings/${reference}`)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !booking) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Booking not found"
        action={<Button as={Link} to="/admin/bookings" variant="outline">All bookings</Button>}
      />
    );
  }

  return (
    <div>
      <Link to="/admin/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>

      <DashHead
        eyebrow={`Booking ${booking.reference}`}
        title={booking.type.replaceAll('_', ' ').toLowerCase()}
        description={`${formatDateRange(booking.startDate, booking.endDate)} · created ${formatDate(booking.createdAt)}`}
        actions={<StatusBadge status={booking.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Items</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {booking.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.itemType.toLowerCase()} · {formatDateRange(item.startDate, item.endDate)} · provider #{item.providerProfileId || '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.totalPrice)}</p>
                    <p className="text-[11px] text-slate-500">
                      commission {formatCurrency(item.commissionAmount)} ({Number(item.commissionRate).toFixed(1)}%) · payable {formatCurrency(item.providerPayable)}
                    </p>
                    <div className="mt-1 flex justify-end"><StatusBadge status={item.status} /></div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Payments</h2>
            {booking.payments.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="table-head pl-0">Created</th>
                      <th className="table-head">Provider</th>
                      <th className="table-head">Method</th>
                      <th className="table-head">Amount</th>
                      <th className="table-head">Status</th>
                      <th className="table-head">Paid at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {booking.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="table-cell pl-0">{formatDate(payment.createdAt)}</td>
                        <td className="table-cell">{payment.provider}</td>
                        <td className="table-cell uppercase">{payment.method || '—'}</td>
                        <td className="table-cell font-semibold">{formatCurrency(payment.amount)}</td>
                        <td className="table-cell"><StatusBadge status={payment.status} /></td>
                        <td className="table-cell text-xs text-slate-500">{payment.paidAt ? formatDate(payment.paidAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No payments recorded.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Status history</h2>
            <ol className="mt-3 space-y-3">
              {booking.statusHistory.map((entry, index) => (
                <li key={`${entry.to}-${index}`} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-800">{entry.to.replaceAll('_', ' ').toLowerCase()}</p>
                    <p className="text-xs text-slate-500">{formatDate(entry.at, 'DD MMM YYYY, HH:mm')}{entry.reason ? ` · ${entry.reason}` : ''}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Customer</h2>
            {booking.customer ? (
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">{booking.customer.name}</p>
                <p>{booking.customer.email}</p>
                <p>{booking.customer.phone}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Customer details unavailable.</p>
            )}
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>Contact: {booking.contact.name} · {booking.contact.phone}</p>
              <p>{booking.contact.email}</p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Amounts</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <p className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-medium">{formatCurrency(booking.subtotal)}</dd></p>
              <p className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="font-medium">{formatCurrency(booking.discountTotal)}</dd></p>
              <p className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="font-medium">{formatCurrency(booking.taxTotal)}</dd></p>
              <p className="flex justify-between border-t border-slate-100 pt-2"><dt className="font-semibold text-slate-800">Total</dt><dd className="font-bold text-ink-900">{formatCurrency(booking.totalAmount)}</dd></p>
              <p className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd className="font-medium text-emerald-700">{formatCurrency(booking.paidAmount)}</dd></p>
              <p className="flex justify-between"><dt className="text-slate-500">Due</dt><dd className="font-medium">{formatCurrency(booking.dueAmount)}</dd></p>
            </dl>
            {booking.coupon && <p className="mt-3 text-xs text-slate-500">Coupon: {booking.coupon.code}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
