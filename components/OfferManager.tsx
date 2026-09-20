"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Offer } from "@/lib/api";

const DAYS_OF_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

function scheduleSummary(offer: Offer): string {
  const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (offer.scheduleType === "SINGLE_DAY") return fmt(offer.startDate);
  if (offer.scheduleType === "DATE_RANGE") return `${fmt(offer.startDate)} – ${fmt(offer.endDate!)}`;
  const days = offer.daysOfWeek.map((d) => DAY_LABEL[d] ?? d).join(", ");
  return offer.endDate ? `Every ${days}, until ${fmt(offer.endDate)}` : `Every ${days}`;
}

// Self-contained, fetches its own data by businessId — same pattern as
// DashboardGallery/DashboardProducts, rather than threading offers
// through the parent dashboard page's own data loading. Venue and Made
// in Kenya only; the dashboard only renders this for those two types
// (see app/dashboard/page.tsx) — Experience Host never sees this at
// all (Val, Sep 2026: "they can always edit price of upcoming
// experiences").
export function OfferManager({ businessId }: { businessId: string }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);

  const load = () => {
    setLoading(true);
    api.offers.listForBusiness(businessId).then(setOffers).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [businessId]);

  const handleDelete = async (id: string) => {
    try {
      await api.offers.remove(businessId, id);
      load();
    } catch {
      // leave the list as-is on failure, same posture as the rest of this app
    }
  };

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl text-warm-brown">Offers</h2>
        {!showForm && !editing && (
          <button onClick={() => setShowForm(true)} className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white">
            <i className="bi bi-plus-lg mr-1.5" /> Add offer
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <OfferForm
          businessId={businessId}
          initial={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      {loading && <p className="py-6 text-center text-warm-clay">Loading…</p>}
      {!loading && offers.length === 0 && !showForm && (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-warm-clay">
          No offers yet. Add one to give people a reason to visit today.
        </div>
      )}

      <div className="space-y-3">
        {offers.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-warm-brown">{o.name}</p>
                <p className="text-xs text-terracotta">{scheduleSummary(o)}</p>
                {o.description && <p className="mt-1 text-sm text-warm-clay">{o.description}</p>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => setEditing(o)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-cream">Edit</button>
                <button onClick={() => handleDelete(o.id)} className="rounded-full border border-error px-3 py-1 text-xs font-semibold text-error hover:bg-[rgba(214,90,74,0.08)]">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OfferForm({
  businessId,
  initial,
  onCancel,
  onSaved,
}: {
  businessId: string;
  initial: Offer | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scheduleType, setScheduleType] = useState<Offer["scheduleType"]>(initial?.scheduleType ?? "SINGLE_DAY");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(initial?.daysOfWeek ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: string) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const save = async () => {
    if (!name.trim() || !startDate) {
      setError("Name and a start date are required.");
      return;
    }
    if (scheduleType === "DATE_RANGE" && !endDate) {
      setError("An end date is required for a date-range offer.");
      return;
    }
    if (scheduleType === "WEEKLY" && daysOfWeek.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dto = {
        name: name.trim(),
        description: description.trim() || undefined,
        scheduleType,
        startDate,
        endDate: scheduleType === "SINGLE_DAY" ? undefined : endDate || undefined,
        daysOfWeek: scheduleType === "WEEKLY" ? daysOfWeek : undefined,
      };
      if (initial) {
        await api.offers.update(businessId, initial.id, dto);
      } else {
        await api.offers.create(businessId, dto);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that, try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-cream p-4">
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Buy One Get One Free Burger Week" className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Short description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
      </label>

      <span className="mb-1.5 block text-xs font-semibold text-warm-clay">When does it run?</span>
      <div className="mb-3 flex gap-1.5">
        {([
          { value: "SINGLE_DAY", label: "One day" },
          { value: "DATE_RANGE", label: "Date range" },
          { value: "WEEKLY", label: "Weekly" },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setScheduleType(opt.value)}
            className={`flex-1 rounded-full border py-2 text-xs font-semibold transition ${
              scheduleType === opt.value ? "border-terracotta bg-terracotta text-white" : "border-border bg-surface text-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {scheduleType === "SINGLE_DAY" && (
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Date</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
        </label>
      )}

      {scheduleType === "DATE_RANGE" && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-warm-clay">From</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-warm-clay">To</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
          </label>
        </div>
      )}

      {scheduleType === "WEEKLY" && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  daysOfWeek.includes(day) ? "border-terracotta bg-terracotta text-white" : "border-border bg-surface text-text"
                }`}
              >
                {DAY_LABEL[day]}
              </button>
            ))}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Starts</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Ends (optional)</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
            </label>
          </div>
        </>
      )}

      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-full border border-border bg-surface py-2 text-sm font-semibold">Cancel</button>
        <button onClick={save} disabled={busy} className="flex-1 rounded-full bg-terracotta py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
