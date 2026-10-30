import { Link } from 'react-router-dom';
import PageIntro from '../components/site/PageIntro';

export default function Privacy() {
  return (
    <>
      <PageIntro
        eyebrow="Legal"
        title="Privacy policy"
        description="What POTHIK stores, why it is needed to run a booking, and how access is limited."
      />
      <div className="container-page max-w-3xl space-y-8 py-12 text-sm leading-7 text-slate-600">
        <section>
          <h2 className="text-lg font-bold text-ink-900">1. What we collect</h2>
          <p className="mt-2">
            Account details (name, email, mobile number, locale), booking contact details, traveller names and optional identity details supplied for a booking, booking and payment records, messages sent
            inside a booking, reviews you publish and the provider listings you manage.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">2. Why we need it</h2>
          <p className="mt-2">
            To price and confirm a trip, communicate with the providers on it, process payments and refunds, calculate commission and payouts, verify reviews, prevent fraud and meet accounting obligations.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">3. Who can see it</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Travellers can see their own bookings, payments and threads.</li>
            <li>Providers see only bookings that include their services, limited to what is needed to deliver them.</li>
            <li>Administrators see platform data for moderation, support and finance.</li>
            <li>Passwords are stored only as hashes. Payment secrets are never exposed to the browser.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">4. Payments</h2>
          <p className="mt-2">
            Card and mobile-wallet details are handled by the payment gateway. POTHIK stores the gateway reference, amount, method and verification status — not raw card data.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">5. Retention</h2>
          <p className="mt-2">
            Booking, payment and commission records are retained for accounting and dispute resolution. Account data is kept while the account is active. Aggregated, non-identifying data may be used to
            improve the platform.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">6. Your choices</h2>
          <p className="mt-2">
            You can update your profile from the account dashboard. For access, correction or deletion requests, use the <Link to="/contact" className="link">contact options</Link> and include your account email.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">7. Cookies and sessions</h2>
          <p className="mt-2">
            A secure, httpOnly refresh cookie keeps you signed in. Language preference is stored in your browser. We do not sell personal data.
          </p>
        </section>
      </div>
    </>
  );
}
