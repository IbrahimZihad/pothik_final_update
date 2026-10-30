import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarRange, CheckCircle2, PlayCircle, ReceiptText, UserRound, XCircle } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency, formatDate, formatDateRange, humanize, pluralize } from '../../lib/format';

export default function ProviderBookingDetail() {
  const { reference } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const { data: booking, isLoading, isError, error } = useQuery({
    queryKey: ['provider', 'booking', reference],
    queryFn: () => readData(api.get(`/provider/bookings/${reference}`)),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['provider', 'booking', reference] });
    queryClient.invalidateQueries({ queryKey: ['provider', 'bookings'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'provider'] });
  };

  const action = useMutation({
    mutationFn: ({ name, body }) => readData(api.post(`/provider/bookings/${reference}/${name}`, body || {})),
    onSuccess: (_, variables) => {
      const done = { accept: 'accepted', reject: 'rejected', start: 'started', complete: 'completed' }[variables.name] || 'updated';
      toast.success(`Booking ${done}.`);
      setRejecting(false);
      setReason('');
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
        description={error?.message || 'No line of this booking belongs to your business.'}
        action={<Button as={Link} to="/provider/bookings" variant="outline">All bookings</Button>}
      />
    );
  }

  const payable = booking.items.reduce((sum, item) => sum + Number(item.providerPayable || 0), 0);
  const commission = booking.items.reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0);
  const canAccept = booking.status === 'AWAITING_CONFIRMATION';
  const canStart = booking.status === 'CONFIRMED';
  const canComplete = booking.status === 'IN_PROGRESS';

  return (
    <div>
      <Link to="/provider/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700">
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
            {canAccept && (
              <>
                <Button variant="danger" onClick={() => setRejecting(true)}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button loading={action.isPending} onClick={() => action.mutate({ name: 'accept' })}>
                  <CheckCircle2 className="h-4 w-4" /> Accept booking
                </Button>
              </>
            )}
            {canStart && (
              <Button loading={action.isPending} onClick={() => action.mutate({ name: 'start' })}>
                <PlayCircle className="h-4 w-4" /> Start trip
              </Button>
            )}
            {canComplete && (
              <Button loading={action.isPending} onClick={() => action.mutate({ name: 'complete' })}>
                <CheckCircle2 className="h-4 w-4" /> Complete trip
              </Button>
            )}
          </>
        }
      />

      {canAccept && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Accept to confirm your lines and unlock payment for the traveller. Rejecting releases all held inventory for this booking.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Your lines</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {booking.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {humanize(item.itemType)} · {formatDateRange(item.startDate, item.endDate)} · qty {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.providerPayable)}</p>
                    <p className="text-[11px] text-slate-500">
                      of {formatCurrency(item.totalPrice)} · commission {formatCurrency(item.commissionAmount)}
                    </p>
                    <div className="mt-1 flex justify-end"><StatusBadge status={item.status} /></div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <p className="flex justify-between gap-2"><span className="text-slate-500">Your payable</span><span className="font-bold text-ink-900">{formatCurrency(payable)}</span></p>
              <p className="flex justify-between gap-2"><span className="text-slate-500">Platform commission</span><span className="font-semibold text-slate-700">{formatCurrency(commission)}</span></p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <CalendarRange className="h-4 w-4 text-primary-700" /> Status history
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
                <li className="text-sm text-slate-500">No transitions yet.</li>
              )}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <UserRound className="h-4 w-4 text-primary-700" /> Traveller
            </h2>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{booking.contact.name}</p>
              <p>{booking.contact.email}</p>
              <p>{booking.contact.phone}</p>
            </div>
            {booking.specialRequests && (
              <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-600">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Special requests</span>
                {booking.specialRequests}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-bold text-ink-900">Trip numbers</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <p className="flex justify-between gap-2"><dt className="text-slate-500">Booking total</dt><dd className="font-semibold text-slate-800">{formatCurrency(booking.totalAmount)}</dd></p>
              <p className="flex justify-between gap-2"><dt className="text-slate-500">Paid by traveller</dt><dd className="font-semibold text-slate-800">{formatCurrency(booking.paidAmount)}</dd></p>
              <p className="flex justify-between gap-2"><dt className="text-slate-500">Outstanding</dt><dd className="font-semibold text-slate-800">{formatCurrency(booking.dueAmount)}</dd></p>
            </dl>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">Payment status shown for context only. Payouts settle from your finance page after the trip completes.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject this booking?"
        description="The traveller is notified and all inventory for this booking is released."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(false)}>Keep reviewing</Button>
            <Button
              variant="danger"
              loading={action.isPending}
              disabled={reason.trim().length < 2}
              onClick={() => action.mutate({ name: 'reject', body: { reason: reason.trim() } })}
            >
              Reject booking
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason for rejection"
          required
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Dates unavailable, vehicle in maintenance…"
        />
      </Modal>
    </div>
  );
}
