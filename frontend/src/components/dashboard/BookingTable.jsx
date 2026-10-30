import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { StatusBadge } from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { formatCurrency, formatDateRange, pluralize } from '../../lib/format';

export default function BookingTable({ items, toBooking, emptyTitle = 'No bookings yet', emptyText, emptyAction }) {
  if (!items?.length) {
    return <EmptyState icon={CalendarDays} title={emptyTitle} description={emptyText} action={emptyAction} />;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-slate-100 bg-slate-50/70">
            <tr>
              <th className="table-head">Reference</th>
              <th className="table-head">Trip</th>
              <th className="table-head">Travel dates</th>
              <th className="table-head">Total</th>
              <th className="table-head">Status</th>
              <th className="table-head text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((booking) => (
              <tr key={booking.id} className="hover:bg-slate-50/60">
                <td className="table-cell font-mono text-xs font-semibold text-ink-900">{booking.reference}</td>
                <td className="table-cell">
                  <p className="font-semibold text-slate-800">{booking.type.replaceAll('_', ' ')}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {booking.items?.length ? booking.items.map((item) => item.title).join(' · ') : `${pluralize(booking.adults || 0, 'traveller')}`}
                  </p>
                </td>
                <td className="table-cell whitespace-nowrap">{formatDateRange(booking.startDate, booking.endDate)}</td>
                <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                  {formatCurrency(booking.totalAmount)}
                  {Number(booking.dueAmount) > 0 && (
                    <span className="mt-0.5 block text-[11px] font-medium text-amber-700">Due {formatCurrency(booking.dueAmount)}</span>
                  )}
                </td>
                <td className="table-cell">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="table-cell text-right">
                  <Link
                    to={toBooking(booking.reference)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    Details <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
