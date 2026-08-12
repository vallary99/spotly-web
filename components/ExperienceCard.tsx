"use client";

import Image from "next/image";
import { useState } from "react";
import type { Experience } from "@/lib/api";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { ExperienceDetailModal } from "./ExperienceDetailModal";

// Same footprint as BusinessCard (w-[268px], h-[170px] image), and the
// same top-left/top-right badge placement (date instead of open/closed,
// heart-save in the same spot) — these sit in the same rails, so a
// visibly different treatment reads as a layout bug rather than a
// deliberate choice.
//
// A past (isExpired) experience renders as plain, non-interactive
// content — no save button (saving something already over doesn't mean
// anything), and clicking it does nothing, rather than opening the same
// detail popup a live event gets. This is what "Past Events" sections
// use directly; the same component, just automatically inert once its
// own date has passed.
export function ExperienceCard({ experience }: { experience: Experience }) {
  const { authed, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);
  const date = new Date(experience.startsAt);
  const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  // No stock-photo fallback — same "blank panel, never a placeholder"
  // treatment as BusinessCard. Cover image is a mandatory field at
  // creation now, so this really only matters for older data or a
  // failed image load, not the normal case.
  const img = experience.images[0];
  const showImage = img && !imgErrored;
  const isPast = experience.isExpired;

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!authed) {
      openAuthModal(() => handleBookmark(e));
      return;
    }
    setBusy(true);
    try {
      await api.bookmarks.create({ experienceId: experience.id });
      setSaved(true);
      showToast(`Saved ${experience.title} to your places`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't save that, try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        role={isPast ? undefined : "button"}
        tabIndex={isPast ? undefined : 0}
        onClick={isPast ? undefined : () => setDetailOpen(true)}
        onKeyDown={
          isPast
            ? undefined
            : (e) => {
                // A <div> doesn't get native keyboard activation the way
                // a real <button> would — this is what makes Enter/Space
                // open the modal, same as clicking it. The card can't
                // just BE a <button> element here: it contains its own
                // save <button>, and a button nested inside another
                // button is invalid HTML (browsers can't render it
                // correctly, which is exactly what surfaced this as a
                // real hydration error, not a hypothetical one).
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetailOpen(true);
                }
              }
        }
        className={`group block w-[268px] shrink-0 cursor-pointer overflow-hidden rounded-spotly border border-border bg-surface text-left transition ${
          isPast ? "cursor-default opacity-70" : "hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(67,53,47,0.14)]"
        }`}
      >
        <div className="relative h-[170px] overflow-hidden bg-cream">
          {showImage && (
            <Image
              src={img}
              alt={experience.title}
              fill
              sizes="268px"
              onError={() => setImgErrored(true)}
              className={`object-cover transition duration-[400ms] ${isPast ? "grayscale" : "group-hover:scale-[1.06]"}`}
            />
          )}
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-xs font-semibold text-terracotta">
            <i className="bi bi-calendar-event" />
            {dateLabel}
          </span>
          {!isPast && (
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
          <h4 className="font-semibold">{experience.title}</h4>
          {experience.businessName && <p className="mt-0.5 text-[0.8rem] text-warm-clay">By {experience.businessName}</p>}
          {experience.price != null && (
            <p className="mt-1.5 text-[0.78rem] text-warm-clay">KES {experience.price.toLocaleString()}</p>
          )}
        </div>
      </div>
      {detailOpen && !isPast && <ExperienceDetailModal experience={experience} onClose={() => setDetailOpen(false)} />}
    </>
  );
}
