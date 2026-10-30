import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ToastProvider';
import { formatDate } from '../../lib/format';

export default function Notifications() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { unreadOnly, page }],
    queryFn: () =>
      readData(api.get('/notifications', { params: { page, limit: 20, ...(unreadOnly ? { unread: 'true' } : {}) } })),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'customer'] });
  };

  const markRead = useMutation({
    mutationFn: (id) => readData(api.post(`/notifications/${id}/read`)),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const markAll = useMutation({
    mutationFn: () => readData(api.post('/notifications/read-all')),
    onSuccess: () => {
      toast.success('All notifications marked as read.');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <DashHead
        eyebrow="Notifications"
        title="Booking updates"
        description="Confirmations, payment results and provider messages."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600"
                checked={unreadOnly}
                onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }}
              />
              Unread only
            </label>
            <Button variant="outline" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          </>
        }
      />

      {isLoading ? (
        <CardSkeleton count={4} />
      ) : data?.items?.length ? (
        <>
          <ul className="space-y-2">
            {data.items.map((notification) => (
              <li
                key={notification.id}
                className={`card flex gap-3 p-4 ${notification.readAt ? 'opacity-75' : 'border-primary-200 bg-primary-50/30'}`}
              >
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${notification.readAt ? 'bg-slate-100 text-slate-500' : 'bg-primary-100 text-primary-700'}`}>
                  {notification.readAt ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{notification.type?.replaceAll('.', ' ')}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>{formatDate(notification.createdAt, 'DD MMM YYYY, HH:mm')}</span>
                    {notification.data?.reference && (
                      <Link className="font-semibold text-primary-700 hover:underline" to={`/account/bookings/${notification.data.reference}`}>
                        {notification.data.reference}
                      </Link>
                    )}
                    {!notification.readAt && (
                      <button
                        type="button"
                        className="font-semibold text-primary-700 hover:underline"
                        onClick={() => markRead.mutate(notification.id)}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={Bell} title="No notifications" description="Payment results and booking updates will land here." />
      )}
    </div>
  );
}
