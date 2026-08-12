"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { Logo } from "./Logo";
import { ApiError, api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function AuthModal() {
  const { authModalOpen, closeAuthModal, signup, login, onAuthSuccess } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"choose" | "email-signup" | "email-login" | "forgot-password">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!authModalOpen) return null;

  const reset = () => {
    setMode("choose");
    setName("");
    setEmail("");
    setPassword("");
    setError(null);
    setResetSent(false);
  };

  const handleClose = () => {
    closeAuthModal();
    reset();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.auth.forgotPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "email-signup") {
        await signup(email, password, name);
        showToast("Welcome to Spotly!");
      } else {
        await login(email, password);
        showToast("Welcome back!");
      }
      onAuthSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[rgba(67,53,47,0.45)] p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-[420px] rounded-[24px] bg-surface p-9 text-center shadow-[0_30px_60px_rgba(0,0,0,0.25)]">
        <button
          className="absolute top-4 right-4 text-lg text-warm-clay"
          onClick={handleClose}
          aria-label="Close"
        >
          <i className="bi bi-x-lg" />
        </button>

        <div className="mb-3 flex justify-center">
          <Logo height={44} />
        </div>

        {mode === "choose" && (
          <>
            <h3 className="mb-1.5 text-[1.35rem]">Join the community</h3>
            <p className="mb-6 text-sm text-warm-clay">
              Save favorites, leave reviews and get personalized picks from your neighborhood.
            </p>
            <a
              href={`${API_URL}/auth/google`}
              className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface py-3 text-sm font-semibold text-text transition hover:bg-cream"
            >
              <i className="bi bi-google" /> Continue with Google
            </a>
            <a
              href={`${API_URL}/auth/apple`}
              className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface py-3 text-sm font-semibold text-text transition hover:bg-cream"
            >
              <i className="bi bi-apple" /> Continue with Apple
            </a>
            <button
              type="button"
              onClick={() => setMode("email-signup")}
              className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-full border border-terracotta bg-terracotta py-3 text-sm font-semibold text-white transition hover:bg-[#b5572f]"
            >
              <i className="bi bi-envelope" /> Continue with Email
            </button>
            <p className="mt-4 text-xs text-warm-clay">
              Already have an account?{" "}
              <button type="button" className="font-semibold text-terracotta" onClick={() => setMode("email-login")}>
                Log in
              </button>
            </p>
          </>
        )}

        {(mode === "email-signup" || mode === "email-login") && (
          <>
            <h3 className="mb-1.5 text-[1.35rem]">{mode === "email-signup" ? "Create your account" : "Welcome back"}</h3>
            <p className="mb-6 text-sm text-warm-clay">
              {mode === "email-signup" ? "Takes about 20 seconds." : "Log in to continue."}
            </p>
            <form onSubmit={handleSubmit} className="text-left">
              {mode === "email-signup" && (
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-semibold text-warm-clay">Name</span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-full border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
                    placeholder="Amina Njoroge"
                  />
                </label>
              )}
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-warm-clay">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
                  placeholder="you@example.com"
                />
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-semibold text-warm-clay">Password</span>
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
              {error && <p className="mb-3 text-sm text-error">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mb-2.5 w-full rounded-full border border-terracotta bg-terracotta py-3 text-sm font-semibold text-white transition hover:bg-[#b5572f] disabled:opacity-60"
              >
                {busy ? "Please wait…" : mode === "email-signup" ? "Create account" : "Log in"}
              </button>
              {mode === "email-signup" && (
                <p className="mb-2.5 text-center text-[0.7rem] text-warm-clay">
                  By creating an account, you agree to Spotly&apos;s{" "}
                  <Link href="/terms" onClick={handleClose} className="text-terracotta hover:underline">Terms</Link> and{" "}
                  <Link href="/privacy" onClick={handleClose} className="text-terracotta hover:underline">Privacy Policy</Link>.
                </p>
              )}
              {mode === "email-login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot-password");
                    setError(null);
                  }}
                  className="mb-2.5 w-full text-xs text-warm-clay hover:text-terracotta"
                >
                  Forgot password?
                </button>
              )}
              <button type="button" onClick={() => setMode("choose")} className="w-full text-xs text-warm-clay">
                <i className="bi bi-arrow-left" /> Back
              </button>
            </form>
          </>
        )}

        {mode === "forgot-password" && (
          <>
            <h3 className="mb-1.5 text-[1.35rem]">Reset your password</h3>
            {resetSent ? (
              <>
                <p className="mb-6 text-sm text-warm-clay">
                  If <span className="font-semibold text-text">{email}</span> has an account, we&apos;ve sent a reset link — check your inbox.
                </p>
                <button type="button" onClick={handleClose} className="w-full rounded-full border border-terracotta bg-terracotta py-3 text-sm font-semibold text-white">
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="mb-6 text-sm text-warm-clay">Enter your email and we&apos;ll send you a reset link.</p>
                <form onSubmit={handleForgotPassword} className="text-left">
                  <label className="mb-4 block">
                    <span className="mb-1 block text-xs font-semibold text-warm-clay">Email</span>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-full border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
                      placeholder="you@example.com"
                    />
                  </label>
                  {error && <p className="mb-3 text-sm text-error">{error}</p>}
                  <button
                    type="submit"
                    disabled={busy}
                    className="mb-2.5 w-full rounded-full border border-terracotta bg-terracotta py-3 text-sm font-semibold text-white transition hover:bg-[#b5572f] disabled:opacity-60"
                  >
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                  <button type="button" onClick={() => setMode("email-login")} className="w-full text-xs text-warm-clay">
                    <i className="bi bi-arrow-left" /> Back
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
