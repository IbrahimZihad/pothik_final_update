import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CreditCard, MessageSquarePlus, ReceiptText, ShieldCheck } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import ReviewDialog, { reviewableItems } from '../../components/dashboard/ReviewDialog';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency, formatDate, formatDateRange, humanize, pluralize } from '../../lib/format';

const CANCELLABLE = ['PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED'];
const PAYABLE = ['AWAITING_PAYMENT', 'CONFIRMED'];
const REFUNDABLE = ['CANCELLED', 'REFUND_PENDING', 'COMPLETED'];

export default function AccountBookingDetail() {
  const { reference } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const { data: booking, isLoading, isError, error } = useQuery({
    queryKey: ['booking', reference],
    queryFn: () => readData(api.get(`/bookings/${reference}`)),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['booking', reference] });
    queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'customer'] });
  };

  const cancel = useMutation({
    mutationFn: () => readData(api.post(`/bookings/${reference}/cancel`, reason.trim() ? { reason: reason.trim() } : {})),
    onSuccess: () => {
      toast.success('Booking cancelled.');
      setDialog(null);
      invalidate();
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  const refund = useMutation({
    mutationFn: () =>
      readData(
        api.post('/payments/refunds', {
          bookingReference: reference,
          reason: reason.trim(),
          ...(refundAmount ? { amount: Number(refundAmount) } : {}),
        })
      ),
    onSuccess: () => {
      toast.success('Refund requested. Finance will review it.');
      setDialog(null);
      invalidate();
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !booking) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Booking not found"
        description={error?.message || 'This booking does not belong to your account.'}
        action={<Button as={Link} to="/account/bookings" variant="outline">All bookings</Button>}
      />
    );
  }

  const due = Number(booking.dueAmount || 0);
  const canPay = PAYABLE.includes(booking.status) && due > 0;
  const canCancel = CANCELLABLE.includes(booking.status);
  const canRefund = REFUNDABLE.includes(booking.status) && Number(booking.paidAmount || 0) > 0;
  const canReview = booking.status === 'COMPLETED' && reviewableItems(booking).length > 0;

  function openDialog(kind) {
    setDialog(kind);
    setReason('');
    setRefundAmount(kind === 'refund' ? String(booking.paidAmount) : '');
  }

  return (
    <div>
      <Link to="/account/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>

      <DashHead
        eyebrow={`Booking ${booking.reference}`}
        title={humanize(booking.type)}
        description={`${formatDateRange(booking.startDate, booking.endDate)} · ${pluralize(booking.adults, 'adult')}${
          booking.children ? `, ${pluralize(booking.children, 'child', 'children')}` : ''
        }`}
        actions={
          <>
            <StatusBadge status={booking.status} />
            {canReview && (
              <Button variant="outline" onClick={() => openDialog('review')}>
                <MessageSquarePlus className="h-4 w-4" /> Write a review
              </Button>
            )}
            {canRefund && (
              <Button variant="outline" onClick={() => openDialog('refund')}>
                Request refund
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={() => openDialog('cancel')}>
                Cancel booking
              </Button>
            )}
            {canPay && (
              <Button as={Link} to={`/account/bookings/${booking.reference}/pay`}>
                <CreditCard className="h-4 w-4" /> Pay {formatCurrency(due)}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">What is included</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {booking.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {humanize(item.itemType)} · {formatDateRange(item.startDate, item.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.totalPrice)}</p>
                    <div className="mt-1 flex justify-end">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <ReceiptText className="h-4 w-4 text-primary-700" /> Payments
            </h2>
            {booking.payments.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="table-head pl-0">Date</th>
                      <th className="table-head">Method</th>
                      <th className="table-head">Amount</th>
                      <th className="table-head">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {booking.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="table-cell pl-0">{formatDate(payment.createdAt)}</td>
                        <td className="table-cell uppercase">{payment.method || payment.provider}</td>
                        <td className="table-cell font-semibold">{formatCurrency(payment.amount)}</td>
                        <td className="table-cell"><StatusBadge status={payment.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No payments recorded yet.</p>
            )}
            {booking.status === 'AWAITING_CONFIRMATION' && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Waiting for every provider to accept before payment unlocks.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <CalendarClock className="h-4 w-4 text-primary-700" /> Status history
            </h2>
            <ol className="mt-3 space-y-3">
              {booking.statusHistory.length ? (
                booking.statusHistory.map((entry, index) => (
                  <li key={`${entry.to}-${index}`} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {entry.from ? `${entry.from.replaceAll('_', ' ').toLowerCase()} → ` : ''}
                        {entry.to.replaceAll('_', ' ').toLowerCase()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(entry.at, 'DD MMM YYYY, HH:mm')}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                      </p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">No transitions recorded yet.</li>
              )}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Price breakdown</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(booking.subtotal)} />
              {Number(booking.discountTotal) > 0 && <Row label="Discount" value={`− ${formatCurrency(booking.discountTotal)}`} tone="text-emerald-700" />}
              <Row label="Taxes & fees" value={formatCurrency(booking.taxTotal)} />
              <div className="border-t border-slate-100 pt-2">
                <Row label="Total" value={formatCurrency(booking.totalAmount)} strong />
                <Row label="Paid" value={formatCurrency(booking.paidAmount)} tone="text-emerald-700" />
                <Row label="Due" value={formatCurrency(booking.dueAmount)} strong />
              </div>
            </dl>
            {booking.coupon && (
              <p className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-800">
                Coupon {booking.coupon.code} · {booking.coupon.type === 'PERCENT' ? `${booking.coupon.value}% off` : `${formatCurrency(booking.coupon.value)} off`}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Traveller details</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{booking.contact.name}</p>
              <p>{booking.contact.email}</p>
              <p>{booking.contact.phone}</p>
              {booking.passengers.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                  {booking.passengers.map((passenger) => (
                    <li key={passenger.id} className="flex justify-between gap-2 text-xs">
                      <span>{passenger.fullName}</span>
                      <span className="text-slate-400">{passenger.age ? `${passenger.age} yrs` : ''} {passenger.gender || ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <ShieldCheck className="h-4 w-4 text-primary-700" /> Cancellation policy
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{booking.cancellationPolicy || 'Contact support for cancellation terms.'}</p>
            {booking.cancellationReason && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Cancelled: {booking.cancellationReason}</p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel this booking?"
        description="Provider inventory will be released. Refunds follow the cancellation policy."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Keep booking</Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel booking</Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional)"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Plans changed, dates moved…"
        />
      </Modal>

      <Modal
        open={dialog === 'refund'}
        onClose={() => setDialog(null)}
        title="Request a refund"
        description="Finance reviews every refund request before money leaves the platform."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Close</Button>
            <Button loading={refund.isPending} disabled={reason.trim().length < 3} onClick={() => refund.mutate()}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Refund amount (BDT)"
            type="number"
            min="1"
            step="0.01"
            value={refundAmount}
            onChange={(event) => setRefundAmount(event.target.value)}
            hint={`Paid so far: ${formatCurrency(booking.paidAmount)}`}
          />
          <Textarea
            label="Reason"
            rows={3}
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Tell finance why this refund is due."
          />
        </div>
      </Modal>

      <ReviewDialog open={dialog === 'review'} onClose={() => setDialog(null)} booking={booking} />
    </div>
  );
}

function Row({ label, value, strong, tone }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? 'font-semibold text-slate-800' : 'text-slate-500'}>{label}</dt>
      <dd className={`${strong ? 'font-bold text-ink-900' : 'font-medium text-slate-700'} ${tone || ''}`}>{value}</dd>
    </div>
  );
}
