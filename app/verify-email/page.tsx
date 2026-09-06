"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/components/AuthContext";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { businessId, hydrateFromAuthResponse } = useAuth();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"checking" | "done" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("This link is missing its verification token. Use the link from your email directly.");
      return;
    }
    api.auth
      .verifyEmail(token)
      .then((res) => {
        // Confirming the link already proves the same thing a password
        // would (control of this email) — signs them in right here
        // rather than making them separately log in again afterward.
        hydrateFromAuthResponse(res);
        setStatus("done");
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "Couldn't verify that link. It may have expired.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Signed in now (see above), so this can send them straight back into
  // whatever they were most likely blocked from — creating a business,
  // if they don't have one yet, since that's the one thing verification
  // is currently required for (Val, Sep 2026) — or their dashboard if
  // they already do.
  const nextHref = businessId ? "/dashboard" : "/business/new";
  const nextLabel = businessId ? "Go to your dashboard" : "Continue listing your business";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-spotly border border-border bg-surface p-7 text-center shadow-[0_18px_40px_rgba(67,53,47,0.1)]">
        {status === "checking" && (
          <>
            <h1 className="mb-1.5 text-2xl text-warm-brown">Verifying…</h1>
            <p className="text-sm text-warm-clay">One moment.</p>
          </>
        )}
        {status === "done" && (
          <>
            <i className="bi bi-check-circle-fill mb-3 block text-4xl text-success" />
            <h1 className="mb-1.5 text-2xl text-warm-brown">Email verified</h1>
            <p className="mb-6 text-sm text-warm-clay">Thanks for confirming — you're all set and signed in.</p>
            <button
              onClick={() => router.push(nextHref)}
              className="w-full rounded-full bg-terracotta py-3 text-sm font-semibold text-white"
            >
              {nextLabel}
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="mb-1.5 text-2xl text-warm-brown">Couldn't verify that link</h1>
            <p className="mb-6 text-sm text-error">{error}</p>
            <Link href="/" className="text-sm font-semibold text-terracotta hover:underline">
              Go back to Spotly
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center text-warm-clay">Loading…</div>}>
        <VerifyEmailContent />
      </Suspense>
    </>
  );
}
