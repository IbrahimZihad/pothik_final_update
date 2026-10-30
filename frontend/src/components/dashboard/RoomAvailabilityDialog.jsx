import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarRange } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/Field';
import { PageLoader } from '../ui/Spinner';
import { useToast } from '../ToastProvider';
import { todayISO, addDaysISO, formatCurrency } from '../../lib/format';

export default function RoomAvailabilityDialog({ open, onClose, room, onSaved }) {
  const toast = useToast();
  const [range, setRange] = useState({ from: todayISO(), to: addDaysISO(todayISO(), 13) });
  const [rows, setRows] = useState([]);

  const availability = useQuery({
    queryKey: ['provider', 'room-availability', room?.id, range],
    queryFn: () => readData(api.get(`/provider/rooms/${room.id}/availability`, { params: range })),
    enabled: Boolean(open && room?.id && range.from && range.to),
  });

  useEffect(() => {
    if (availability.data) {
      setRows(
        availability.data.map((row) => ({
          ...row,
          priceInput: row.priceOverride === null || row.priceOverride === undefined ? '' : String(row.priceOverride),
        }))
      );
    }
  }, [availability.data]);

  const save = useMutation({
    mutationFn: () =>
      readData(
        api.put(`/provider/rooms/${room.id}/availability`, {
          dates: rows.map((row) => ({
            date: row.date,
            isBlocked: row.isBlocked,
            priceOverride: row.priceInput === '' ? null : Number(row.priceInput),
          })),
        })
      ),
    onSuccess: () => {
      toast.success('Room availability saved.');
      availability.refetch();
      onSaved?.();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function update(date, patch) {
    setRows((current) => current.map((row) => (row.date === date ? { ...row, ...patch } : row)));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Availability · ${room?.name || ''}`}
      description="Block dates or override the nightly price. Reserved units cannot be blocked."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button loading={save.isPending} disabled={!rows.length} onClick={() => save.mutate()}>Save availability</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="From"
          type="date"
          value={range.from}
          min={todayISO()}
          onChange={(event) => setRange({ ...range, from: event.target.value })}
        />
        <Input
          label="To"
          type="date"
          value={range.to}
          min={range.from}
          onChange={(event) => setRange({ ...range, to: event.target.value })}
        />
      </div>

      <div className="mt-4">
        {availability.isLoading ? (
          <PageLoader label="Loading calendar…" />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className="table-head">Date</th>
                  <th className="table-head">Units</th>
                  <th className="table-head">Reserved</th>
                  <th className="table-head">Blocked</th>
                  <th className="table-head">Price override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.date} className="align-middle">
                    <td className="table-cell whitespace-nowrap font-medium">{new Date(`${row.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}</td>
                    <td className="table-cell">
                      {row.totalUnits}
                      <span className="ml-1 text-[11px] text-slate-400">({row.availableUnits} left)</span>
                    </td>
                    <td className="table-cell">{row.reservedUnits}</td>
                    <td className="table-cell">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-primary-600"
                          checked={row.isBlocked}
                          disabled={Number(row.reservedUnits) > 0}
                          onChange={(event) => update(row.date, { isBlocked: event.target.checked })}
                        />
                        {row.isBlocked ? 'Blocked' : 'Open'}
                      </label>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          className="input max-w-[120px] py-1.5"
                          placeholder={formatCurrency(room?.basePrice)}
                          value={row.priceInput}
                          onChange={(event) => update(row.date, { priceInput: event.target.value })}
                          aria-label={`Price override for ${row.date}`}
                        />
                        <CalendarRange className="h-4 w-4 text-slate-300" aria-hidden="true" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Choose a date range to edit availability.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">Overrides apply to nightly base price before taxes. Empty means the room&apos;s base price.</p>
    </Modal>
  );
}
