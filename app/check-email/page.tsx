"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";

const STORAGE_KEY = "spotly_pending_verification";

// Shown right after signup instead of dropping the user straight into
// the app (Val, Sep 2026: "signup, signup success, notify user of
// verification sent to email... verification sent to your email screen
// should show until the link expires"). Persists across a reload by
// storing email + expiry in sessionStorage the moment it's known — the
// URL query params are the source of truth on first arrival, session
// storage covers a refresh where those might not carry over cleanly.
// Resend only appears once the ORIGINAL link has actually expired, not
// before — a deliberate choice per Val's exact wording, not an
// oversight.
function CheckEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const qEmail = searchParams.get("email");
    const qExpiresAt = searchParams.get("expiresAt");
    if (qEmail && qExpiresAt) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email: qEmail, expiresAt: qExpiresAt }));
      setEmail(qEmail);
      setExpiresAt(qExpiresAt);
    } else {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setEmail(parsed.email);
        setExpiresAt(parsed.expiresAt);
      } else {
        // Nobody arrived here from a real signup and nothing's stored —
        // send them somewhere useful rather than showing a blank page.
        router.replace("/");
      }
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!expiresAt) return;
    const check = () => setExpired(Date.now() > new Date(expiresAt).getTime());
    check();
    // Cheap enough to just re-check every minute — covers someone
    // leaving this tab open across the actual expiry moment, rather
    // than only checking once on load.
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleResend = async () => {
    if (!email) return;
    setResendBusy(true);
    try {
      // The endpoint deliberately never confirms whether an account
      // exists or was actually updated (anti-enumeration, same as
      // forgot-password) — so there's no real expiry to read back from
      // it. Since the only reason anyone would legitimately be on this
      // screen is an account that DOES exist and IS unverified, it's
      // safe to just assume the same 24h window auth.service.ts always
      // grants on a real resend, rather than trying to read a value the
      // response can never safely disclose.
      await api.auth.resendVerification(email);
      setResendSent(true);
      setExpired(false);
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      setExpiresAt(newExpiresAt);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, expiresAt: newExpiresAt }));
    } catch {
      // leave state as-is on failure; the button just stays available to try again
    } finally {
      setResendBusy(false);
    }
  };

  if (!email) return null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-spotly border border-border bg-surface p-7 text-center shadow-[0_18px_40px_rgba(67,53,47,0.1)]">
        <i className="bi bi-envelope-check mb-3 block text-4xl text-terracotta" />
        <h1 className="mb-1.5 text-2xl text-warm-brown">Check your email</h1>
        <p className="mb-6 text-sm text-warm-clay">
          We've sent a verification link to <span className="font-semibold text-text">{email}</span>. Click it to
          finish setting up your account.
        </p>
        {expired ? (
          <>
            <p className="mb-4 text-sm text-error">That link has expired.</p>
            <button
              onClick={handleResend}
              disabled={resendBusy}
              className="w-full rounded-full bg-terracotta py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {resendBusy ? "Sending…" : resendSent ? "Sent, check your inbox" : "Resend verification email"}
            </button>
          </>
        ) : (
          <p className="text-xs text-warm-clay">Didn't get it? Check your spam folder, or come back here later. This page will offer to resend it once the link expires.</p>
        )}
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={null}>
        <CheckEmailContent />
      </Suspense>
    </>
  );
}
