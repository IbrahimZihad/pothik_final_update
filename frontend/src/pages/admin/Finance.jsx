import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, HandCoins, ReceiptText, RotateCcw } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import { StatCard } from '../../components/ui/Card';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { Input, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency, formatDate } from '../../lib/format';

const TABS = [
  { key: 'refunds', label: 'Refund queue' },
  { key: 'payouts', label: 'Payout queue' },
  { key: 'commissions', label: 'Commissions' },
  { key: 'payments', label: 'Payments' },
];

const STATUS_OPTIONS = {
  refunds: ['', 'REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED'],
  payouts: ['', 'REQUESTED', 'APPROVED', 'PAID', 'REJECTED'],
  commissions: ['', 'PENDING', 'EARNED', 'PAID', 'REVERSED'],
  payments: ['', 'INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
};

export default function AdminFinance() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('refunds');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({ notes: '', reference: '', providerRefundId: '' });

  const list = useQuery({
    queryKey: ['admin', 'finance', tab, { status, page }],
    queryFn: () =>
      readData(
        api.get(`/admin/${tab}`, {
          params: { page, limit: 20, ...(status ? { status } : {}) },
        })
      ),
  });

  const summary = useQuery({
    queryKey: ['admin', 'commission-summary'],
    queryFn: () => readData(api.get('/admin/commissions/summary')),
  });

  const runAction = useMutation({
    mutationFn: () => {
      const base = tab === 'refunds' ? `/admin/refunds/${action.row.id}` : `/admin/payouts/${action.row.id}`;
      const body = {};
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (tab === 'payouts' && action.name === 'paid' && form.reference.trim()) body.reference = form.reference.trim();
      if (tab === 'refunds' && action.name === 'process' && form.providerRefundId.trim()) body.providerRefundId = form.providerRefundId.trim();
      return readData(api.post(`${base}/${action.name}`, body));
    },
    onSuccess: () => {
      toast.success('Queue updated.');
      setAction(null);
      setForm({ notes: '', reference: '', providerRefundId: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'admin'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openAction(row, name) {
    setAction({ row, name });
    setForm({ notes: '', reference: row.reference || '', providerRefundId: row.providerRefundId || '' });
  }

  const summaryData = summary.data;
  const byStatus = summaryData?.byStatus || [];

  return (
    <div>
      <DashHead eyebrow="Finance" title="Money movement" description="Approve refunds, release payouts and audit commission." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Commission earned" value={formatCurrency(summaryData?.totalEarned)} icon={CircleDollarSign} tone="emerald" />
        {byStatus.map((row) => (
          <StatCard key={row.status} label={`${row.status.toLowerCase()} commission`} value={formatCurrency(row.total)} hint={`${row.count} ledger rows`} icon={ReceiptText} tone="slate" />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((entry) => (
            <Button key={entry.key} size="sm" variant={tab === entry.key ? 'primary' : 'outline'} onClick={() => { setTab(entry.key); setStatus(''); setPage(1); }}>
              {entry.label}
            </Button>
          ))}
        </div>
        <select className="input w-auto" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
          {STATUS_OPTIONS[tab].map((entry) => (
            <option key={entry || 'all'} value={entry}>{entry ? entry.replaceAll('_', ' ').toLowerCase() : 'All statuses'}</option>
          ))}
        </select>
      </div>

      <Card className="mt-4 overflow-hidden">
        {list.isLoading ? (
          <PageLoader />
        ) : list.isError ? (
          <p className="px-4 py-8 text-sm text-rose-700">Could not load {tab}.</p>
        ) : list.data?.items?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className="table-head">{tab === 'payments' ? 'Created' : 'Booking'}</th>
                    <th className="table-head">{tab === 'payments' ? 'Gateway' : tab === 'payouts' ? 'Provider' : 'Reference'}</th>
                    <th className="table-head">Amount</th>
                    <th className="table-head">Status</th>
                    <th className="table-head">Details</th>
                    <th className="table-head text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.data.items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="table-cell whitespace-nowrap">
                        {tab === 'payments' ? formatDate(row.createdAt) : row.bookingReference || row.reference || formatDate(row.createdAt)}
                      </td>
                      <td className="table-cell">
                        {tab === 'payments' ? (
                          <span className="capitalize">{row.provider} · {row.method}</span>
                        ) : tab === 'payouts' ? (
                          <span>{row.providerName || `Provider #${row.providerProfileId}`}</span>
                        ) : (
                          <span className="font-mono text-xs">{row.bookingReference || `#${row.bookingId}`}</span>
                        )}
                      </td>
                      <td className="table-cell font-semibold">{formatCurrency(row.amount)}</td>
                      <td className="table-cell"><StatusBadge status={row.status} /></td>
                      <td className="table-cell max-w-[240px] text-xs text-slate-500">
                        {tab === 'commissions' ? (
                          <span>{row.title} · {Number(row.rate).toFixed(1)}%</span>
                        ) : tab === 'payouts' ? (
                          <span>{row.method || '—'} · requested {formatDate(row.requestedAt || row.createdAt)}</span>
                        ) : tab === 'refunds' ? (
                          <span className="line-clamp-2">{row.reason}</span>
                        ) : (
                          <span>{row.providerTxnId || 'No transaction id'}</span>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        {tab === 'refunds' && row.status === 'REQUESTED' && (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => openAction(row, 'approve')}>Approve</Button>
                            <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => openAction(row, 'reject')}>Reject</Button>
                          </div>
                        )}
                        {tab === 'refunds' && row.status === 'APPROVED' && (
                          <Button size="sm" onClick={() => openAction(row, 'process')}>Mark processed</Button>
                        )}
                        {tab === 'payouts' && ['REQUESTED', 'APPROVED'].includes(row.status) && (
                          <div className="flex justify-end gap-1.5">
                            {row.status === 'REQUESTED' && <Button size="sm" variant="outline" onClick={() => openAction(row, 'approve')}>Approve</Button>}
                            {row.status === 'APPROVED' && <Button size="sm" onClick={() => openAction(row, 'paid')}>Mark paid</Button>}
                            <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => openAction(row, 'reject')}>Reject</Button>
                          </div>
                        )}
                        {['payments', 'commissions'].includes(tab) && <span className="text-xs text-slate-400">View-only</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination meta={list.data.meta} onPageChange={setPage} className="mt-4 flex items-center justify-center gap-1.5" />
            </div>
          </>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nothing in this queue.</p>
        )}
      </Card>

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={`${action?.name === 'paid' ? 'Mark payout paid' : `${action?.name || ''} refund`.replace(/^./, (char) => char.toUpperCase())}`}
        description={action?.row ? `${formatCurrency(action.row.amount)} · ${action.row.bookingReference || action.row.providerName || 'record'}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button loading={runAction.isPending} onClick={() => runAction.mutate()}>Confirm</Button>
          </>
        }
      >
        <div className="space-y-4">
          {tab === 'payouts' && action?.name === 'paid' && (
            <Input label="Transfer reference" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="bKash / bank transaction id" />
          )}
          {tab === 'refunds' && action?.name === 'process' && (
            <Input
              label="Gateway refund id"
              value={form.providerRefundId}
              onChange={(event) => setForm({ ...form, providerRefundId: event.target.value })}
              placeholder="Refund reference from the gateway"
            />
          )}
          <Textarea label="Notes" rows={3} maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional internal note, stored with the record." />
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
            Actions are audited and notify the traveller or provider. Status transitions are validated by the backend.
          </p>
        </div>
      </Modal>
    </div>
  );
}
