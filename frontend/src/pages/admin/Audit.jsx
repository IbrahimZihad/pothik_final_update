import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api, readData } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import Pagination from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/format';

const FILTERS = { action: '', entityType: '', actorUserId: '', from: '', to: '' };

function metadataPreview(metadata) {
  if (!metadata) return '—';
  const text = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

export default function AdminAudit() {
  const [filters, setFilters] = useState(FILTERS);
  const [page, setPage] = useState(1);

  const logs = useQuery({
    queryKey: ['admin', 'audit-logs', { ...filters, page }],
    queryFn: () =>
      readData(
        api.get('/admin/audit-logs', {
          params: {
            page,
            limit: 30,
            ...(filters.action ? { action: filters.action.trim() } : {}),
            ...(filters.entityType ? { entityType: filters.entityType.trim() } : {}),
            ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
          },
        })
      ),
  });

  function update(patch) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  return (
    <div>
      <DashHead
        eyebrow="Audit trail"
        title="Privileged activity"
        description="Every administrative mutation is recorded with its actor and request id."
        actions={
          <Button variant="outline" onClick={() => { setFilters(FILTERS); setPage(1); }}>
            Clear filters
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input label="Action" value={filters.action} onChange={(event) => update({ action: event.target.value })} placeholder="refund.approved" />
        <Input label="Entity type" value={filters.entityType} onChange={(event) => update({ entityType: event.target.value })} placeholder="booking" />
        <Input label="Actor user id" type="number" min="1" value={filters.actorUserId} onChange={(event) => update({ actorUserId: event.target.value })} />
        <Input label="From" type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
        <Input label="To" type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} />
      </div>

      {logs.isLoading ? (
        <PageLoader />
      ) : logs.isError ? (
        <EmptyState icon={ScrollText} title="Audit logs could not be loaded" />
      ) : logs.data?.items?.length ? (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className="table-head">When</th>
                    <th className="table-head">Action</th>
                    <th className="table-head">Entity</th>
                    <th className="table-head">Actor</th>
                    <th className="table-head">Metadata</th>
                    <th className="table-head">Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.data.items.map((log) => (
                    <tr key={log.id} className="align-top hover:bg-slate-50/60">
                      <td className="table-cell whitespace-nowrap text-xs text-slate-500">{formatDate(log.createdAt)}</td>
                      <td className="table-cell">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">{log.action}</span>
                      </td>
                      <td className="table-cell text-xs text-slate-600">
                        {log.entityType}
                        {log.entityId ? <span className="text-slate-400"> #{log.entityId}</span> : null}
                      </td>
                      <td className="table-cell text-xs">
                        {log.actor ? (
                          <>
                            <p className="font-semibold text-slate-700">{log.actor.name}</p>
                            <p className="text-slate-400">{log.actor.email}</p>
                          </>
                        ) : (
                          <span className="text-slate-400">System</span>
                        )}
                      </td>
                      <td className="table-cell max-w-[280px]">
                        <code className="block truncate text-[11px] text-slate-500" title={log.metadata ? JSON.stringify(log.metadata) : undefined}>
                          {metadataPreview(log.metadata)}
                        </code>
                      </td>
                      <td className="table-cell text-[11px] text-slate-400">
                        <p className="font-mono">{log.requestId || '—'}</p>
                        <p>IP {log.ip || '—'}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination meta={logs.data.meta} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={ScrollText} title="No audit entries match" description="Widen the filters or clear them to see the full trail." />
      )}
    </div>
  );
}
