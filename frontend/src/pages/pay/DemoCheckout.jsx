import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, FlaskConical, LockKeyhole } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/Badge';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency } from '../../lib/format';

export default function DemoCheckout() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: payment, isLoading, isError, refetch } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => readData(api.get(`/payments/${paymentId}`)),
  });

  const complete = useMutation({
    mutationFn: () => readData(api.post(`/payments/${paymentId}/demo-complete`)),
    onSuccess: async () => {
      toast.success('Sandbox payment verified. Your booking is updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['booking'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' }),
      ]);
      const refreshed = await refetch();
      const reference = refreshed.data?.bookingReference || payment?.bookingReference;
      if (reference) navigate(`/account/bookings/${reference}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <PageLoader label="Opening the sandbox gateway…" />;
  if (isError || !payment) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={LockKeyhole} title="Payment not found" description="This payment does not belong to your account." />
      </div>
    );
  }

  const paid = payment.status === 'SUCCEEDED';

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-600">
          <FlaskConical className="h-4 w-4" /> Sandbox gateway
        </div>
        <Card className="overflow-hidden">
          <div className="bg-ink-900 px-6 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Payment link</p>
            <p className="mt-2 text-3xl font-bold">{formatCurrency(payment.amount)}</p>
            <p className="mt-1 text-xs text-white/70">Booking {payment.bookingReference}</p>
          </div>
          <div className="space-y-4 px-6 py-6">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Status</span>
              <StatusBadge status={payment.status} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Method</span>
              <span className="font-medium uppercase text-slate-700">{payment.method || '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Gateway</span>
              <span className="font-medium text-slate-700">{payment.provider}</span>
            </div>

            {paid ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-semibold">
                  <BadgeCheck className="h-4 w-4" /> Payment verified
                </p>
                <p className="mt-1 text-emerald-700">The backend validated the signed callback and updated your booking.</p>
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                This demo gateway signs a callback exactly like a real provider. Completing it exercises the same verification and booking
                transition code used in production — no real money moves.
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              {!paid && (
                <Button onClick={() => complete.mutate()} loading={complete.isPending} disabled={payment.status !== 'INITIATED' && payment.status !== 'PENDING'}>
                  <LockKeyhole className="h-4 w-4" /> Pay {formatCurrency(payment.amount)} in sandbox
                </Button>
              )}
              <Button
                as={Link}
                to={payment.bookingReference ? `/account/bookings/${payment.bookingReference}` : '/account/bookings'}
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4" /> {paid ? 'Back to booking' : 'Leave without paying'}
              </Button>
            </div>
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-500">
          Production deployments refuse to boot with the demo gateway enabled.
        </p>
      </div>
    </div>
  );
}
