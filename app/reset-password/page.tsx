"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token — use the link from your email directly.");
      return;
    }
    setBusy(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset your password. The link may have expired.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-spotly border border-border bg-surface p-7 shadow-[0_18px_40px_rgba(67,53,47,0.1)]">
        <h1 className="mb-1.5 text-2xl text-warm-brown">Set a new password</h1>
        {done ? (
          <>
            <p className="mb-6 text-sm text-warm-clay">Your password has been updated.</p>
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-full bg-terracotta py-3 text-sm font-semibold text-white"
            >
              Back to Spotly
            </button>
          </>
        ) : !token ? (
          <p className="text-sm text-error">
            This link is missing its reset token. Use the link from your email directly, or{" "}
            <Link href="/" className="font-semibold text-terracotta">go back</Link> and request a new one.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-6 text-sm text-warm-clay">Choose a new password for your account.</p>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-warm-clay">New password</span>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
                placeholder="At least 8 characters"
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Confirm password</span>
              <input
                required
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-full border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
              />
            </label>
            {error && <p className="mb-4 text-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-terracotta py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center text-warm-clay">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
