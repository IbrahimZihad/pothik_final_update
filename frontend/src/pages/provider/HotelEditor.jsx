import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BedDouble, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import RoomAvailabilityDialog from '../../components/dashboard/RoomAvailabilityDialog';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency } from '../../lib/format';

const EMPTY_ROOM = {
  name: '',
  roomType: 'DOUBLE',
  description: '',
  capacityAdults: '2',
  capacityChildren: '0',
  basePrice: '',
  extraBedPrice: '',
  totalUnits: '1',
  minStayNights: '1',
  maxStayNights: '',
  image: '',
  amenities: '',
  status: 'ACTIVE',
};

function roomToForm(room) {
  return {
    name: room.name || '',
    roomType: room.roomType || 'DOUBLE',
    description: room.description || '',
    capacityAdults: String(room.capacityAdults ?? 2),
    capacityChildren: String(room.capacityChildren ?? 0),
    basePrice: String(room.basePrice ?? ''),
    extraBedPrice: String(room.extraBedPrice ?? ''),
    totalUnits: String(room.totalUnits ?? 1),
    minStayNights: String(room.minStayNights ?? 1),
    maxStayNights: room.maxStayNights ? String(room.maxStayNights) : '',
    image: room.image || '',
    amenities: (room.amenities || []).join(', '),
    status: room.status || 'ACTIVE',
  };
}

function roomPayload(form) {
  return {
    name: form.name.trim(),
    roomType: form.roomType,
    description: form.description.trim() || undefined,
    capacityAdults: Number(form.capacityAdults),
    capacityChildren: Number(form.capacityChildren || 0),
    basePrice: Number(form.basePrice),
    extraBedPrice: form.extraBedPrice ? Number(form.extraBedPrice) : undefined,
    totalUnits: Number(form.totalUnits),
    minStayNights: Number(form.minStayNights || 1),
    maxStayNights: form.maxStayNights ? Number(form.maxStayNights) : undefined,
    image: form.image.trim() || undefined,
    amenities: form.amenities.trim() ? form.amenities.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    status: form.status,
  };
}

