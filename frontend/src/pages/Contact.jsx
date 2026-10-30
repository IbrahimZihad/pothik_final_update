import { Link } from 'react-router-dom';
import { CalendarCheck, LifeBuoy, MapPin, MessageSquareText, ShieldCheck } from 'lucide-react';
import PageIntro from '../components/site/PageIntro';
import Button from '../components/ui/Button';

const CHANNELS = [
  {
    icon: MessageSquareText,
    title: 'Booking messages',
    text: 'Every booking has a private thread with the providers on it. Sign in, open the booking and send a message — it reaches the right operator.',
    to: '/account/bookings',
    cta: 'Open my bookings',
  },
  {
    icon: CalendarCheck,
    title: 'Changes and cancellations',
    text: 'Cancellation rules come from the booking policy shown on the trip. You can request a cancellation from the booking page; refunds are reviewed by finance.',
    to: '/account/bookings',
    cta: 'Manage a booking',
  },
  {
    icon: LifeBuoy,
    title: 'Provider support',
    text: 'Providers manage listings, calendars and payouts from their dashboard. Pending applications are reviewed by the admin team.',
    to: '/provider',
    cta: 'Provider dashboard',
  },
];

export default function Contact() {
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="Support that stays attached to your booking"
        description="POTHIK keeps conversations with the booking they belong to, so hotels, operators and guides see the same context you do."
      />

      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5 sm:grid-cols-2">
          {CHANNELS.map((channel) => (
            <div key={channel.title} className="card flex flex-col p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-700">
                <channel.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-base font-bold text-ink-900">{channel.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{channel.text}</p>
              <Button as={Link} to={channel.to} variant="outline" size="sm" className="mt-4 self-start">{channel.cta}</Button>
            </div>
          ))}
          <div className="card p-6 sm:col-span-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <ShieldCheck className="h-5 w-5 text-primary-600" aria-hidden="true" /> Payments and refunds
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A booking becomes payable only after its provider lines are accepted. Payment callbacks are verified on the server; refunds appear in the booking payment history.
              If a gateway callback fails, the booking stays unpaid rather than guessing — retry from the booking page.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button as={Link} to="/help" variant="outline" size="sm">Read the help centre</Button>
              <Button as={Link} to="/account/bookings" size="sm">Check a payment</Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <MapPin className="h-4 w-4 text-primary-600" aria-hidden="true" /> Operating from
            </h2>
            <p className="mt-2 text-sm text-slate-600">Dhaka, Bangladesh</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Support runs through booking threads and dashboards so every conversation carries the booking reference.</p>
          </div>
          <div className="card p-6">
            <h2 className="text-sm font-bold text-ink-900">Before you write</h2>
            <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
              <li>Have the booking reference ready — it starts with PK-.</li>
              <li>Check the cancellation policy on the booking detail page.</li>
              <li>For provider approvals, use the provider dashboard status banner.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
