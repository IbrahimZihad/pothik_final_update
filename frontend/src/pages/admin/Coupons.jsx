import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, Pencil, Plus } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { Input, Select, Textarea } from '../../components/ui/Field';
import Badge from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency, formatDate } from '../../lib/format';

const EMPTY = {
  code: '',
  description: '',
  type: 'PERCENT',
  value: '',
  minSpend: '0',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '1',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

function couponToForm(coupon) {
  return {
    code: coupon.code || '',
    description: coupon.description || '',
    type: coupon.type || 'PERCENT',
    value: String(coupon.value ?? ''),
    minSpend: String(coupon.minSpend ?? 0),
    maxDiscount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : '',
    usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
    perUserLimit: String(coupon.perUserLimit ?? 1),
    startsAt: coupon.startsAt ? String(coupon.startsAt).slice(0, 10) : '',
    endsAt: coupon.endsAt ? String(coupon.endsAt).slice(0, 10) : '',
    isActive: Boolean(coupon.isActive),
  };
}

export default function AdminCoupons() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const coupons = useQuery({
    queryKey: ['admin', 'coupons', { search, page }],
    queryFn: () => readData(api.get('/admin/coupons', { params: { page, limit: 20, ...(search ? { search } : {}) } })),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        type: form.type,
        value: Number(form.value),
        minSpend: Number(form.minSpend || 0),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: Number(form.perUserLimit || 1),
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        isActive: form.isActive,
      };
      return dialog?.mode === 'edit'
        ? readData(api.patch(`/admin/coupons/${dialog.coupon.id}`, payload))
        : readData(api.post('/admin/coupons', payload));
    },
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Coupon updated.' : 'Coupon created.');
      setDialog(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deactivate = useMutation({
    mutationFn: (id) => readData(api.delete(`/admin/coupons/${id}`)),
    onSuccess: () => {
      toast.success('Coupon deactivated.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const invalid = form.code.trim().length < 3 || Number(form.value) <= 0;

  return (
    <div>
      <DashHead
        eyebrow="Coupons"
        title="Discount campaigns"
        description="Coupons are evaluated by the booking engine, never by the browser."
        actions={
          <Button onClick={() => { setForm(EMPTY); setDialog({ mode: 'create' }); }}>
            <Plus className="h-4 w-4" /> Create coupon
          </Button>
        }
      />

      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(term.trim());
          setPage(1);
        }}
      >
        <input className="input max-w-xs" placeholder="Search code" value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Search coupons" />
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>

      {coupons.isLoading ? (
        <PageLoader />
      ) : coupons.isError ? (
        <EmptyState icon={BadgePercent} title="Coupons could not be loaded" />
      ) : coupons.data?.items?.length ? (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className="table-head">Code</th>
                    <th className="table-head">Discount</th>
                    <th className="table-head">Minimum</th>
                    <th className="table-head">Window</th>
                    <th className="table-head">Usage</th>
                    <th className="table-head">State</th>
                    <th className="table-head text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.data.items.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-slate-50/60">
                      <td className="table-cell">
                        <p className="font-mono text-xs font-bold text-ink-900">{coupon.code}</p>
                        <p className="text-[11px] text-slate-500">{coupon.description || 'No description'}</p>
                      </td>
                      <td className="table-cell font-semibold">
                        {coupon.type === 'PERCENT' ? `${Number(coupon.value)}%` : formatCurrency(coupon.value)}
                        {coupon.maxDiscount ? <span className="block text-[11px] font-normal text-slate-500">max {formatCurrency(coupon.maxDiscount)}</span> : null}
                      </td>
                      <td className="table-cell">{formatCurrency(coupon.minSpend)}</td>
                      <td className="table-cell text-xs text-slate-500">
                        {coupon.startsAt ? formatDate(coupon.startsAt) : 'Any'} → {coupon.endsAt ? formatDate(coupon.endsAt) : 'Open'}
                      </td>
                      <td className="table-cell text-xs">
                        {coupon.usedCount} used{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                        <span className="block text-slate-400">per user {coupon.perUserLimit}</span>
                      </td>
                      <td className="table-cell">
                        <Badge tone={coupon.isActive ? 'emerald' : 'slate'} dot>{coupon.isActive ? 'active' : 'inactive'}</Badge>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => { setForm(couponToForm(coupon)); setDialog({ mode: 'edit', coupon }); }}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          {coupon.isActive && (
                            <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" loading={deactivate.isPending} onClick={() => deactivate.mutate(coupon.id)}>
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination meta={coupons.data.meta} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={BadgePercent} title="No coupons yet" description="Create a campaign to offer a percentage or fixed discount." />
      )}

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        size="lg"
        title={dialog?.mode === 'edit' ? `Edit ${dialog.coupon.code}` : 'Create a coupon'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>
              {dialog?.mode === 'edit' ? 'Save coupon' : 'Create coupon'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Code" required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="POTHIK10" />
          <Select label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="PERCENT">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </Select>
          <Input
            label={form.type === 'PERCENT' ? 'Percentage off' : 'Amount off (BDT)'}
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.value}
            onChange={(event) => setForm({ ...form, value: event.target.value })}
          />
          <Input label="Minimum spend (BDT)" type="number" min="0" value={form.minSpend} onChange={(event) => setForm({ ...form, minSpend: event.target.value })} />
          {form.type === 'PERCENT' && (
            <Input label="Maximum discount (BDT)" type="number" min="0" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} hint="Optional cap for percentage coupons." />
          )}
          <Input label="Total usage limit" type="number" min="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} />
          <Input label="Per-user limit" type="number" min="1" max="100" value={form.perUserLimit} onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })} />
          <Input label="Starts" type="date" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
          <Input label="Ends" type="date" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
          <Textarea label="Description" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} wrapperClassName="sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary-600" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            Active immediately
          </label>
        </div>
      </Modal>
    </div>
  );
}
