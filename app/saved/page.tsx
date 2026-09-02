"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BusinessCard } from "@/components/BusinessCard";
import { ExperienceCard } from "@/components/ExperienceCard";
import { BusinessCardSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/components/AuthContext";
import { useBookmarks } from "@/components/BookmarksContext";
import { api, ApiError, type Business, type Experience } from "@/lib/api";

interface BookmarkRow {
  id: string;
  businessId?: string;
  business?: Business;
  experienceId?: string;
  experience?: Experience;
}

export default function SavedPage() {
  const { authed, openAuthModal } = useAuth();
  const { isSaved } = useBookmarks();
  const [bookmarks, setBookmarks] = useState<BookmarkRow[] | null>(null);
  // Same mounted gate as the dashboard, and for the same reason: the
  // server always renders logged-out (no localStorage access), but
  // `authed` can resolve true on the client's very first render pass
  // (AuthContext's synchronous lazy init) — so without this, the client
  // can skip straight from the sign-in prompt to the skeleton grid, two
  // structurally different subtrees, which is a real hydration
  // mismatch React can't quietly resolve.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!authed) return;
    api.bookmarks
      .list()
      .then((rows) => setBookmarks(rows as BookmarkRow[]))
      .catch((err) => {
        // A 401 here is handled globally (AuthContext clears the
        // session and shows a toast) — just leave the page in its
        // "loading" state rather than crash; the person will see the
        // sign-in prompt once React re-renders with authed=false.
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error("Failed to load saved places:", err);
        }
      });
  }, [authed]);

  // Re-checked against the shared bookmarks context (not just the
  // one-time fetch above) so unsaving a card here — via its own
  // now-working heart button — makes it disappear from this list
  // immediately, rather than sitting there still showing "saved" until
  // a reload (Val, Sep 2026: this whole page's cards never actually
  // supported unsaving before).
  const visibleBookmarks = (bookmarks ?? []).filter(
    (b) =>
      (b.business && isSaved({ businessId: b.business.id })) ||
      (b.experience && isSaved({ experienceId: b.experience.id })),
  );

  return (
    <>
      <Navbar />
      <div className="px-11 pt-8 max-md:px-4">
        <h1 className="mb-1 text-3xl text-warm-brown">Saved</h1>
        <p className="mb-8 text-sm text-warm-clay">Every business and experience you&apos;ve bookmarked, in one place.</p>

        {!mounted || !authed ? (
          <div className="rounded-spotly border border-dashed border-border bg-surface/50 p-10 text-center">
            <p className="mb-4 text-warm-clay">Sign in to see what you&apos;ve saved.</p>
            <button onClick={() => openAuthModal()} className="rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white">
              Sign in
            </button>
          </div>
        ) : bookmarks === null ? (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <BusinessCardSkeleton key={i} />
            ))}
          </div>
        ) : visibleBookmarks.length === 0 ? (
          <div className="rounded-spotly border border-dashed border-border bg-surface/50 p-10 text-center">
            <p className="mb-4 text-warm-clay">Start exploring your city.</p>
            <Link href="/" className="rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white">
              Explore Nairobi
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-[18px]">
            {visibleBookmarks.map((b) =>
                b.business ? (
                  <BusinessCard key={b.id} business={b.business} />
                ) : (
                  <ExperienceCard key={b.id} experience={b.experience as Experience} />
                ),
              )}
          </div>
        )}
      </div>
      <div className="h-10" />
      <Footer />
    </>
  );
}
