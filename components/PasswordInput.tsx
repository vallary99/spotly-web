"use client";

import { useState } from "react";

// A show/hide toggle was missing from every password field in the app
// (login, signup, reset password) — Val, Sep 2026, flagged as a
// critical fix. One shared component rather than repeating the same
// eye-icon-button logic three times.
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        required
        type={visible ? "text" : "password"}
        minLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-full border border-border bg-cream py-2.5 pl-4 pr-11 text-sm outline-none focus:border-terracotta"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-warm-clay"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <i className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`} />
      </button>
    </div>
  );
}
