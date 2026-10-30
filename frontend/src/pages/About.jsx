import { Link } from 'react-router-dom';
import { BadgeCheck, Globe2, Layers, ShieldCheck, Sparkles } from 'lucide-react';
import PageIntro from '../components/site/PageIntro';
import Button from '../components/ui/Button';
import SectionHeading from '../components/ui/SectionHeading';

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: 'Server-priced, always',
    text: 'Every quote and booking total is calculated by the backend from published rates, then re-verified at payment. Clients never send totals.',
  },
  {
    icon: BadgeCheck,
    title: 'Provider-confirmed inventory',
    text: 'Hotels hold rooms, operators hold vehicles and guides confirm dates before a booking becomes payable. No silent overbooking.',
  },
  {
    icon: Layers,
    title: 'One trip, many services',
    text: 'A custom trip combines stays, transport, guides and platform add-ons into one reference, one status trail and one payment history.',
  },
  {
    icon: Globe2,
    title: 'Built for Bangladesh',
    text: 'BDT pricing, Bangla and English, and provider workflows designed around how trips here are actually assembled.',
  },
];

const ROLES = [
  { title: 'Travellers', text: 'Build a trip, review a server quotation, pay securely and review completed stays.', to: '/register', cta: 'Create traveller account' },
  { title: 'Hotel owners', text: 'Publish rooms, set nightly availability and manage confirmations from a single dashboard.', to: '/register', cta: 'Apply as hotel' },
  { title: 'Transport providers', text: 'List vehicles and drivers, block dates and accept transport lines of a booking.', to: '/register', cta: 'Apply as operator' },
  { title: 'Tour guides', text: 'Publish a verified profile, calendar and rates, then confirm guide requests.', to: '/register', cta: 'Apply as guide' },
];

export default function About() {
  return (
    <>
      <PageIntro
        eyebrow="About POTHIK"
        title="A travel agency built as one system, not a marketplace of loose parts"
        description="POTHIK coordinates hotels, transport and local guides so a Bangladesh trip can be planned, priced and paid in one place — with each provider confirming their own inventory."
      >
        <div className="flex flex-wrap gap-3">
          <Button as={Link} to="/plan">Plan a trip</Button>
          <Button as={Link} to="/packages" variant="outline">Browse packages</Button>
        </div>
      </PageIntro>

      <section className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Why we exist</p>
            <h2 className="mt-2 text-2xl font-extrabold text-ink-900 sm:text-3xl">Planning a trip here usually means five conversations and three spreadsheets.</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
              <p>
                A hotel quote does not know about the jeep to Sajek. The guide does not know the ferry time. The transport operator cannot see whether the room is still held.
                POTHIK replaces that with a single booking engine that prices each line, holds inventory and tracks every provider confirmation.
              </p>
              <p>
                This deployment is an OTA — not an ERP. Each provider sees only their own bookings, listings and payouts. Travellers see their own trips. Administrators moderate the platform,
                approve providers and manage finance.
              </p>
            </div>
          </div>
          <div className="card bg-ink-900 p-8 text-white">
            <Sparkles className="h-7 w-7 text-secondary-400" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-bold">What “verified” means here</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
              <li>Provider profiles and documents are reviewed before listings go live.</li>
              <li>Reviews require a completed booking for that exact service.</li>
              <li>Payments are only marked complete after a signed callback or backend verification.</li>
              <li>Commission is snapshotted per booking item, so historical payouts do not drift.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container-page py-14">
          <SectionHeading eyebrow="Principles" title="Decisions that shape the platform" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((item) => (
              <div key={item.title} className="card p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-700">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <SectionHeading eyebrow="Who it serves" title="One platform, four working roles" description="Admin is the fifth role and moderates everything below." />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {ROLES.map((role) => (
            <div key={role.title} className="card flex flex-col p-6">
              <h3 className="text-base font-bold text-ink-900">{role.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{role.text}</p>
              <Button as={Link} to={role.to} variant="outline" size="sm" className="mt-4 self-start">{role.cta}</Button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
