import { Link } from 'react-router-dom';
import PageIntro from '../components/site/PageIntro';

export default function Terms() {
  return (
    <>
      <PageIntro
        eyebrow="Legal"
        title="Terms of service"
        description="These terms describe how bookings, payments, cancellations and provider responsibilities work on POTHIK."
      />
      <div className="container-page max-w-3xl space-y-8 py-12 text-sm leading-7 text-slate-600">
        <section>
          <h2 className="text-lg font-bold text-ink-900">1. The platform</h2>
          <p className="mt-2">
            POTHIK is an online travel agency that packages stays, transport and guiding services supplied by independent, approved providers. POTHIK prices the trip, coordinates confirmations,
            collects payment and manages refunds. The service itself is delivered by the provider named on each booking item.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">2. Accounts</h2>
          <p className="mt-2">
            You must give accurate contact details and keep your credentials private. Provider accounts begin pending and may list, confirm or receive payouts only after approval.
            POTHIK may suspend accounts that misuse the platform, attempt to bypass pricing or interfere with other users.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">3. Prices and quotations</h2>
          <p className="mt-2">
            All prices are in Bangladeshi Taka and are calculated by the POTHIK booking engine from published rates and live inventory. A quotation is valid for the inventory it was built against;
            the server re-verifies availability and pricing when a booking is created and again when payment is verified. Client-supplied totals are never used.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">4. Booking and payment</h2>
          <p className="mt-2">
            A booking request does not charge you. It moves through provider confirmation before payment is due. Payments are captured only after the gateway callback is verified server-side.
            Where partial payment is offered, the unpaid balance remains due before travel unless the booking is cancelled under its policy.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">5. Cancellations and refunds</h2>
          <p className="mt-2">
            Each booking carries its cancellation policy. Cancellations outside the allowed window may forfeit part or all of the amount paid. Approved refunds are processed to the original payment
            method and tracked in the booking payment history.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">6. Provider obligations</h2>
          <p className="mt-2">
            Providers must keep calendars, rates and capacities accurate, honour confirmed bookings, and deliver the service described. Repeated failures can lead to suspension and withheld payouts
            pending review.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">7. Reviews and content</h2>
          <p className="mt-2">
            Reviews are limited to travellers with a completed booking and are moderated. Content that is abusive, misleading or unrelated to the service may be removed.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">8. Liability</h2>
          <p className="mt-2">
            POTHIK coordinates the booking but is not the operator of hotels, vehicles or guiding services. Liability for the delivered service rests with the provider, subject to applicable law.
            POTHIK is not liable for delays caused by weather, permits, road closures or other events outside its control.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink-900">9. Contact</h2>
          <p className="mt-2">
            Questions about these terms can be raised through the support options on the <Link to="/contact" className="link">contact page</Link> or inside a booking thread.
          </p>
        </section>
      </div>
    </>
  );
}