export default function HotelEditor() {
  const { hotelId } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [roomDialog, setRoomDialog] = useState(null);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM);
  const [availabilityRoom, setAvailabilityRoom] = useState(null);
  const [archiving, setArchiving] = useState(null);

  const hotels = useQuery({
    queryKey: ['provider', 'hotels'],
    queryFn: () => readData(api.get('/provider/hotels')),
  });

  const hotel = hotels.data?.find((entry) => Number(entry.id) === Number(hotelId));

  useEffect(() => {
    if (hotel) {
      setForm({
        name: hotel.name || '',
        starRating: String(hotel.starRating || 3),
        address: hotel.address || '',
        phone: hotel.phone || '',
        email: hotel.email || '',
        description: hotel.description || '',
        image: hotel.image || '',
        checkinTime: hotel.checkinTime || '14:00',
        checkoutTime: hotel.checkoutTime || '12:00',
        facilities: (hotel.facilities || []).join(', '),
        gallery: (hotel.gallery || []).join(', '),
        status: hotel.status || 'DRAFT',
      });
    }
  }, [hotel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider', 'hotels'] });

  const saveHotel = useMutation({
    mutationFn: () =>
      readData(
        api.patch(`/provider/hotels/${hotelId}`, {
          name: form.name.trim(),
          starRating: Number(form.starRating),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          description: form.description.trim() || undefined,
          image: form.image.trim() || undefined,
          checkInTime: form.checkinTime,
          checkOutTime: form.checkoutTime,
          facilities: form.facilities.trim() ? form.facilities.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
          gallery: form.gallery.trim() ? form.gallery.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
          status: form.status,
        })
      ),
    onSuccess: () => {
      toast.success('Hotel saved.');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveRoom = useMutation({
    mutationFn: () => {
      const payload = roomPayload(roomForm);
      if (roomDialog?.mode === 'edit') return readData(api.patch(`/provider/rooms/${roomDialog.room.id}`, payload));
      return readData(api.post(`/provider/hotels/${hotelId}/rooms`, payload));
    },
    onSuccess: () => {
      toast.success(roomDialog?.mode === 'edit' ? 'Room updated.' : 'Room added.');
      setRoomDialog(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const archiveRoom = useMutation({
    mutationFn: (roomId) => readData(api.delete(`/provider/rooms/${roomId}`)),
    onSuccess: () => {
      toast.success('Room archived. It is hidden from search.');
      setArchiving(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (hotels.isLoading) return <PageLoader />;
  if (!hotel || !form) {
    return (
      <EmptyState
        icon={BedDouble}
        title="Hotel not found"
        description="This property does not belong to your business."
        action={<Button as={Link} to="/provider/hotels" variant="outline">My hotels</Button>}
      />
    );
  }

  const roomInvalid =
    roomForm.name.trim().length < 1 || Number(roomForm.basePrice) <= 0 || Number(roomForm.totalUnits) < 1;

  return (
    <div>
      <Link to="/provider/hotels" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> My hotels
      </Link>

      <DashHead
        eyebrow="Hotel manager"
        title={hotel.name}
        description={hotel.destination?.name ? `${hotel.destination.name} · ${hotel.rooms?.length || 0} room types` : `${hotel.rooms?.length || 0} room types`}
        actions={<StatusBadge status={hotel.status} />}
      />

      <div className="space-y-5">
        <Card className="p-6">
          <h2 className="text-base font-bold text-ink-900">Property details</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveHotel.mutate();
            }}
          >
            <Input label="Hotel name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} wrapperClassName="xl:col-span-2" />
            <Select label="Star rating" value={form.starRating} onChange={(event) => setForm({ ...form, starRating: event.target.value })}>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>
              ))}
            </Select>
            <Input label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} wrapperClassName="xl:col-span-2" />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Check-in" type="time" value={form.checkinTime} onChange={(event) => setForm({ ...form, checkinTime: event.target.value })} />
            <Input label="Check-out" type="time" value={form.checkoutTime} onChange={(event) => setForm({ ...form, checkoutTime: event.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Cover image URL" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} wrapperClassName="sm:col-span-2" />
            <Input label="Facilities" value={form.facilities} onChange={(event) => setForm({ ...form, facilities: event.target.value })} hint="Comma separated, e.g. WiFi, Pool, Breakfast" wrapperClassName="sm:col-span-2" />
            <Input label="Gallery URLs" value={form.gallery} onChange={(event) => setForm({ ...form, gallery: event.target.value })} hint="Comma separated image URLs" />
            <Select label="Visibility" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Submit for review</option>
              <option value="PUBLISHED">Published</option>
            </Select>
            <Textarea
              label="Description"
              rows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              wrapperClassName="sm:col-span-2 xl:col-span-3"
            />
            <div className="sm:col-span-2 xl:col-span-3">
              <Button type="submit" loading={saveHotel.isPending} disabled={form.name.trim().length < 2}>Save property</Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink-900">Room types</h2>
              <p className="text-xs text-slate-500">Each room type tracks its own nightly inventory.</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setRoomForm(EMPTY_ROOM);
                setRoomDialog({ mode: 'create' });
              }}
            >
              <Plus className="h-4 w-4" /> Add room
            </Button>
          </div>

          {hotel.rooms?.length ? (
            <div className="mt-4 space-y-3">
              {hotel.rooms.map((room) => (
                <div key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{room.name}</p>
                      <StatusBadge status={room.status} />
                      <span className="chip bg-slate-100 text-slate-600">{room.roomType.toLowerCase()}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCurrency(room.basePrice)} / night · sleeps {room.capacityAdults}
                      {room.capacityChildren ? ` + ${room.capacityChildren} children` : ''} · {room.totalUnits} units · min {room.minStayNights} night(s)
                    </p>
                    {room.amenities?.length > 0 && <p className="mt-0.5 truncate text-[11px] text-slate-400">{room.amenities.join(' · ')}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAvailabilityRoom(room)}>
                      <CalendarDays className="h-3.5 w-3.5" /> Availability
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRoomForm(roomToForm(room));
                        setRoomDialog({ mode: 'edit', room });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setArchiving(room)}>
                      <Trash2 className="h-3.5 w-3.5" /> Archive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No room types yet. A hotel becomes bookable once it has at least one active room.
            </p>
          )}
        </Card>
      </div>

      <Modal
        open={Boolean(roomDialog)}
        onClose={() => setRoomDialog(null)}
        size="lg"
        title={roomDialog?.mode === 'edit' ? `Edit ${roomDialog.room.name}` : 'Add a room type'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoomDialog(null)}>Cancel</Button>
            <Button loading={saveRoom.isPending} disabled={roomInvalid} onClick={() => saveRoom.mutate()}>
              {roomDialog?.mode === 'edit' ? 'Save room' : 'Add room'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Room name" required value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} wrapperClassName="sm:col-span-2" placeholder="Deluxe sea view" />
          <Select label="Room type" value={roomForm.roomType} onChange={(event) => setRoomForm({ ...roomForm, roomType: event.target.value })}>
            {['SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'FAMILY', 'DORMITORY'].map((type) => (
              <option key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</option>
            ))}
          </Select>
          <Select label="Status" value={roomForm.status} onChange={(event) => setRoomForm({ ...roomForm, status: event.target.value })}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <Input label="Base price / night (BDT)" type="number" min="1" required value={roomForm.basePrice} onChange={(event) => setRoomForm({ ...roomForm, basePrice: event.target.value })} />
          <Input label="Extra bed price" type="number" min="0" value={roomForm.extraBedPrice} onChange={(event) => setRoomForm({ ...roomForm, extraBedPrice: event.target.value })} />
          <Input label="Adults" type="number" min="1" max="20" value={roomForm.capacityAdults} onChange={(event) => setRoomForm({ ...roomForm, capacityAdults: event.target.value })} />
          <Input label="Children" type="number" min="0" max="10" value={roomForm.capacityChildren} onChange={(event) => setRoomForm({ ...roomForm, capacityChildren: event.target.value })} />
          <Input label="Total units" type="number" min="1" max="500" required value={roomForm.totalUnits} onChange={(event) => setRoomForm({ ...roomForm, totalUnits: event.target.value })} hint="Cannot drop below units already reserved." />
          <Input label="Minimum stay (nights)" type="number" min="1" value={roomForm.minStayNights} onChange={(event) => setRoomForm({ ...roomForm, minStayNights: event.target.value })} />
          <Input label="Maximum stay (nights)" type="number" min="1" value={roomForm.maxStayNights} onChange={(event) => setRoomForm({ ...roomForm, maxStayNights: event.target.value })} />
          <Input label="Image URL" value={roomForm.image} onChange={(event) => setRoomForm({ ...roomForm, image: event.target.value })} />
          <Input label="Amenities" value={roomForm.amenities} onChange={(event) => setRoomForm({ ...roomForm, amenities: event.target.value })} hint="Comma separated" wrapperClassName="sm:col-span-2" />
          <Textarea label="Description" rows={3} value={roomForm.description} onChange={(event) => setRoomForm({ ...roomForm, description: event.target.value })} wrapperClassName="sm:col-span-2" />
        </div>
      </Modal>

      <Modal
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        title={`Archive ${archiving?.name || 'room'}?`}
        description="Archiving keeps past bookings intact but hides the room from new searches."
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiving(null)}>Keep room</Button>
            <Button variant="danger" loading={archiveRoom.isPending} onClick={() => archiveRoom.mutate(archiving.id)}>Archive room</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Existing reservations are unaffected. You can reactivate the room later by editing it.</p>
      </Modal>

      <RoomAvailabilityDialog
        open={Boolean(availabilityRoom)}
        room={availabilityRoom}
        onClose={() => setAvailabilityRoom(null)}
        onSaved={invalidate}
      />
    </div>
  );
}
