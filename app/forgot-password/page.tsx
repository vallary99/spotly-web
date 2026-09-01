"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useToast } from "@/components/ToastContext";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setBusy(true);
    try {
      await api.auth.forgotPassword(email);
      setSubmitted(true);
      showToast("Check your email for password reset instructions.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Couldn't process your request. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="px-11 py-16 max-md:px-4">
        <div className="mx-auto max-w-md">
          <h1 className="mb-2 text-3xl text-warm-brown">Forgot Password?</h1>
          <p className="mb-8 text-sm text-warm-clay">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {submitted ? (
            <div className="rounded-spotly border border-gold bg-[rgba(232,167,74,0.12)] p-5">
              <p className="text-sm font-semibold text-warm-brown">Check your email</p>
              <p className="mt-2 text-sm text-warm-clay">
                We've sent password reset instructions to <strong>{email}</strong>. The link expires in 1 hour.
              </p>
              <p className="mt-4 text-xs text-warm-clay">
                Didn't receive an email? Check your spam folder or{" "}
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                  className="font-semibold text-terracotta hover:underline"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-warm-brown">Email Address</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
                />
              </label>

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-terracotta py-3.5 text-sm font-semibold text-white transition hover:bg-[#b5572f] disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-warm-clay">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-terracotta hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
