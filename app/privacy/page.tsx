import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Privacy Policy — Spotly" };

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 text-3xl text-warm-brown">Privacy Policy</h1>
        <p className="mb-8 text-sm text-warm-clay">Last updated: August 2026</p>

        <div className="prose-legal space-y-6 text-sm leading-relaxed text-text">
          <p>
            This policy explains what information Spotly collects, how it&apos;s used, and the choices you have.
            It applies to everyone using Spotly — people browsing and saving places, and businesses listing on
            the platform.
          </p>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Information we collect</h2>
            <p className="mb-2 font-semibold">From everyone with an account:</p>
            <ul className="mb-3 list-disc space-y-1 pl-5">
              <li>Name and email address (or your Google/Apple account info, if you sign in that way)</li>
              <li>Businesses you save and reviews you write</li>
              <li>Basic usage data — which pages and businesses you view, so we can show accurate view counts to businesses and improve what we surface to you</li>
            </ul>
            <p className="mb-2 font-semibold">Additionally, from business owners:</p>
            <ul className="mb-3 list-disc space-y-1 pl-5">
              <li>Business name, category, description, contact details, and location</li>
              <li>Photos and videos you upload</li>
              <li>M-Pesa phone number and payment/transaction records for subscription payments</li>
            </ul>
            <p>We don&apos;t collect more than we need to run the service, and we don&apos;t sell your data to anyone.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">How we use it</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>To show you businesses, experiences, and reviews relevant to what you&apos;re looking for</li>
              <li>To let business owners see how many people are viewing and saving their listing</li>
              <li>To process subscription payments via M-Pesa</li>
              <li>To send account-related emails (welcome messages, password resets) and, occasionally, platform updates</li>
              <li>To automatically check uploaded photos for quality (blur, resolution) and flag likely duplicate or stolen images</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Who we share it with</h2>
            <p className="mb-2">We use a small number of third-party services to actually run Spotly:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Safaricom (Daraja/M-Pesa)</strong> — to process subscription payments</li>
              <li><strong>Resend</strong> — to deliver account emails</li>
              <li><strong>Cloudinary or an S3-compatible provider</strong> — to store uploaded photos and videos</li>
              <li><strong>Google / Apple</strong> — only if you choose to sign in with one of those accounts</li>
            </ul>
            <p className="mt-2">
              Each only receives what it needs to do its job (e.g. Safaricom receives payment details, not your
              saved places). We don&apos;t share your information with advertisers or data brokers.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Your rights</h2>
            <p>
              Under Kenya&apos;s Data Protection Act (2019), you have the right to access, correct, or request
              deletion of your personal data. You can delete your saved places and reviews yourself from your
              account; for anything else — including a full account deletion — contact us at the email below.
              Business owners can delete their entire business listing at any time from their dashboard.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Data retention</h2>
            <p>
              We keep your data for as long as your account is active. If you delete your account, we remove your
              personal information within a reasonable period, except where we&apos;re required to keep records
              (e.g. payment records) for legal or accounting purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Changes to this policy</h2>
            <p>
              If this policy changes in a meaningful way, we&apos;ll update the date at the top of this page and,
              for significant changes, let you know directly.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-warm-brown">Contact</h2>
            <p>Questions about this policy or your data: <strong>privacy@spotly.co.ke</strong></p>
          </section>

          <p className="mt-8 rounded-2xl border border-border bg-cream p-4 text-xs text-warm-clay">
            This is a working draft meant to give a clear, honest account of what Spotly actually does with your
            data — it hasn&apos;t been reviewed by a lawyer yet. Have it checked against Kenya&apos;s Data
            Protection Act before relying on it for a real launch.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
