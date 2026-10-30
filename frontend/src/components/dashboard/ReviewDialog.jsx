import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import { RatingInput } from '../ui/Rating';
import { api, readData, errorMessage } from '../../lib/api';
import { useToast } from '../ToastProvider';

const REVIEWABLE = new Set(['HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE']);

export function reviewableItems(booking) {
  return (booking?.items || []).filter((item) => REVIEWABLE.has(item.itemType) && item.refId);
}

export default function ReviewDialog({ open, onClose, booking }) {
  const toast = useToast();
  const items = reviewableItems(booking);
  const [target, setTarget] = useState('');
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setTarget(items[0] ? `${items[0].itemType}:${items[0].refId}` : '');
      setRating(5);
      setTitle('');
      setComment('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (payload) => readData(api.post('/reviews', payload)),
    onSuccess: () => {
      toast.success('Review submitted. It will appear after moderation.');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const selected = items.find((item) => `${item.itemType}:${item.refId}` === target);

  function submit(event) {
    event.preventDefault();
    if (!selected) return;
    mutation.mutate({
      bookingId: booking.id,
      targetType: selected.itemType,
      targetId: selected.refId,
      rating,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Write a review"
      description={`Booking ${booking?.reference || ''} · verified by a completed trip`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="review-form" loading={mutation.isPending} disabled={!selected}>
            Submit review
          </Button>
        </>
      }
    >
      <form id="review-form" className="space-y-4" onSubmit={submit}>
        <Select label="Which service?" value={target} onChange={(event) => setTarget(event.target.value)} required>
          {items.map((item) => (
            <option key={`${item.itemType}:${item.refId}`} value={`${item.itemType}:${item.refId}`}>
              {item.title} · {item.itemType.toLowerCase()}
            </option>
          ))}
        </Select>
        <div>
          <p className="label">Your rating</p>
          <RatingInput value={rating} onChange={setRating} />
        </div>
        <Input label="Headline" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="Great location, smooth check-in" />
        <Textarea
          label="Your experience"
          rows={4}
          maxLength={3000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What should other travellers know?"
        />
        <p className="text-xs text-slate-500">Reviews are moderated before they appear publicly.</p>
      </form>
    </Modal>
  );
}
