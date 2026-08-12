"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { api, ApiError, type Business } from "@/lib/api";
import { resolveBusinessPhotoUrl } from "@/lib/placeholders";
import { computeOpenStatus } from "@/lib/hours";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

// Matches the original spotly-homepage.html prototype's .biz-card
// exactly: top-left badge is open/closed status (not location), top row
// shows rating (not view count, profileViews is an owner-only metric,
// never rendered on a public card), meta row shows neighborhood.
export function BusinessCard({ business }: { business: Business }) {
  const { authed, user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const photoUrl = resolveBusinessPhotoUrl(business.media);
  // No stock-photo fallback anymore — a business with no real photo, or
  // whose real photo fails to load, shows a plain blank card instead of
  // any placeholder imagery. A visibly-broken or mismatched fallback
  // photo reads as more "wrong" to someone browsing than an honest blank
  // space does, and it removes any dependency on an external image host
  // staying reachable.
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);
  const showPhoto = photoUrl && !imgErrored;
  const openStatus = computeOpenStatus(business.hours);
  const isOwnBusiness = authed && user?.id === business.ownerId;

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!authed) {
      openAuthModal(() => handleBookmark(e));
      return;
    }
    if (isOwnBusiness) {
      showToast("You can't save your own business.");
      return;
    }
    setBusy(true);
    try {
      await api.bookmarks.create({ businessId: business.id });
      setSaved(true);
      showToast(`Saved ${business.name} to your places`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't save that, try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link
      href={`/businesses/${business.id}`}
      className="group block w-[268px] shrink-0 overflow-hidden rounded-spotly border border-border bg-surface transition hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(67,53,47,0.14)]"
    >
      <div className="relative h-[170px] overflow-hidden bg-cream">
        {showPhoto && (
          <>
            {/* Loading skeleton, visible until the real photo has
                actually finished loading, then fades out — never a
                blank flash or a pop-in. */}
            {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-border" />}
            <Image
              src={photoUrl}
              alt={business.name}
              fill
              sizes="268px"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgErrored(true)}
              className={`object-cover transition duration-[400ms] group-hover:scale-[1.06] ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        )}
        {openStatus && (
          <span
            className={`absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-xs font-semibold ${
              openStatus.open ? "text-success" : "text-text"
            }`}
          >
            <i className="bi bi-dot" />
            {openStatus.open ? "Open now" : "Closed"}
          </span>
        )}
        {!isOwnBusiness && (
          <button
            disabled={busy}
            onClick={handleBookmark}
            className={`absolute right-2.5 top-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/92 text-base transition hover:scale-110 hover:bg-white ${
              saved ? "text-terracotta" : "text-text"
            }`}
            aria-label="Save"
          >
            <i className={saved ? "bi bi-heart-fill" : "bi bi-heart"} />
          </button>
        )}
      </div>
      <div className="p-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="mb-0.5 font-semibold">{business.name}</p>
            <p className="text-[0.8rem] text-warm-clay">{business.category}</p>
          </div>
          {business.reviewCount ? (
            <span className="flex items-center gap-1 whitespace-nowrap text-[0.82rem] font-semibold">
              <i className="bi bi-star-fill text-gold" />
              {business.averageRating}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-center gap-2.5 text-[0.78rem] text-warm-clay">
          <i className="bi bi-geo-alt" />
          {business.neighborhood || "Nairobi"}
        </div>
      </div>
    </Link>
  );
}
