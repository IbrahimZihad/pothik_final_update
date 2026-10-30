import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck, UserCog, Users } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../auth/AuthProvider';
import { formatDate } from '../../lib/format';

const ROLES = ['ADMIN', 'CUSTOMER', 'HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE'];
const USER_STATUSES = ['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED'];

export default function AdminUsers() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [statusUser, setStatusUser] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: 'ACTIVE', reason: '' });
  const [rolesUser, setRolesUser] = useState(null);
  const [roleDraft, setRoleDraft] = useState([]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users', { ...filters, page }],
    queryFn: () =>
      readData(
        api.get('/admin/users', {
          params: {
            page,
            limit: 20,
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.role ? { role: filters.role } : {}),
            ...(filters.status ? { status: filters.status } : {}),
          },
        })
      ),
  });

  const setStatus = useMutation({
    mutationFn: () =>
      readData(api.patch(`/admin/users/${statusUser.id}/status`, {
        status: statusForm.status,
        ...(statusForm.reason.trim() ? { reason: statusForm.reason.trim() } : {}),
      })),
    onSuccess: () => {
      toast.success('User status updated.');
      setStatusUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const setRoles = useMutation({
    mutationFn: () => readData(api.put(`/admin/users/${rolesUser.id}/roles`, { roles: roleDraft })),
    onSuccess: () => {
      toast.success('Roles updated.');
      setRolesUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function update(patch) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  return (
    <div>
      <DashHead eyebrow="User management" title="People on POTHIK" description="Search accounts, adjust roles and suspend access when needed." />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <form
          className="flex flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update({ search: term.trim() });
          }}
        >
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className="input pl-9"
              placeholder="Name, email or phone"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              aria-label="Search users"
            />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>
        <select className="input w-auto" value={filters.role} onChange={(event) => update({ role: event.target.value })} aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ').toLowerCase()}</option>)}
        </select>
        <select className="input w-auto" value={filters.status} onChange={(event) => update({ status: event.target.value })} aria-label="Filter by status">
          <option value="">All statuses</option>
          {USER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ').toLowerCase()}</option>)}
        </select>
      </Card>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <EmptyState icon={Users} title="Users could not be loaded" />
      ) : data?.items?.length ? (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className="table-head">User</th>
                    <th className="table-head">Roles</th>
                    <th className="table-head">Provider</th>
                    <th className="table-head">Status</th>
                    <th className="table-head">Joined</th>
                    <th className="table-head text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60">
                      <td className="table-cell">
                        <p className="font-semibold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        {user.phone && <p className="text-[11px] text-slate-400">{user.phone}</p>}
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <span key={role} className="chip bg-slate-100 text-[10px] text-slate-600">{role.replaceAll('_', ' ').toLowerCase()}</span>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell text-xs">
                        {user.providerProfile ? (
                          <span className="capitalize">
                            {user.providerProfile.type.toLowerCase()} · {user.providerProfile.status.toLowerCase()}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="table-cell"><StatusBadge status={user.status} /></td>
                      <td className="table-cell whitespace-nowrap text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                      <td className="table-cell text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRolesUser(user);
                              setRoleDraft(user.roles);
                            }}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Roles
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={user.id === auth.user?.id}
                            onClick={() => {
                              setStatusUser(user);
                              setStatusForm({ status: user.status, reason: '' });
                            }}
                          >
                            <UserCog className="h-3.5 w-3.5" /> Status
                          </Button>
                        </div>
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
        <EmptyState icon={Users} title="No users match these filters" description="Try a different role or clear the search." />
      )}

      <Modal
        open={Boolean(statusUser)}
        onClose={() => setStatusUser(null)}
        title={`Change status · ${statusUser?.name || ''}`}
        description="Suspension blocks sign-in immediately. The reason is recorded in the audit log."
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusUser(null)}>Cancel</Button>
            <Button loading={setStatus.isPending} disabled={!statusForm.status} onClick={() => setStatus.mutate()}>Update status</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="New status" value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })}>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>{status.replaceAll('_', ' ').toLowerCase()}</option>
            ))}
          </Select>
          <Textarea label="Reason" rows={3} maxLength={500} value={statusForm.reason} onChange={(event) => setStatusForm({ ...statusForm, reason: event.target.value })} />
        </div>
      </Modal>

      <Modal
        open={Boolean(rolesUser)}
        onClose={() => setRolesUser(null)}
        title={`Roles · ${rolesUser?.name || ''}`}
        description="Roles replace the current set. At least one role is required."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRolesUser(null)}>Cancel</Button>
            <Button loading={setRoles.isPending} disabled={!roleDraft.length} onClick={() => setRoles.mutate()}>Save roles</Button>
          </>
        }
      >
        <div className="space-y-2">
          {ROLES.map((role) => (
            <label key={role} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600"
                checked={roleDraft.includes(role)}
                onChange={(event) =>
                  setRoleDraft((current) =>
                    event.target.checked ? [...current, role] : current.filter((entry) => entry !== role)
                  )
                }
              />
              <span className="capitalize">{role.replaceAll('_', ' ').toLowerCase()}</span>
            </label>
          ))}
        </div>
        {rolesUser?.id === auth.user?.id && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">You are editing your own roles. Keep ADMIN checked to retain access.</p>
        )}
      </Modal>
    </div>
  );
}
