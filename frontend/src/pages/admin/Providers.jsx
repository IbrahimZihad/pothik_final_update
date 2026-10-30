import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Search, ShieldCheck } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { Input, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatDate } from '../../lib/format';

const TYPES = ['HOTEL', 'TRANSPORT', 'GUIDE'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

export default function AdminProviders() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ type: '', status: '', search: '' });
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'providers', { ...filters, page }],
    queryFn: () =>
      readData(
        api.get('/admin/providers', {
          params: {
            page,
            limit: 20,
            ...(filters.type ? { type: filters.type } : {}),
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.search ? { search: filters.search } : {}),
          },
        })
      ),
  });

  const detail = useQuery({
    queryKey: ['admin', 'provider', selected?.id],
    queryFn: () => readData(api.get(`/admin/providers/${selected.id}`)),
    enabled: Boolean(selected?.id),
  });

  const decide = useMutation({
    mutationFn: ({ action, body }) => readData(api.post(`/admin/providers/${selected.id}/${action}`, body || {})),
    onSuccess: (_, variables) => {
      const done = { approve: 'approved', reject: 'rejected', suspend: 'suspended' }[variables.action] || 'updated';
      toast.success(`Provider ${done}.`);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'admin'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reviewDocument = useMutation({
    mutationFn: ({ documentId, status, notes }) =>
      readData(api.patch(`/admin/providers/${selected.id}/documents/${documentId}`, { status, ...(notes ? { notes } : {}) })),
    onSuccess: () => {
      toast.success('Document reviewed.');
      detail.refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const [decision, setDecision] = useState({ action: null, reason: '', commissionRate: '' });

  function openDecision(action) {
    setDecision({ action, reason: '', commissionRate: selected.commissionRate != null ? String(selected.commissionRate) : '' });
  }

  function submitDecision() {
    const body = {};
    if (decision.reason.trim()) body.reason = decision.reason.trim();
    if (decision.action === 'approve' && decision.commissionRate !== '') body.commissionRate = Number(decision.commissionRate);
    decide.mutate({ action: decision.action, body });
  }

  const profile = detail.data || selected;

  return (
    <div>
      <DashHead eyebrow="Providers" title="Application queue" description="Review businesses, verify documents and set commission rates." />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <form
          className="flex flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((current) => ({ ...current, search: term.trim() }));
            setPage(1);
          }}
        >
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input className="input pl-9" placeholder="Business name" value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Search providers" />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>
        <select className="input w-auto" value={filters.type} onChange={(event) => { setFilters({ ...filters, type: event.target.value }); setPage(1); }} aria-label="Filter by type">
          <option value="">All types</option>
          {TYPES.map((type) => <option key={type} value={type}>{type.toLowerCase()}</option>)}
        </select>
        <select className="input w-auto" value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status.toLowerCase()}</option>)}
        </select>
      </Card>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <EmptyState icon={ShieldCheck} title="Providers could not be loaded" />
      ) : data?.items?.length ? (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className="table-head">Business</th>
                    <th className="table-head">Owner</th>
                    <th className="table-head">Type</th>
                    <th className="table-head">Documents</th>
                    <th className="table-head">Commission</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((provider) => (
                    <tr key={provider.id} className="hover:bg-slate-50/60">
                      <td className="table-cell">
                        <p className="font-semibold text-slate-800">{provider.businessName}</p>
                        <p className="text-[11px] text-slate-400">Joined {formatDate(provider.createdAt)}</p>
                      </td>
                      <td className="table-cell text-xs">
                        <p className="text-slate-700">{provider.user?.name}</p>
                        <p className="text-slate-400">{provider.user?.email}</p>
                      </td>
                      <td className="table-cell capitalize">{provider.type.toLowerCase()}</td>
                      <td className="table-cell text-xs">{provider.documents?.length || 0} uploaded</td>
                      <td className="table-cell">{provider.commissionRate != null ? `${Number(provider.commissionRate).toFixed(1)}%` : 'Default'}</td>
                      <td className="table-cell"><StatusBadge status={provider.status} /></td>
                      <td className="table-cell text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelected(provider)}>Open</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={ShieldCheck} title="No providers in this view" />
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => { setSelected(null); setDecision({ action: null, reason: '', commissionRate: '' }); }}
        size="xl"
        title={profile?.businessName || 'Provider'}
        description={profile ? `${profile.type.toLowerCase()} · applied ${formatDate(profile.createdAt)}` : ''}
        footer={
          profile?.status === 'PENDING' ? (
            <>
              <Button variant="ghost" onClick={() => openDecision('reject')}>Reject</Button>
              <Button onClick={() => openDecision('approve')}>Approve provider</Button>
            </>
          ) : profile?.status === 'APPROVED' ? (
            <Button variant="danger" onClick={() => openDecision('suspend')}>Suspend provider</Button>
          ) : (
            <Button onClick={() => openDecision('approve')}>Reactivate / approve</Button>
          )
        }
      >
        {detail.isLoading ? (
          <PageLoader label="Loading application…" />
        ) : profile ? (
          <div className="space-y-5">
            {decision.action ? (
              <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                <p className="text-sm font-semibold capitalize text-primary-900">{decision.action} provider</p>
                <div className="mt-3 space-y-3">
                  {decision.action === 'approve' && (
                    <Input
                      label="Commission rate (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={decision.commissionRate}
                      onChange={(event) => setDecision({ ...decision, commissionRate: event.target.value })}
                      hint="Leave blank to use the platform default."
                    />
                  )}
                  <Textarea
                    label="Reason / notes"
                    rows={3}
                    maxLength={500}
                    value={decision.reason}
                    onChange={(event) => setDecision({ ...decision, reason: event.target.value })}
                    placeholder={decision.action === 'reject' ? 'What needs fixing before approval?' : 'Optional notes for the audit log.'}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDecision({ action: null, reason: '', commissionRate: '' })}>Cancel</Button>
                    <Button size="sm" loading={decide.isPending} onClick={submitDecision}>Confirm {decision.action}</Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Owner</p>
                <p className="mt-1 font-semibold text-slate-800">{profile.user?.name || '—'}</p>
                <p className="text-xs text-slate-500">{profile.user?.email}</p>
                <p className="text-xs text-slate-500">{profile.user?.phone || 'No phone'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Business</p>
                <p className="mt-1 font-semibold text-slate-800">{profile.businessName}</p>
                <p className="text-xs text-slate-500">{profile.phone || 'No phone'} · {profile.address || 'No address'}</p>
                <p className="mt-1 text-xs text-slate-500">Commission: {profile.commissionRate != null ? `${Number(profile.commissionRate).toFixed(1)}%` : 'platform default'}</p>
              </div>
            </div>

            {profile.description && <p className="text-sm leading-6 text-slate-600">{profile.description}</p>}
            {profile.rejectionReason && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Last decision: {profile.rejectionReason}</p>}

            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FileCheck2 className="h-4 w-4 text-primary-700" /> Verification documents
              </h3>
              {profile.documents?.length ? (
                <ul className="mt-2 space-y-2">
                  {profile.documents.map((document) => (
                    <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                      <div>
                        <a href={document.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-800 hover:text-primary-700">
                          {document.type.replaceAll('_', ' ').toLowerCase()}
                        </a>
                        <p className="text-[11px] text-slate-400">{document.notes || 'No notes'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={document.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          loading={reviewDocument.isPending}
                          onClick={() => reviewDocument.mutate({ documentId: document.id, status: 'VERIFIED' })}
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => reviewDocument.mutate({ documentId: document.id, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No documents uploaded yet.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Provider not found.</p>
        )}
      </Modal>
    </div>
  );
}
