"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { api, ApiError } from "@/lib/api";

const DISMISS_KEY = "spotly_verify_banner_dismissed";

// Non-blocking by design (Val, Sep 2026's ask was "verify emails are
// legit," not "lock out anyone who hasn't yet") — browsing, saving,
// reviewing, even listing a business all still work without this. It's
// a nudge, not a gate: someone can dismiss it for the rest of this
// browser session (sessionStorage, not localStorage) and it comes back
// next time they open a new tab/session as long as they're still
// unverified, rather than nagging on every single page view forever or
// disappearing for good after one click.
export function VerificationBanner() {
  const { user } = useAuth();
  const { showToast } = useToast();
  // Server always renders null (no window to check anything against).
  // Gating on `mounted` — not just checking `user`/`dismissed` directly
  // — means the CLIENT's first render ALSO renders null, matching the
  // server exactly; the real check only runs after this effect fires,
  // safely inside a client-only render pass. Without this, an already-
  // logged-in visitor's very first client render reads the real
  // localStorage/sessionStorage values immediately (unlike the server,
  // which has neither), and React flags that as a hydration mismatch —
  // same reasoning as the existing `mounted` guard in
  // MobileBottomNav.tsx, which hits the same root cause.
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (!mounted || !user || user.emailVerified || dismissed) return null;

  const handleResend = async () => {
    setBusy(true);
    try {
      await api.auth.resendVerification(user.email);
      showToast("Verification email sent — check your inbox.");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't send that, try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[rgba(199,101,58,0.1)] px-4 py-2 text-center text-sm text-terracotta">
      <span>
        <i className="bi bi-envelope-exclamation mr-1.5" />
        Please verify your email address ({user.email}).
      </span>
      <button onClick={handleResend} disabled={busy} className="font-semibold underline underline-offset-2 disabled:opacity-60">
        {busy ? "Sending…" : "Resend link"}
      </button>
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "true");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="text-terracotta/70 hover:text-terracotta"
      >
        <i className="bi bi-x-lg" />
      </button>
    </div>
  );
}
