"use client";

import type { Offer } from "@/lib/api";

const DAY_ABBREV: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

// Turns the raw schedule into the kind of short phrase someone actually
// wants to read at a glance — "Today," "Sep 20 – Sep 27," "Every Tue,
// Thu" — rather than showing raw ISO dates.
function scheduleLabel(offer: Offer): string {
  const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const todayIso = new Date().toISOString().slice(0, 10);

  if (offer.scheduleType === "SINGLE_DAY") {
    return offer.startDate === todayIso ? "Today" : fmt(offer.startDate);
  }
  if (offer.scheduleType === "DATE_RANGE") {
    return `${fmt(offer.startDate)} – ${fmt(offer.endDate!)}`;
  }
  // WEEKLY
  const days = offer.daysOfWeek.map((d) => DAY_ABBREV[d] ?? d).join(", ");
  return `Every ${days}`;
}

// No image at all, deliberately — an offer is a name, a short
// description, and a schedule, not a photo gallery item (Val, Sep
// 2026). Not bookmarkable either, unlike Business/Experience cards —
// nothing here asked for that.
export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <div className="w-[268px] shrink-0 rounded-spotly border border-border bg-surface p-4">
      <span className="mb-2 inline-block rounded-full bg-[rgba(199,101,58,0.1)] px-2.5 py-1 text-xs font-semibold text-terracotta">
        {scheduleLabel(offer)}
      </span>
      <h4 className="mb-1 font-semibold text-warm-brown">{offer.name}</h4>
      {offer.businessName && <p className="mb-1.5 text-xs text-warm-clay">at {offer.businessName}</p>}
      {offer.description && <p className="text-sm text-text line-clamp-2">{offer.description}</p>}
    </div>
  );
}
