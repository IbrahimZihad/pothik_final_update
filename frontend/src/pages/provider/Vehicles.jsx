import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Car, Plus } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BlockDatesDialog from '../../components/dashboard/BlockDatesDialog';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency } from '../../lib/format';

const EMPTY_VEHICLE = {
  name: '',
  model: '',
  registrationNo: '',
  categoryId: '',
  capacity: '',
  pricePerDay: '',
  pricePerKm: '',
  image: '',
  features: '',
  driverIncluded: true,
  status: 'ACTIVE',
};

export default function ProviderVehicles() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY_VEHICLE);
  const [availability, setAvailability] = useState(null);

  const vehicles = useQuery({
    queryKey: ['provider', 'vehicles'],
    queryFn: () => readData(api.get('/provider/vehicles')),
  });

  const categories = useQuery({
    queryKey: ['vehicle-categories'],
    queryFn: () => readData(api.get('/vehicle-categories')),
    staleTime: 30 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        model: form.model.trim() || undefined,
        registrationNo: form.registrationNo.trim(),
        categoryId: Number(form.categoryId),
        capacity: Number(form.capacity),
        pricePerDay: form.pricePerDay ? Number(form.pricePerDay) : undefined,
        pricePerKm: form.pricePerKm ? Number(form.pricePerKm) : undefined,
        image: form.image.trim() || undefined,
        features: form.features.trim() ? form.features.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
        driverIncluded: form.driverIncluded,
        status: form.status,
      };
      return dialog?.mode === 'edit'
        ? readData(api.patch(`/provider/vehicles/${dialog.vehicle.id}`, payload))
        : readData(api.post('/provider/vehicles', payload));
    },
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Vehicle updated.' : 'Vehicle added.');
      setDialog(null);
      queryClient.invalidateQueries({ queryKey: ['provider', 'vehicles'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (vehicles.isLoading) return <PageLoader />;
  if (vehicles.isError) {
    return <EmptyState icon={Car} title="Fleet could not be loaded" description={vehicles.error?.message} />;
  }

  const items = vehicles.data || [];

  function openCreate() {
    const firstCategory = categories.data?.[0];
    setForm({ ...EMPTY_VEHICLE, categoryId: firstCategory ? String(firstCategory.id) : '' });
    setDialog({ mode: 'create' });
  }

  function openEdit(vehicle) {
    setForm({
      name: vehicle.name || '',
      model: vehicle.model || '',
      registrationNo: vehicle.registrationNo || '',
      categoryId: String(vehicle.categoryId || vehicle.category?.id || ''),
      capacity: String(vehicle.capacity || ''),
      pricePerDay: vehicle.pricePerDay ? String(vehicle.pricePerDay) : '',
      pricePerKm: vehicle.pricePerKm ? String(vehicle.pricePerKm) : '',
      image: vehicle.image || '',
      features: (vehicle.features || []).join(', '),
      driverIncluded: Boolean(vehicle.driverIncluded),
      status: vehicle.status || 'ACTIVE',
    });
    setDialog({ mode: 'edit', vehicle });
  }

  const invalid = form.name.trim().length < 2 || form.registrationNo.trim().length < 3 || Number(form.capacity) < 1 || !form.categoryId;

  return (
    <div>
      <DashHead
        eyebrow="My fleet"
        title="Vehicles and drivers"
        description="Price per day or per kilometre; the booking engine applies your rates."
        actions={
          <Button onClick={openCreate} disabled={categories.isLoading}>
            <Plus className="h-4 w-4" /> Add vehicle
          </Button>
        }
      />

      {items.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((vehicle) => (
            <Card key={vehicle.id} className="overflow-hidden">
              <div className="h-36 bg-slate-100">
                {vehicle.image ? (
                  <img src={vehicle.image} alt={vehicle.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-slate-300"><Car className="h-10 w-10" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-ink-900">{vehicle.name}</h2>
                    <p className="font-mono text-[11px] text-slate-400">{vehicle.registrationNo}</p>
                  </div>
                  <StatusBadge status={vehicle.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{vehicle.category?.name || 'Vehicle'}</span>
                  <span>{vehicle.capacity} seats</span>
                  {vehicle.pricePerDay ? <span>{formatCurrency(vehicle.pricePerDay)}/day</span> : null}
                  {vehicle.pricePerKm ? <span>{formatCurrency(vehicle.pricePerKm)}/km</span> : null}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(vehicle)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAvailability(vehicle)}>
                    <CalendarDays className="h-3.5 w-3.5" /> Dates
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Car}
          title="No vehicles yet"
          description="Add your first vehicle with capacity and rates to appear in search."
          action={<Button onClick={openCreate} disabled={categories.isLoading}>Add vehicle</Button>}
        />
      )}

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        size="lg"
        title={dialog?.mode === 'edit' ? `Edit ${dialog.vehicle.name}` : 'Add a vehicle'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>
              {dialog?.mode === 'edit' ? 'Save vehicle' : 'Add vehicle'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Vehicle name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Toyota Hiace" />
          <Input label="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="2022" />
          <Input label="Registration no." required value={form.registrationNo} onChange={(event) => setForm({ ...form, registrationNo: event.target.value })} placeholder="DHAKA METRO-GA-11-2233" />
          <Select label="Category" required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            <option value="">Choose a category</option>
            {(categories.data || []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <Input label="Seats" type="number" min="1" max="100" required value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
          <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PENDING_REVIEW">Pending review</option>
          </Select>
          <Input label="Price per day (BDT)" type="number" min="0" value={form.pricePerDay} onChange={(event) => setForm({ ...form, pricePerDay: event.target.value })} />
          <Input label="Price per km (BDT)" type="number" min="0" value={form.pricePerKm} onChange={(event) => setForm({ ...form, pricePerKm: event.target.value })} />
          <Input label="Image URL" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} wrapperClassName="sm:col-span-2" />
          <Input label="Features" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} hint="Comma separated, e.g. AC, WiFi, Luggage" wrapperClassName="sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary-600"
              checked={form.driverIncluded}
              onChange={(event) => setForm({ ...form, driverIncluded: event.target.checked })}
            />
            Driver included in the base rate
          </label>
        </div>
      </Modal>

      <BlockDatesDialog
        open={Boolean(availability)}
        path={availability ? `/provider/vehicles/${availability.id}/availability` : null}
        title={`Availability · ${availability?.name || ''}`}
        resourceLabel="Vehicle"
        onClose={() => setAvailability(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['provider', 'vehicles'] })}
      />
    </div>
  );
}
