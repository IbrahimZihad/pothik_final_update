import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import { newIdempotencyKey } from '../../lib/idempotency';
import DashHead from '../../components/dashboard/DashHead';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency, formatDateRange } from '../../lib/format';

const METHODS = [
  { value: 'card', label: 'Card (Visa / Mastercard)' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'sslcommerz', label: 'SSLCommerz' },
];

export default function PayBooking() {
  const { reference } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [method, setMethod] = useState('card');
  const [amount, setAmount] = useState('');

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', reference],
    queryFn: () => readData(api.get(`/bookings/${reference}`)),
  });

  const initiate = useMutation({
    mutationFn: () =>
      readData(
        api.post('/payments', {
          bookingReference: reference,
          amount: Number(amount || booking.dueAmount),
          method,
          idempotencyKey: newIdempotencyKey(),
        })
      ),
    onSuccess: (data) => {
      if (data.payment?.provider === 'demo') {
        navigate(`/pay/demo/${data.payment.id}`);
        return;
      }
      if (data.gatewayUrl) {
        window.location.assign(data.gatewayUrl);
        return;
      }
      toast.info('Payment session created. Open your gateway to finish.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <PageLoader />;
  if (!booking) {
    return <EmptyState icon={CreditCard} title="Booking not found" action={<Button as={Link} to="/account/bookings">All bookings</Button>} />;
  }

  const due = Number(booking.dueAmount || 0);
  const payable = ['AWAITING_PAYMENT', 'CONFIRMED'].includes(booking.status) && due > 0;
  const entered = amount === '' ? due : Number(amount);
  const invalid = !Number.isFinite(entered) || entered <= 0 || entered > due;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to={`/account/bookings/${reference}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to booking
      </Link>

      <DashHead
        eyebrow={`Booking ${booking.reference}`}
        title="Complete your payment"
        description={`${formatDateRange(booking.startDate, booking.endDate)} · server-verified totals`}
      />

      {!payable ? (
        <EmptyState
          icon={BadgeCheck}
          title="Nothing to pay right now"
          description={
            booking.status === 'AWAITING_CONFIRMATION'
              ? 'Payment unlocks when every provider accepts your booking.'
              : 'This booking is not awaiting payment.'
          }
          action={<Button as={Link} to={`/account/bookings/${reference}`} variant="outline">View booking</Button>}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="p-6 lg:col-span-3">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!invalid) initiate.mutate();
              }}
            >
              <Input
                label="Amount to pay (BDT)"
                type="number"
                min="1"
                step="0.01"
                max={due}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={String(due)}
                hint={`Outstanding balance: ${formatCurrency(due)}. Partial payments are allowed.`}
                error={amount !== '' && invalid ? `Enter an amount between 1 and ${formatCurrency(due)}.` : undefined}
              />
              <Select label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </Select>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Lock className="h-3.5 w-3.5" /> Every callback is verified before confirmation
                </p>
                <p className="mt-1">
                  Payments are submitted with an idempotency key, so a retry can never charge twice. The booking confirms only after the
                  gateway signature is validated by our backend.
                </p>
              </div>

              <Button type="submit" loading={initiate.isPending} disabled={invalid} className="w-full">
                <CreditCard className="h-4 w-4" /> Pay {formatCurrency(entered)}
              </Button>
            </form>
          </Card>

          <Card className="h-fit p-6 lg:col-span-2">
            <h2 className="text-base font-bold text-ink-900">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Trip total</dt>
                <dd className="font-semibold text-slate-800">{formatCurrency(booking.totalAmount)}</dd>
              </div>
              {Number(booking.discountTotal) > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Discount</dt>
                  <dd className="font-semibold text-emerald-700">− {formatCurrency(booking.discountTotal)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Already paid</dt>
                <dd className="font-semibold text-slate-800">{formatCurrency(booking.paidAmount)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                <dt className="font-semibold text-slate-800">Due now</dt>
                <dd className="text-lg font-bold text-ink-900">{formatCurrency(due)}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              In demo environments the signed sandbox gateway simulates the provider. Production uses SSLCommerz, bKash or Nagad.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
