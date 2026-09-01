"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { BottomSheet } from "./BottomSheet";
import { api, ApiError } from "@/lib/api";

// Mobile's primary navigation, replacing the top navbar's icon row and
// the (previously non-functional) hamburger button. Desktop's top
// navbar is untouched — this component renders nothing above the `md`
// breakpoint. Fixed to the bottom edge, standard mobile pattern: the
// nav stays put while content scrolls, rather than scrolling away with
// the page the way a top bar does.
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { authed, user, businessId, openAuthModal, logout } = useAuth();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    businesses: { id: string; name: string; categories: string[] }[];
    experiences: { id: string; title: string }[];
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
    else {
      setQuery("");
      setResults(null);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.search(query).then(setResults).catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  const handleListBusiness = () => {
    if (!authed) {
      openAuthModal(() => router.push("/business/new"));
      return;
    }
    router.push(businessId ? "/dashboard" : "/business/new");
  };

  const navItemClass = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.65rem] font-medium transition ${
      active ? "text-terracotta" : "text-warm-clay"
    }`;

  const handleResetPassword = async () => {
    if (!user?.email || resetBusy) return;
    setResetBusy(true);
    try {
      await api.auth.forgotPassword(user.email);
      showToast(`Password reset link sent to ${user.email}.`);
      setProfileOpen(false);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't send that reset link, try again.");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-[250] flex items-stretch border-t border-border bg-[rgba(248,245,240,0.96)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Primary"
      >
        <Link href="/" className={navItemClass(isActive("/") && pathname === "/")}>
          <i className={`bi ${pathname === "/" ? "bi-house-fill" : "bi-house"} text-lg`} />
          Home
        </Link>

        <button onClick={() => setSearchOpen(true)} className={navItemClass(false)}>
          <i className="bi bi-search text-lg" />
          Search
        </button>

        <button
          onClick={() => (authed ? router.push("/saved") : openAuthModal())}
          className={navItemClass(isActive("/saved"))}
        >
          <i className={`bi ${isActive("/saved") ? "bi-heart-fill" : "bi-heart"} text-lg`} />
          Saved
        </button>

        <button
          onClick={handleListBusiness}
          className={navItemClass(isActive("/dashboard") || isActive("/business/new"))}
        >
          {/* Gated on `mounted` rather than checking businessId directly:
              the server can never know businessId (it lives in
              localStorage), so if this rendered from businessId on the
              very first pass, the server's guess (always "logged out")
              and the client's real answer would disagree, and that's an
              attribute mismatch (className on the icon), which
              suppressHydrationWarning does NOT reliably cover, it's
              documented for text-content mismatches, not attributes.
              Rendering the same "logged out" version on both the server
              AND the client's first pass (mounted === false there too),
              then correcting only after mount, means there's nothing to
              mismatch during hydration at all. */}
          <i className={`bi ${mounted && businessId ? "bi-speedometer2" : "bi-plus-circle"} text-lg`} />
          {mounted && businessId ? "Dashboard" : "List"}
        </button>

        <button
          onClick={() => (authed ? setProfileOpen(true) : openAuthModal())}
          className={navItemClass(false)}
        >
          <i className="bi bi-person-circle text-lg" />
          Profile
        </button>
      </nav>

      <BottomSheet open={searchOpen} onClose={() => setSearchOpen(false)} title="Search">
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, coffee, experiences…"
          className="mb-3 w-full rounded-full border border-border bg-cream px-4 py-3 text-base outline-none focus:border-terracotta"
        />
        {results && (results.businesses.length > 0 || results.experiences.length > 0) ? (
          <div className="space-y-1">
            {results.businesses.map((b) => (
              <Link
                key={b.id}
                href={`/businesses/${b.id}`}
                onClick={() => setSearchOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm hover:bg-cream"
              >
                <i className="bi bi-shop text-warm-clay" />
                <span className="flex-1">{b.name}</span>
                <span className="text-xs text-warm-clay">{b.categories?.[0]}</span>
              </Link>
            ))}
            {results.experiences.map((e) => (
              <Link
                key={e.id}
                href="/"
                onClick={() => setSearchOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm hover:bg-cream"
              >
                <i className="bi bi-calendar-event text-warm-clay" />
                <span>{e.title}</span>
              </Link>
            ))}
          </div>
        ) : query.trim().length >= 2 ? (
          <p className="px-3 py-2 text-sm text-warm-clay">No matches yet.</p>
        ) : (
          <p className="px-3 py-2 text-sm text-warm-clay">Search restaurants, coffee, experiences, hidden gems…</p>
        )}
      </BottomSheet>

      {/* Logout, plus reset password and the legal pages — Saved and
          Dashboard already have their own direct icons right in this
          same bottom nav, repeating them here added nothing, but there
          was previously no mobile-reachable spot for these at all. */}
      <BottomSheet open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
        <button
          onClick={handleResetPassword}
          disabled={resetBusy}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium text-text hover:bg-cream disabled:opacity-60"
        >
          <i className="bi bi-key" /> {resetBusy ? "Sending…" : "Reset password"}
        </button>
        <Link
          href="/terms"
          onClick={() => setProfileOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium text-text hover:bg-cream"
        >
          <i className="bi bi-file-earmark-text" /> Terms of Service
        </Link>
        <Link
          href="/privacy"
          onClick={() => setProfileOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium text-text hover:bg-cream"
        >
          <i className="bi bi-shield-check" /> Privacy Policy
        </Link>
        <button
          onClick={() => {
            logout();
            setProfileOpen(false);
            router.push("/");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium text-error hover:bg-cream"
        >
          <i className="bi bi-box-arrow-right" /> Log out
        </button>
      </BottomSheet>
    </>
  );
}
