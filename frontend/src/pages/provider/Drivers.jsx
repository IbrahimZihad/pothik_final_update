import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatDate, initials } from '../../lib/format';

const EMPTY_DRIVER = { name: '', phone: '', licenseNo: '', licenseExpiry: '', photo: '', vehicleId: '', status: 'ACTIVE' };

export default function ProviderDrivers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY_DRIVER);
  const [archiving, setArchiving] = useState(null);

  const drivers = useQuery({
    queryKey: ['provider', 'drivers'],
    queryFn: () => readData(api.get('/provider/drivers')),
  });

  const vehicles = useQuery({
    queryKey: ['provider', 'vehicles'],
    queryFn: () => readData(api.get('/provider/vehicles')),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        licenseNo: form.licenseNo.trim() || undefined,
        licenseExpiry: form.licenseExpiry || undefined,
        photo: form.photo.trim() || undefined,
        vehicleId: form.vehicleId ? Number(form.vehicleId) : null,
        status: form.status,
      };
      return dialog?.mode === 'edit'
        ? readData(api.patch(`/provider/drivers/${dialog.driver.id}`, payload))
        : readData(api.post('/provider/drivers', payload));
    },
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Driver updated.' : 'Driver added.');
      setDialog(null);
      queryClient.invalidateQueries({ queryKey: ['provider', 'drivers'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const archive = useMutation({
    mutationFn: (id) => readData(api.delete(`/provider/drivers/${id}`)),
    onSuccess: () => {
      toast.success('Driver archived and unassigned.');
      setArchiving(null);
      queryClient.invalidateQueries({ queryKey: ['provider', 'drivers'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (drivers.isLoading) return <PageLoader />;
  if (drivers.isError) return <EmptyState icon={Users} title="Drivers could not be loaded" description={drivers.error?.message} />;

  const items = drivers.data || [];

  return (
    <div>
      <DashHead
        eyebrow="Drivers"
        title="Your driving team"
        description="Assign drivers to vehicles and keep licence details current."
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_DRIVER);
              setDialog({ mode: 'create' });
            }}
          >
            <Plus className="h-4 w-4" /> Add driver
          </Button>
        }
      />

      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((driver) => (
            <Card key={driver.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                    {initials(driver.name)}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{driver.name}</p>
                    <p className="text-xs text-slate-500">{driver.phone || 'No phone'}</p>
                  </div>
                </div>
                <StatusBadge status={driver.status} />
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p>Licence: {driver.licenseNo || '—'}{driver.licenseExpiry ? ` · expires ${formatDate(driver.licenseExpiry)}` : ''}</p>
                <p>Vehicle: {driver.vehicle ? `${driver.vehicle.name} (${driver.vehicle.registrationNo})` : 'Not assigned'}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setForm({
                      name: driver.name || '',
                      phone: driver.phone || '',
                      licenseNo: driver.licenseNo || '',
                      licenseExpiry: driver.licenseExpiry ? String(driver.licenseExpiry).slice(0, 10) : '',
                      photo: driver.photo || '',
                      vehicleId: driver.vehicle ? String(driver.vehicle.id) : '',
                      status: driver.status || 'ACTIVE',
                    });
                    setDialog({ mode: 'edit', driver });
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setArchiving(driver)}>
                  <Trash2 className="h-3.5 w-3.5" /> Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No drivers yet"
          description="Add drivers so vehicles with a driver included can be fulfilled."
          action={<Button onClick={() => { setForm(EMPTY_DRIVER); setDialog({ mode: 'create' }); }}>Add driver</Button>}
        />
      )}

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.mode === 'edit' ? `Edit ${dialog.driver.name}` : 'Add a driver'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button loading={save.isPending} disabled={form.name.trim().length < 2} onClick={() => save.mutate()}>
              {dialog?.mode === 'edit' ? 'Save driver' : 'Add driver'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <Input label="Licence number" value={form.licenseNo} onChange={(event) => setForm({ ...form, licenseNo: event.target.value })} />
          <Input label="Licence expiry" type="date" value={form.licenseExpiry} onChange={(event) => setForm({ ...form, licenseExpiry: event.target.value })} />
          <Input label="Photo URL" value={form.photo} onChange={(event) => setForm({ ...form, photo: event.target.value })} wrapperClassName="sm:col-span-2" />
          <Select label="Assigned vehicle" value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>
            <option value="">Not assigned</option>
            {(vehicles.data || []).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.registrationNo}</option>
            ))}
          </Select>
          <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
      </Modal>

      <Modal
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        title={`Archive ${archiving?.name || 'driver'}?`}
        description="The driver is unassigned and hidden from operations."
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiving(null)}>Keep driver</Button>
            <Button variant="danger" loading={archive.isPending} onClick={() => archive.mutate(archiving.id)}>Archive driver</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Past trips stay intact. You can add the driver again later.</p>
      </Modal>
    </div>
  );
}
