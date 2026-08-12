"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BusinessCard } from "@/components/BusinessCard";
import { ExperienceCard } from "@/components/ExperienceCard";
import { useAuth } from "@/components/AuthContext";
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
  const [bookmarks, setBookmarks] = useState<BookmarkRow[] | null>(null);

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

  return (
    <>
      <Navbar />
      <div className="px-11 pt-8 max-md:px-4">
        <h1 className="mb-1 text-3xl text-warm-brown">Saved</h1>
        <p className="mb-8 text-sm text-warm-clay">Every business and experience you&apos;ve bookmarked, in one place.</p>

        {!authed ? (
          <div className="rounded-spotly border border-dashed border-border bg-surface/50 p-10 text-center">
            <p className="mb-4 text-warm-clay">Sign in to see what you&apos;ve saved.</p>
            <button onClick={() => openAuthModal()} className="rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white">
              Sign in
            </button>
          </div>
        ) : bookmarks === null ? (
          <p className="text-warm-clay">Loading your saved places…</p>
        ) : bookmarks.length === 0 ? (
          <div className="rounded-spotly border border-dashed border-border bg-surface/50 p-10 text-center">
            <p className="mb-4 text-warm-clay">Start exploring your city.</p>
            <Link href="/" className="rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white">
              Explore Nairobi
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-[18px]">
            {bookmarks
              .filter((b) => b.business || b.experience)
              .map((b) =>
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
