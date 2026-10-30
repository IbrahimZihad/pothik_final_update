import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Hotel, Plus } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency } from '../../lib/format';

const EMPTY_HOTEL = {
  name: '',
  starRating: '3',
  address: '',
  phone: '',
  email: '',
  destinationId: '',
  description: '',
  image: '',
  status: 'DRAFT',
};

export default function ProviderHotels() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_HOTEL);

  const hotels = useQuery({
    queryKey: ['provider', 'hotels'],
    queryFn: () => readData(api.get('/provider/hotels')),
  });

  const destinations = useQuery({
    queryKey: ['destinations', 'options'],
    queryFn: () => readData(api.get('/destinations', { params: { limit: 50 } })),
    staleTime: 10 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: () =>
      readData(
        api.post('/provider/hotels', {
          name: form.name.trim(),
          starRating: Number(form.starRating),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          destinationId: form.destinationId ? Number(form.destinationId) : undefined,
          description: form.description.trim() || undefined,
          image: form.image.trim() || undefined,
          status: form.status,
        })
      ),
    onSuccess: () => {
      toast.success('Hotel created. Add rooms to make it bookable.');
      queryClient.invalidateQueries({ queryKey: ['provider', 'hotels'] });
      setCreating(false);
      setForm(EMPTY_HOTEL);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (hotels.isLoading) return <PageLoader />;
  if (hotels.isError) {
    return <EmptyState icon={Hotel} title="Hotels could not be loaded" description={hotels.error?.message} />;
  }

  const items = hotels.data || [];

  return (
    <div>
      <DashHead
        eyebrow="My hotels"
        title="Stays and room inventory"
        description="Publish properties, manage rooms and control nightly availability."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add hotel
          </Button>
        }
      />

      {items.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((hotel) => (
            <Card key={hotel.id} className="overflow-hidden">
              <div className="h-36 bg-slate-100">
                {hotel.image ? (
                  <img src={hotel.image} alt={hotel.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-slate-300"><Hotel className="h-10 w-10" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-ink-900">{hotel.name}</h2>
                    <p className="text-xs text-slate-500">{hotel.destination?.name || 'Bangladesh'}</p>
                  </div>
                  <StatusBadge status={hotel.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{hotel.starRating ? `${hotel.starRating}★` : 'Unrated'}</span>
                  <span>{hotel.roomCount ?? 0} room types</span>
                  <span>{hotel.totalUnits ?? 0} units</span>
                  {hotel.minPrice ? <span>From {formatCurrency(hotel.minPrice)}</span> : null}
                </div>
                <Button as={Link} to={`/provider/hotels/${hotel.id}`} variant="outline" size="sm" className="mt-4 w-full">
                  <Building2 className="h-4 w-4" /> Manage hotel
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Hotel}
          title="No properties yet"
          description="Create your first hotel, then add room types with live inventory."
          action={<Button onClick={() => setCreating(true)}>Add hotel</Button>}
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        size="lg"
        title="Add a hotel"
        description="Draft now, publish once rooms are ready."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button loading={create.isPending} disabled={form.name.trim().length < 2} onClick={() => create.mutate()}>
              Create hotel
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Hotel name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} wrapperClassName="sm:col-span-2" />
          <Select label="Star rating" value={form.starRating} onChange={(event) => setForm({ ...form, starRating: event.target.value })}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>
            ))}
          </Select>
          <Select label="Destination" value={form.destinationId} onChange={(event) => setForm({ ...form, destinationId: event.target.value })}>
            <option value="">Not linked</option>
            {(destinations.data?.items || []).map((destination) => (
              <option key={destination.id} value={destination.id}>{destination.name}</option>
            ))}
          </Select>
          <Input label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} wrapperClassName="sm:col-span-2" />
          <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input label="Cover image URL" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} wrapperClassName="sm:col-span-2" placeholder="/images/hotel.jpg" />
          <Textarea label="Description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} wrapperClassName="sm:col-span-2" />
          <Select label="Visibility" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Submit for review</option>
            <option value="PUBLISHED">Published</option>
          </Select>
        </div>
        <p className="mt-4 text-xs text-slate-500">Providers with a pending profile can save drafts; booking goes live after admin approval.</p>
      </Modal>
    </div>
  );
}
