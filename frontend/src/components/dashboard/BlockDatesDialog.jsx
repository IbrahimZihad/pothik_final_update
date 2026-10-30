import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, readData, errorMessage } from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/Field';
import { PageLoader } from '../ui/Spinner';
import { useToast } from '../ToastProvider';
import { todayISO, addDaysISO } from '../../lib/format';

export default function BlockDatesDialog({ open, onClose, title, resourceLabel = 'item', path, onSaved }) {
  const toast = useToast();
  const [range, setRange] = useState({ from: todayISO(), to: addDaysISO(todayISO(), 13) });
  const [rows, setRows] = useState([]);

  const availability = useQuery({
    queryKey: ['provider', 'availability', path, range],
    queryFn: () => readData(api.get(path, { params: range })),
    enabled: Boolean(open && path && range.from && range.to),
  });

  useEffect(() => {
    if (availability.data) setRows(availability.data);
  }, [availability.data]);

  const save = useMutation({
    mutationFn: () =>
      readData(
        api.put(path, {
          dates: rows
            .filter((row) => row.status !== 'BOOKED')
            .map((row) => ({ date: row.date, status: row.status })),
        })
      ),
    onSuccess: () => {
      toast.success(`${resourceLabel} availability saved.`);
      availability.refetch();
      onSaved?.();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function toggle(date) {
    setRows((current) =>
      current.map((row) =>
        row.date === date ? { ...row, status: row.status === 'BLOCKED' ? 'AVAILABLE' : 'BLOCKED' } : row
      )
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      description="Blocked dates disappear from search. Booked dates are locked by the booking engine."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button loading={save.isPending} disabled={!rows.length} onClick={() => save.mutate()}>Save availability</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="From" type="date" value={range.from} min={todayISO()} onChange={(event) => setRange({ ...range, from: event.target.value })} />
        <Input label="To" type="date" value={range.to} min={range.from} onChange={(event) => setRange({ ...range, to: event.target.value })} />
      </div>

      <div className="mt-4">
        {availability.isLoading ? (
          <PageLoader label="Loading calendar…" />
        ) : rows.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.date} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {new Date(`${row.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {row.status === 'BOOKED' ? 'Booked by a trip' : row.status === 'BLOCKED' ? 'Blocked' : 'Available'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={row.status === 'BLOCKED' ? 'primary' : 'outline'}
                  disabled={row.status === 'BOOKED'}
                  onClick={() => toggle(row.date)}
                >
                  {row.status === 'BLOCKED' ? 'Unblock' : 'Block'}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Choose a date range.</p>
        )}
      </div>
    </Modal>
  );
}
