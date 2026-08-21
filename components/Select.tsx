"use client";

import { useEffect, useRef, useState } from "react";

interface SelectOption {
  value: string;
  label: string;
}

// Native <select> elements can't have their open-dropdown option list
// restyled via CSS in most browsers — the hover/selected highlight color
// (usually a system blue) and the arrow icon are both OS/browser-rendered
// and outside CSS's reach. This is a fully custom replacement so both are
// on-brand: cream hover instead of blue, a small quiet chevron instead of
// the native arrow, terracotta for the selected option.
export function Select({
  value,
  onChange,
  options,
  className = "",
  variant = "default",
  searchable = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  // "onDark": for use directly on a photo/gradient background (the
  // homepage hero's location row) — translucent white instead of the
  // default cream, since the default variant's cream-on-cream would be
  // nearly invisible against a busy photo.
  variant?: "default" | "onDark";
  // Adds a filter-as-you-type text input at the top of the open dropdown.
  // Off by default (short lists like city/neighborhood don't need it);
  // turn on for long lists like the business category picker.
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.value === value);
  const visibleOptions = searchable && query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
    if (!open) setQuery("");
  }, [open, searchable]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-full border px-[18px] py-2.5 text-left text-sm outline-none backdrop-blur-sm transition ${
          variant === "onDark"
            ? "border-white/40 bg-white/15 text-white focus:border-white/70"
            : "border-border bg-cream text-text focus:border-terracotta"
        }`}
      >
        <span className="truncate">{current?.label ?? ""}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-64 w-full min-w-max overflow-y-auto rounded-2xl border border-border bg-surface py-1.5 shadow-[0_18px_40px_rgba(67,53,47,0.14)]">
          {searchable && (
            <div className="sticky top-0 z-10 border-b border-border bg-surface px-2.5 pb-1.5">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-full border border-border bg-cream px-3.5 py-1.5 text-sm outline-none focus:border-terracotta"
              />
            </div>
          )}
          {visibleOptions.length === 0 ? (
            <p className="px-4 py-2 text-sm text-warm-clay">No matches</p>
          ) : (
            visibleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-cream ${
                  opt.value === value ? "font-semibold text-terracotta" : "text-text"
                }`}
              >
                {opt.value === value && <i className="bi bi-check text-terracotta" />}
                <span className={opt.value === value ? "" : "pl-[18px]"}>{opt.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
