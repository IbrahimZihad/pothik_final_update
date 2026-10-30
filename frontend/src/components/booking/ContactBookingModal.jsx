import { useEffect, useState } from 'react';
import { api, readData, errorMessage } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../ToastProvider';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/Field';

export default function ContactBookingModal({ open, onClose, payload, summary, onCreated, title = 'Confirm traveller details' }) {
  const auth = useAuth();
  const toast = useToast();
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setContact({
      name: auth.user?.name || '',
      phone: auth.user?.phone || '',
      email: auth.user?.email || '',
    });
  }, [open, auth.user]);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const booking = await readData(api.post('/bookings', { ...payload, contact }));
      toast.success(`Booking ${booking.reference} created. Providers will confirm shortly.`);
      onClose?.();
      onCreated?.(booking);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={title}
      description="We use these details for provider confirmation and payment receipts."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="contact-booking-form" loading={submitting}>
            Create booking
          </Button>
        </>
      }
    >
      <form id="contact-booking-form" onSubmit={submit} className="space-y-4">
        {summary && <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{summary}</div>}
        <Input
          label="Full name"
          value={contact.name}
          onChange={(event) => setContact({ ...contact, name: event.target.value })}
          required
          minLength={2}
          autoComplete="name"
        />
        <Input
          label="Phone"
          value={contact.phone}
          onChange={(event) => setContact({ ...contact, phone: event.target.value })}
          required
          placeholder="01XXXXXXXXX"
          autoComplete="tel"
        />
        <Input
          label="Email"
          type="email"
          value={contact.email}
          onChange={(event) => setContact({ ...contact, email: event.target.value })}
          required
          autoComplete="email"
        />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <p className="text-xs leading-5 text-slate-500">
          Nothing is charged now. Inventory is held while providers confirm, and you pay from your booking page once the booking is ready.
        </p>
      </form>
    </Modal>
  );
}
