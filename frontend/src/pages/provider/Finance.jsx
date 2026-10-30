import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, Banknote, HandCoins, Wallet } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import { StatCard } from '../../components/ui/Card';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency, formatDate } from '../../lib/format';

export default function ProviderFinance() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('commissions');
  const [commissionPage, setCommissionPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const [requesting, setRequesting] = useState(false);
  const [form, setForm] = useState({ amount: '', method: 'bkash', notes: '' });

  const finance = useQuery({
    queryKey: ['provider', 'finance'],
    queryFn: () => readData(api.get('/provider/finance')),
  });

  const commissions = useQuery({
    queryKey: ['provider', 'commissions', commissionPage],
    queryFn: () => readData(api.get('/provider/commissions', { params: { page: commissionPage, limit: 15 } })),
  });

  const payouts = useQuery({
    queryKey: ['provider', 'payouts', payoutPage],
    queryFn: () => readData(api.get('/provider/payouts', { params: { page: payoutPage, limit: 15 } })),
  });

  const requestPayout = useMutation({
    mutationFn: () =>
      readData(
        api.post('/provider/payouts', {
          amount: Number(form.amount),
          method: form.method,
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        })
      ),
    onSuccess: () => {
      toast.success('Payout requested. Finance will review it.');
      setRequesting(false);
      setForm({ amount: '', method: 'bkash', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['provider', 'finance'] });
      queryClient.invalidateQueries({ queryKey: ['provider', 'payouts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'provider'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (finance.isLoading) return <PageLoader />;
  if (finance.isError) {
    return <EmptyState icon={Wallet} title="Finance is unavailable" description={finance.error?.message} />;
  }

  const data = finance.data || {};
  const available = Number(data.available || 0);
  const amountInvalid = !form.amount || Number(form.amount) <= 0 || Number(form.amount) > available;

  return (
    <div>
      <DashHead
        eyebrow="Finance"
        title="Earnings and payouts"
        description="Commission is deducted at booking time; payouts settle against cleared earnings."
        actions={
          <Button onClick={() => { setForm({ amount: String(available || ''), method: 'bkash', notes: '' }); setRequesting(true); }} disabled={available <= 0}>
            <HandCoins className="h-4 w-4" /> Request payout
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Earned" value={formatCurrency(data.earned)} icon={Banknote} tone="emerald" />
        <StatCard label="Requested" value={formatCurrency(data.requested)} icon={Wallet} tone="amber" />
        <StatCard label="Approved" value={formatCurrency(data.approved)} icon={BadgePercent} tone="secondary" />
        <StatCard label="Available" value={formatCurrency(available)} icon={HandCoins} />
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant={tab === 'commissions' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('commissions')}>
          Commission ledger
        </Button>
        <Button variant={tab === 'payouts' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('payouts')}>
          Payout requests
        </Button>
      </div>

      <Card className="mt-4 overflow-hidden">
        {tab === 'commissions' ? (
          commissions.isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Loading commission ledger…</p>
          ) : commissions.data?.items?.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-slate-100 bg-slate-50/70">
                    <tr>
                      <th className="table-head">Booking</th>
                      <th className="table-head">Service</th>
                      <th className="table-head">Gross</th>
                      <th className="table-head">Rate</th>
                      <th className="table-head">Commission</th>
                      <th className="table-head">Status</th>
                      <th className="table-head">Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commissions.data.items.map((row) => (
                      <tr key={row.id}>
                        <td className="table-cell font-mono text-xs">{row.bookingId || '—'}</td>
                        <td className="table-cell">
                          <p className="font-medium text-slate-800">{row.title}</p>
                          <p className="text-[11px] text-slate-500">{row.itemType?.toLowerCase()}</p>
                        </td>
                        <td className="table-cell">{formatCurrency(row.grossAmount)}</td>
                        <td className="table-cell">{Number(row.rate).toFixed(1)}%</td>
                        <td className="table-cell font-semibold">{formatCurrency(row.amount)}</td>
                        <td className="table-cell"><StatusBadge status={row.status} /></td>
                        <td className="table-cell whitespace-nowrap text-xs text-slate-500">{formatDate(row.earnedAt) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4">
                <Pagination meta={commissions.data.meta} onPageChange={setCommissionPage} className="mt-4 flex items-center justify-center gap-1.5" />
              </div>
            </>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No commissions recorded yet.</p>
          )
        ) : payouts.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Loading payouts…</p>
        ) : payouts.data?.items?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className="table-head">Requested</th>
                    <th className="table-head">Amount</th>
                    <th className="table-head">Method</th>
                    <th className="table-head">Status</th>
                    <th className="table-head">Reference</th>
                    <th className="table-head">Processed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.data.items.map((row) => (
                    <tr key={row.id}>
                      <td className="table-cell whitespace-nowrap">{formatDate(row.requestedAt || row.createdAt)}</td>
                      <td className="table-cell font-semibold">{formatCurrency(row.amount)}</td>
                      <td className="table-cell uppercase">{row.method || '—'}</td>
                      <td className="table-cell"><StatusBadge status={row.status} /></td>
                      <td className="table-cell font-mono text-xs">{row.reference || '—'}</td>
                      <td className="table-cell whitespace-nowrap text-xs text-slate-500">{row.processedAt ? formatDate(row.processedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination meta={payouts.data.meta} onPageChange={setPayoutPage} className="mt-4 flex items-center justify-center gap-1.5" />
            </div>
          </>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No payout requests yet.</p>
        )}
      </Card>

      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Request a payout"
        description="Finance reviews each request before money is released."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRequesting(false)}>Cancel</Button>
            <Button loading={requestPayout.isPending} disabled={amountInvalid} onClick={() => requestPayout.mutate()}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount (BDT)"
            type="number"
            min="1"
            step="0.01"
            max={available}
            required
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            hint={`Available: ${formatCurrency(available)}`}
            error={form.amount && amountInvalid ? 'Amount exceeds your available balance.' : undefined}
          />
          <Select label="Payout method" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
          </Select>
          <Textarea label="Notes (optional)" rows={3} maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
