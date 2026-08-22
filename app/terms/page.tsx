import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Terms of Service, Spotly" };

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 text-3xl text-warm-brown">Terms of Service</h1>
        <p className="mb-8 text-sm text-warm-clay">Last updated: August 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-text">
          <p>By using Spotly, you agree to these terms. Please read them.</p>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">The service</h2>
            <p>
              Spotly is a discovery platform for finding local businesses and experiences, currently focused on
              Nairobi. Guests can browse freely; creating an account lets you save places and write reviews;
              registering a business lets you list it, upload photos, and host experiences.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Your account</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>You&apos;re responsible for keeping your login details secure and for activity under your account</li>
              <li>You must provide accurate information when signing up and registering a business</li>
              <li>One business listing per real business, don&apos;t create duplicate or fake listings</li>
              <li>You must be old enough to legally enter into these terms in your jurisdiction</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Reviews and content</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Reviews must reflect a genuine visit or experience, no fake reviews, for your own business or anyone else&apos;s</li>
              <li>Business owners can&apos;t review their own business</li>
              <li>Uploaded photos must be real, and yours to use, reusing someone else&apos;s photos across a different business listing may get the listing flagged and reviewed</li>
              <li>We may remove content that&apos;s fake, abusive, illegal, or violates these terms, and may suspend accounts or listings that repeatedly do</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Business listings and subscriptions</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>The Free package has limits on photos, videos, and hosted experiences; Featured and Premium are paid upgrades with higher limits</li>
              <li>Subscription payments are processed via M-Pesa (Safaricom&apos;s Daraja API)</li>
              <li>If a payment fails or lapses, your listing doesn&apos;t get removed, it reverts to the free Starter tier after a grace period</li>
              <li>Photos and videos go through an automated quality check before publishing, and may be spot-checked afterward</li>
              <li>We may offer promotional discounts or free trials at our discretion; these don&apos;t create an ongoing entitlement beyond what&apos;s stated when offered</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Experiences</h2>
            <p>
              Hosting an experience (an event, class, or time-bound activity) requires a Business Account.
              You&apos;re responsible for the accuracy of what you list, date, time, price, and description,
              and for actually delivering what you advertise. Spotly isn&apos;t a party to the transaction between
              a host and an attendee beyond facilitating discovery.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">What we don&apos;t guarantee</h2>
            <p>
              Spotly is provided &quot;as is.&quot; We don&apos;t guarantee a business&apos;s information is
              accurate, that a listed experience will happen as described, or that the service will be
              uninterrupted or error-free. Reviews reflect individual opinions, not Spotly&apos;s endorsement.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Limitation of liability</h2>
            <p>
              To the extent permitted by law, Spotly isn&apos;t liable for indirect, incidental, or consequential
              damages arising from your use of the service, including disputes between users and businesses, or
              losses relating to a hosted experience.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Ending your account</h2>
            <p>
              You can delete your account or business listing at any time. We may suspend or terminate an account
              that violates these terms, with notice where practical.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Governing law</h2>
            <p>These terms are governed by the laws of Kenya.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Contact</h2>
            <p>Questions about these terms: <strong>hello@spotly.co.ke</strong></p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
