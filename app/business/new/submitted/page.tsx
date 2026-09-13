"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// A dedicated page rather than routing straight to /dashboard with a
// toast, the way Venue/Experience Host do — a Made in Kenya business
// isn't live yet and can't do anything (upload photos, post products)
// until approved, so the dashboard itself would look broken or
// confusing to land on immediately (Val, Sep 2026).
export default function ApplicationSubmittedPage() {
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <i className="bi bi-hourglass-split mb-4 block text-4xl text-terracotta" />
        <h1 className="mb-2 text-2xl text-warm-brown">Application submitted</h1>
        <p className="mb-8 text-sm text-warm-clay">
          Thanks for applying to Spotly&apos;s Made in Kenya collection. We&apos;re reviewing your application and
          will email you once it&apos;s approved — you&apos;ll then be able to add photos and start posting your
          products.
        </p>
        <Link href="/" className="rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white">
          Back to Spotly
        </Link>
      </div>
      <Footer />
    </>
  );
}
