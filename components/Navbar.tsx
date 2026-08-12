"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useAuth } from "./AuthContext";

export function Navbar() {
  const { authed, businessId, openAuthModal, logout } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleListBusiness = () => {
    if (!authed) {
      openAuthModal(() => router.push("/business/new"));
      return;
    }
    router.push(businessId ? "/dashboard" : "/business/new");
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-[rgba(248,245,240,0.9)] px-7 py-2 backdrop-blur-md">
      <Logo height={38} />

      {/* Search intentionally not here — it lives in the homepage hero
          on desktop instead, so there's exactly one desktop search entry
          point, not two. Mobile's equivalent is the bottom nav's search
          sheet. */}
      <div className="hidden items-center gap-2 md:flex">
        {/* Saved */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-border"
          title="Saved"
          onClick={() => (authed ? router.push("/saved") : openAuthModal())}
        >
          <i className="bi bi-heart" />
        </button>

        {/* Profile — just logout. Saved and the Business Owner Surface
            already have their own direct icons/button right here, a
            dropdown repeating them added nothing. */}
        <div className="relative" ref={profileRef}>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-border"
            title="Profile"
            onClick={() => (authed ? setProfileOpen((v) => !v) : openAuthModal())}
          >
            <i className="bi bi-person-circle" />
          </button>
          {profileOpen && authed && (
            <div className="absolute right-0 top-12 w-44 rounded-2xl border border-border bg-surface p-2 shadow-[0_18px_40px_rgba(67,53,47,0.14)]">
              <button
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-cream"
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                  router.push("/");
                }}
              >
                <i className="bi bi-box-arrow-right mr-2" /> Log out
              </button>
            </div>
          )}
        </div>

        <button
          className="ml-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(199,101,58,0.35)]"
          onClick={handleListBusiness}
          // Server can't see localStorage, so it always renders the
          // logged-out label; the client corrects this on the very first
          // render via AuthContext's synchronous lazy state init (see
          // that file's comment for why it has to be synchronous, not a
          // useEffect). That's a deliberate, correct mismatch, not a
          // bug, so it's suppressed here rather than warned about.
          suppressHydrationWarning
        >
          {businessId ? "Dashboard" : "List Your Business"}
        </button>
      </div>
    </nav>
  );
}
