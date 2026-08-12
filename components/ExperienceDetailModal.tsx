"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Experience } from "@/lib/api";

export function ExperienceDetailModal({ experience, onClose }: { experience: Experience; onClose: () => void }) {
  const [imgErrored, setImgErrored] = useState(false);
  const startDate = new Date(experience.startsAt);
  const endDate = experience.endsAt ? new Date(experience.endsAt) : null;
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  // Same "blank panel, never a broken-image icon or stock placeholder"
  // treatment as ExperienceCard/BusinessCard — checking images[0] alone
  // only confirms a URL was submitted, not that it actually loads.
  const showImage = experience.images[0] && !imgErrored;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(67,53,47,0.5)] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-spotly bg-surface">
        <div className="relative h-56 w-full bg-cream">
          {showImage && (
            <Image
              src={experience.images[0]}
              alt={experience.title}
              fill
              sizes="512px"
              className="object-cover"
              onError={() => setImgErrored(true)}
            />
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-text hover:bg-white"
            aria-label="Close"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="p-6">
          <h2 className="mb-1 text-2xl text-warm-brown">{experience.title}</h2>
          {experience.businessName && (
            <Link href={`/businesses/${experience.businessId}`} onClick={onClose} className="mb-4 inline-flex items-center gap-1.5 text-sm text-terracotta hover:underline">
              <i className="bi bi-shop" />
              Hosted by {experience.businessName}
            </Link>
          )}

          <div className="mb-5 space-y-2.5 rounded-2xl border border-border bg-cream p-4 text-sm">
            <div className="flex items-start gap-2.5">
              <i className="bi bi-calendar-event mt-0.5 text-terracotta" />
              <div>
                <div className="font-semibold">{startDate.toLocaleDateString("en-US", dateOptions)}</div>
                <div className="text-warm-clay">
                  {startDate.toLocaleTimeString("en-US", timeOptions)}
                  {endDate && ` – ${endDate.toLocaleTimeString("en-US", timeOptions)}`}
                </div>
              </div>
            </div>
            {experience.location && (
              <div className="flex items-start gap-2.5">
                <i className="bi bi-geo-alt mt-0.5 text-terracotta" />
                <div>
                  <div>{experience.location}</div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(experience.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-terracotta hover:underline"
                  >
                    Get directions
                  </a>
                </div>
              </div>
            )}
            {experience.price != null && (
              <div className="flex items-start gap-2.5">
                <i className="bi bi-tag mt-0.5 text-terracotta" />
                <div>KES {experience.price.toLocaleString()}</div>
              </div>
            )}
          </div>

          {experience.description && (
            <p className="mb-5 text-sm leading-relaxed text-text">{experience.description}</p>
          )}

          {experience.ticketingLink && (
            <a
              href={experience.ticketingLink.startsWith("http") ? experience.ticketingLink : `https://${experience.ticketingLink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-full bg-terracotta py-3 text-center text-sm font-semibold text-white hover:bg-[#b5572f]"
              onClick={(e) => {
                // A non-URL-looking value (e.g. "Walk-ins welcome, no
                // ticket needed") is still valid content for this field
                // — don't send someone to a broken https:// link built
                // from plain text.
                if (!/^https?:\/\//.test(experience.ticketingLink!) && !experience.ticketingLink!.includes(".")) {
                  e.preventDefault();
                }
              }}
            >
              {/^https?:\/\//.test(experience.ticketingLink) || experience.ticketingLink.includes(".")
                ? "Get tickets"
                : experience.ticketingLink}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
