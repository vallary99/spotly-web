"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/ToastContext";
import { api, ApiError, type Business, type Experience, type Media } from "@/lib/api";
import { geocodeAddress } from "@/lib/location";
import { Select } from "@/components/Select";
import { Lightbox } from "@/components/Lightbox";
import { DashboardGallery } from "@/components/DashboardGallery";
import { normalizeKenyanMsisdn } from "@/lib/phone";
import { DashboardSkeleton } from "@/components/Skeleton";

const LocationPickerModal = dynamic(() => import("@/components/LocationPickerModal").then((m) => m.LocationPickerModal), {
  ssr: false,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Package display names — kept separate from the underlying tier enum
// values (STARTER/GROWTH/PREMIUM), which stay as-is in the API/DB.
// Renaming the enum itself would mean a migration touching every
// existing business's `tier` column plus every Payment/trial row that
// references it, for a purely cosmetic rename; this mapping is the
// cheaper, safer way to show "Free"/"Featured"/"Premium" everywhere.
function tierLabel(tier: string): string {
  switch (tier) {
    case "STARTER":
      return "Free";
    case "GROWTH":
      return "Featured";
    case "PREMIUM":
      return "Premium";
    default:
      return tier;
  }
}

// Same list as the registration form (app/business/new/page.tsx) — kept
// in sync manually since there's no shared constants file yet.
const AMENITY_OPTIONS = [
  "WiFi",
  "Parking",
  "Outdoor Seating",
  "Pet Friendly",
  "Wheelchair Accessible",
  "Card Payments",
  "Family Friendly",
  "Takeaway",
  "Reservations",
];

type TierLimits = {
  priceKes: number;
  photos: number;
  videos: number;
  videoMaxSeconds: number;
  concurrentExperiences: number | null;
  monthlyExperiencesIncluded: number | null;
  extraFeatures: string[];
};

export default function DashboardPage() {
  const router = useRouter();
  const { authed, businessId, openAuthModal } = useAuth();
  const { showToast } = useToast();

  // Server never has access to localStorage, so it can only ever render
  // the logged-out branch. authed/businessId from AuthContext resolve
  // synchronously true on the client's very first render pass too (see
  // AuthContext's lazy useState init) — meaning without this gate, the
  // client's first pass skips straight past the "sign in" branch to the
  // loading skeleton, a structurally different subtree from what the
  // server sent. That's a real hydration mismatch (different elements,
  // not just different text), which suppressHydrationWarning can't
  // paper over — it only covers matching elements with different text
  // content. Same `mounted` gate already used in Navbar/MobileBottomNav
  // for this exact reason: render the server's version on the client's
  // first pass too (mounted === false on both), then let the real value
  // take over only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [business, setBusiness] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "gallery">("profile");
  const [tiers, setTiers] = useState<Record<string, TierLimits> | null>(null);
  const [subStatus, setSubStatus] = useState<{
    shouldPromptUpgrade: boolean;
    upgradeMessage: string | null;
    discountPercent: number;
    gracePeriodEndsAt: string | null;
    firstCohortPremiumTrial: boolean;
    trialOffer: { tier: string; days: number } | null;
    activeTrial: { tier: string; endsAt: string } | null;
  } | null>(null);
  const [hostingHistory, setHostingHistory] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [b, t, s, h] = await Promise.all([
        api.businesses.get(businessId),
        api.subscriptions.tiers() as Promise<Record<string, TierLimits>>,
        api.subscriptions.status(businessId),
        api.businesses.hostingHistory(businessId),
      ]);
      setBusiness(b);
      setTiers(t);
      setSubStatus(s);
      setHostingHistory(h);
    } catch (err) {
      // A 401 here means AuthContext's global "spotly:unauthorized"
      // listener has already cleared the session and shown a toast, so
      // just get off this page rather than sitting on a half-loaded
      // dashboard with no data. Any other error gets its own message,
      // since silently redirecting on e.g. a network blip would be
      // confusing.
      if (err instanceof ApiError && err.status === 401) {
        router.push("/");
      } else {
        showToast(err instanceof ApiError ? err.message : "Couldn't load your dashboard, try refreshing.");
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, router, showToast]);

  useEffect(() => {
    if (!authed) {
      openAuthModal();
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, businessId]);

  if (!mounted || !authed) {
    return (
      <>
        <Navbar />
        <div className="px-11 py-24 text-center text-warm-clay" suppressHydrationWarning>
          Sign in to access your Business Owner Surface.
        </div>
        <Footer />
      </>
    );
  }

  if (!businessId) {
    return (
      <>
        <Navbar />
        <div className="px-11 py-24 text-center text-warm-clay" suppressHydrationWarning>
          You don&apos;t have a registered business yet.
        </div>
        <Footer />
      </>
    );
  }

  if (loading || !business) {
    return (
      <>
        <Navbar />
        <DashboardSkeleton />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="px-11 pt-8 pb-16 max-md:px-4">
        <EditableHeading business={business} onSaved={load} />
        <p className="mb-8 text-sm text-warm-clay">Your Business Owner Surface, everything you need on one screen.</p>

        {!hasApprovedPhoto(business) && (
          <div className="mb-8 flex items-start gap-3 rounded-spotly border border-terracotta bg-[rgba(199,101,58,0.08)] p-5">
            <i className="bi bi-eye-slash mt-0.5 text-lg text-terracotta" />
            <div>
              <p className="text-sm font-semibold text-warm-brown">Not visible to the public yet</p>
              <p className="mt-1 text-sm text-warm-clay">
                {business.name} won&apos;t appear in search, browse, or the homepage until it has at least
                one approved photo, a placeholder image would misrepresent what you offer. Upload one
                below and you&apos;ll go live as soon as it passes the quality check.
              </p>
            </div>
          </div>
        )}

        {/* Usage counters */}
        <div className="mb-8 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <StatCard label="Profile views (30d)" value={business.profileViews ?? 0} icon="bi-eye" />
          <StatCard label="Saves this month" value={business.savesCount ?? 0} icon="bi-heart" />
          <StatCard label="Current tier" value={tierLabel(business.tier)} icon="bi-award" />
        </div>

        {subStatus?.shouldPromptUpgrade && subStatus.upgradeMessage && (
          <div className="mb-8 rounded-spotly border border-gold bg-[rgba(232,167,74,0.12)] p-5">
            <p className="text-sm font-semibold text-warm-brown">{subStatus.upgradeMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-[1fr_360px] gap-8 max-md:grid-cols-1">
          <div className="space-y-8">
            {/* Gallery split into its own tab (Val, Sep 2026: "so they
                don't have to scroll to the bottom to see their media or
                upload") — same Gallery/About-style tab pattern the
                PUBLIC profile page already uses, so it's a familiar
                shape for a returning owner. */}
            <div className="flex gap-1.5 rounded-full border border-border bg-cream p-1.5">
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${activeTab === "profile" ? "bg-terracotta text-white" : "text-warm-clay"}`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab("gallery")}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${activeTab === "gallery" ? "bg-terracotta text-white" : "text-warm-clay"}`}
              >
                Gallery
              </button>
            </div>

            {activeTab === "gallery" ? (
              <DashboardGallery
                businessId={businessId}
                media={business.media || []}
                coverMediaId={business.coverMediaId ?? null}
                tier={business.tier}
                tiers={tiers}
                onChanged={load}
              />
            ) : (
              <>
                <ProfileEditor business={business} onSaved={load} />
                <ExperienceManager
                  businessId={businessId}
                  experiences={hostingHistory}
                  tier={business.tier}
                  tiers={tiers}
                  businessBudgetMin={business.budgetMin ?? null}
                  businessBudgetMax={business.budgetMax ?? null}
                  onChanged={load}
                />
              </>
            )}
          </div>
          <div className="space-y-8">
            <SubscriptionPanel business={business} tiers={tiers} subStatus={subStatus} onUpgraded={load} showToast={showToast} />
            <SupportContact />
            <DangerZone business={business} />
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

function hasApprovedPhoto(business: Business): boolean {
  return (business.media || []).some((m) => m.type === "PHOTO" && m.status === "APPROVED");
}

// Directly editable business name at the top of the page, saving on
// blur/Enter, this is the obvious, immediately-visible way to rename a
// business, rather than requiring a scroll down into the profile form
// below (where the same field also still exists, kept in sync via
// onSaved's refetch).
function EditableHeading({ business, onSaved }: { business: Business; onSaved: () => void }) {
  const { showToast } = useToast();
  const [value, setValue] = useState(business.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(business.name), [business.name]);

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === business.name) {
      setValue(business.name);
      return;
    }
    setSaving(true);
    try {
      await api.businesses.update(business.id, { name: trimmed });
      showToast("Business name updated.");
      onSaved();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't update the name.");
      setValue(business.name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(business.name);
      }}
      disabled={saving}
      aria-label="Business name"
      className="mb-1 w-full max-w-xl rounded-lg border border-transparent bg-transparent px-1 text-3xl text-warm-brown outline-none transition hover:border-border focus:border-terracotta focus:bg-surface disabled:opacity-60"
    />
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-spotly border border-border bg-surface p-5">
      <div className="mb-1 flex items-center gap-2 text-warm-clay">
        <i className={`bi ${icon}`} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-warm-brown">{value}</div>
    </div>
  );
}

// ---------- Profile editor ----------

const RESERVATION_POLICY_OPTIONS = [
  { value: "RESERVATION_ONLY", label: "Reservations Only" },
  { value: "WALK_IN_ONLY", label: "Walk-Ins Only" },
  { value: "BOTH", label: "Reservations & Walk-Ins" },
];

const MAX_CATEGORIES_FALLBACK = 5;

function ProfileEditor({ business, onSaved }: { business: Business; onSaved: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState(business.name);
  const [categories, setCategories] = useState<string[]>([]);
  const [maxCategories, setMaxCategories] = useState(MAX_CATEGORIES_FALLBACK);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(business.categories || []);
  const [amenities, setAmenities] = useState<string[]>(business.amenities || []);
  const [description, setDescription] = useState(business.description || "");
  const [callPhone, setCallPhone] = useState(business.callPhone || "");
  const [whatsappPhone, setWhatsappPhone] = useState(business.whatsappPhone || "");
  const [email, setEmail] = useState(business.email || "");
  const [address, setAddress] = useState(business.address || "");
  const [latitude, setLatitude] = useState<number | null>(business.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(business.longitude ?? null);
  const [geocoding, setGeocoding] = useState(false);
  // The map only ever renders inside the popup now — this just
  // controls whether that popup is open, not whether a location has
  // been set (that's latitude/longitude themselves).
  const [mapOpen, setMapOpen] = useState(false);

  // Fires on an explicit button press, not on blur.
  const handleShowMap = async () => {
    setGeocoding(true);
    try {
      const result = address.trim() ? await geocodeAddress(address) : null;
      if (result) {
        setLatitude(result.latitude);
        setLongitude(result.longitude);
      } else if (address.trim()) {
        showToast("Couldn't find that address on the map — drag the pin or use your current location instead.");
      }
    } finally {
      setGeocoding(false);
      setMapOpen(true);
    }
  };
  const [website, setWebsite] = useState(business.website || "");
  const [reservationPolicy, setReservationPolicy] = useState<string>(business.reservationPolicy || "");
  const [budgetMin, setBudgetMin] = useState<string>(business.budgetMin ? String(business.budgetMin) : "");
  const [budgetMax, setBudgetMax] = useState<string>(business.budgetMax ? String(business.budgetMax) : "");
  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>(
    business.hours || Object.fromEntries(DAYS.map((d) => [d, null])),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.businesses
      .categories()
      .then((list) => setCategories(list))
      .catch(() => {
        if (business.categories && business.categories.length > 0) {
          setCategories(business.categories);
        }
      });
    api.businesses
      .maxCategories()
      .then((res) => setMaxCategories(res.maxCategories))
      .catch(() => {
        // Fallback silently
      });
  }, [business.categories]);

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((x) => x !== cat);
      } else if (prev.length < maxCategories) {
        return [...prev, cat];
      }
      return prev;
    });
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      showToast("Please select at least one category.");
      return;
    }
    if (budgetMin && budgetMax && parseFloat(budgetMin) > parseFloat(budgetMax)) {
      showToast("Minimum budget must be less than or equal to maximum budget.");
      return;
    }
    setBusy(true);
    try {
      await api.businesses.update(business.id, {
        name,
        categories: selectedCategories,
        description,
        callPhone: callPhone || undefined,
        whatsappPhone: whatsappPhone || undefined,
        email,
        address,
        website,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        hours,
        amenities,
        reservationPolicy: reservationPolicy || undefined,
        budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
        budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      });
      showToast("Profile updated.");
      onSaved();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <h2 className="mb-4 text-xl text-warm-brown">Business Profile</h2>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Reservation Policy</span>
          <Select
            value={reservationPolicy}
            onChange={setReservationPolicy}
            options={[{ value: "", label: "Not specified" }, ...RESERVATION_POLICY_OPTIONS]}
            className="w-full"
          />
        </label>
      </div>

      {/* Categories - Multi-select */}
      <div className="mb-4">
        <span className="mb-2 block text-xs font-semibold text-warm-clay">Categories ({selectedCategories.length}/{maxCategories})</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => toggleCategory(cat)}
              disabled={selectedCategories.length >= maxCategories && !selectedCategories.includes(cat)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedCategories.includes(cat)
                  ? "border-terracotta bg-terracotta text-white"
                  : "border-border bg-cream text-text"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Call Phone</span>
          <input value={callPhone} onChange={(e) => setCallPhone(e.target.value)} className={inputClass} placeholder="+254700000000" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">WhatsApp Phone</span>
          <input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className={inputClass} placeholder="+254700000000" />
        </label>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="mb-4">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Location on map</span>
        {latitude != null ? (
          <div className="flex items-center justify-between rounded-full border border-border bg-cream px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm text-text">
              <i className="bi bi-geo-alt-fill text-terracotta" /> Location set
            </span>
            <button type="button" onClick={() => setMapOpen(true)} className="text-sm font-semibold text-terracotta hover:underline">
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleShowMap}
            disabled={geocoding}
            className="flex items-center gap-2 rounded-full border border-terracotta bg-[rgba(199,101,58,0.08)] px-5 py-2.5 text-sm font-semibold text-terracotta transition hover:bg-[rgba(199,101,58,0.14)] disabled:opacity-60"
          >
            <i className={`bi ${geocoding ? "bi-arrow-repeat" : "bi-map"}`} />
            {geocoding ? "Looking up that address…" : "Show on map"}
          </button>
        )}
      </div>

      {mapOpen && (
        <LocationPickerModal
          latitude={latitude}
          longitude={longitude}
          onChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
          onClose={() => setMapOpen(false)}
        />
      )}

      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
      </label>

      <label className="mb-5 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Website (optional)</span>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="mybusiness.co.ke"
          className={inputClass}
        />
      </label>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Budget Min (KES, optional)</span>
          <input
            type="number"
            min="0"
            step="100"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            className={inputClass}
            placeholder="e.g., 2000"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Budget Max (KES, optional)</span>
          <input
            type="number"
            min="0"
            step="100"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            className={inputClass}
            placeholder="e.g., 5000"
          />
        </label>
      </div>

      <div className="mb-5">
        <span className="mb-2 block text-xs font-semibold text-warm-clay">Amenities</span>
        <div className="flex flex-wrap gap-2">
          {AMENITY_OPTIONS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => toggleAmenity(a)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                amenities.includes(a)
                  ? "border-terracotta bg-terracotta text-white"
                  : "border-border bg-cream text-text"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <span className="mb-2 block text-xs font-semibold text-warm-clay">Opening Hours</span>
      <div className="mb-5 space-y-2">
        {DAYS.map((day) => {
          const dayHours = hours[day];
          return (
            <div key={day} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <label className="flex w-16 shrink-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={dayHours !== null}
                  onChange={(e) =>
                    setHours((prev) => ({ ...prev, [day]: e.target.checked ? { open: "09:00", close: "18:00" } : null }))
                  }
                  className="shrink-0"
                />
                <span className="truncate">{day.slice(0, 3)}</span>
              </label>
              {dayHours ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={dayHours.open}
                    onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...dayHours, open: e.target.value } }))}
                    className="w-[108px] min-w-0 shrink rounded-lg border border-border bg-cream px-2 py-1 text-xs"
                  />
                  <span className="shrink-0 text-warm-clay">–</span>
                  <input
                    type="time"
                    value={dayHours.close}
                    onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...dayHours, close: e.target.value } }))}
                    className="w-[108px] min-w-0 shrink rounded-lg border border-border bg-cream px-2 py-1 text-xs"
                  />
                </div>
              ) : (
                <span className="text-xs text-warm-clay">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={busy}
        className="rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

// ---------- Experiences ----------

function ExperienceManager({
  businessId,
  experiences,
  tier,
  tiers,
  businessBudgetMin,
  businessBudgetMax,
  onChanged,
}: {
  businessId: string;
  experiences: Experience[];
  tier: string;
  tiers: Record<string, TierLimits> | null;
  businessBudgetMin: number | null;
  businessBudgetMax: number | null;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [ticketingLink, setTicketingLink] = useState("");
  const [price, setPrice] = useState("");
  const [useBusinessBudget, setUseBusinessBudget] = useState(true);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenExpThumbs, setBrokenExpThumbs] = useState<Set<string>>(new Set());

  const live = experiences.filter((e) => !e.isExpired);
  const cap = tiers?.[tier]?.concurrentExperiences;
  const hasBusinessBudget = businessBudgetMin != null || businessBudgetMax != null;
  const businessBudgetLabel = hasBusinessBudget
    ? businessBudgetMin != null && businessBudgetMax != null
      ? `KES ${businessBudgetMin.toLocaleString()}–${businessBudgetMax.toLocaleString()}`
      : businessBudgetMin != null
        ? `From KES ${businessBudgetMin.toLocaleString()}`
        : `Up to KES ${businessBudgetMax!.toLocaleString()}`
    : null;

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setLocation("");
    setTicketingLink("");
    setPrice("");
    setUseBusinessBudget(hasBusinessBudget);
    setBudgetMin("");
    setBudgetMax("");
    setCoverImage(null);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (exp: Experience) => {
    setEditingId(exp.id);
    setTitle(exp.title);
    setDescription(exp.description || "");
    setStartsAt(exp.startsAt.slice(0, 16));
    setEndsAt(exp.endsAt ? exp.endsAt.slice(0, 16) : "");
    setLocation(exp.location || "");
    setTicketingLink(exp.ticketingLink || "");
    setPrice(exp.price != null ? String(exp.price) : "");
    // inheritedBudget means the API filled these in from the business's
    // own default (see withBudgetFallback) — this experience has no
    // budget of its own, so default the toggle to "use business
    // default" and leave the custom fields blank rather than
    // pre-filling them with values that would turn into a hard-coded
    // override the moment the form is saved.
    const inherited = exp.inheritedBudget ?? false;
    setUseBusinessBudget(inherited || (exp.budgetMin == null && exp.budgetMax == null && hasBusinessBudget));
    setBudgetMin(inherited ? "" : exp.budgetMin != null ? String(exp.budgetMin) : "");
    setBudgetMax(inherited ? "" : exp.budgetMax != null ? String(exp.budgetMax) : "");
    setCoverImage(exp.images[0] || null);
    setError(null);
    setShowForm(true);
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const { url } = await api.experiences.uploadCoverImage(businessId, file);
      setCoverImage(url);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't upload that image.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!coverImage) {
      setError("A cover image is required.");
      return;
    }
    if (endsAt && startsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("End time must be after the start time.");
      return;
    }
    if (!useBusinessBudget && budgetMin && budgetMax && parseFloat(budgetMin) > parseFloat(budgetMax)) {
      setError("Minimum budget must be less than or equal to maximum budget.");
      return;
    }
    setBusy(true);
    const dto = {
      title,
      description,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      location,
      ticketingLink: ticketingLink || undefined,
      price: Number(price),
      images: [coverImage],
      // "Use business default" sends undefined for both — the API
      // resolves that to the business's own budget at read time (see
      // withBudgetFallback) rather than us copying the current business
      // values in here, so a later change to the business's default
      // keeps applying automatically instead of freezing at today's
      // numbers.
      budgetMin: useBusinessBudget ? null : budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: useBusinessBudget ? null : budgetMax ? parseFloat(budgetMax) : undefined,
    };
    try {
      if (editingId) {
        await api.experiences.update(editingId, dto);
        showToast("Experience updated.");
      } else {
        await api.experiences.create(businessId, dto);
        showToast("Experience published.");
      }
      resetForm();
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that experience.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.experiences.remove(id);
      showToast("Experience deleted.");
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete that experience.");
    }
  };

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl text-warm-brown">Experiences</h2>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              openCreate();
            }
          }}
          className="text-sm font-semibold text-terracotta"
        >
          {showForm ? "Cancel" : "+ New Experience"}
        </button>
      </div>

      {cap !== null && cap !== undefined && (
        <p className="mb-3 text-xs text-warm-clay">
          {live.length} of {cap} concurrently-live slots used on your {tier} tier.
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-2xl border border-border bg-cream p-4">
          {/* Cover image */}
          <div>
            <span className="mb-1 block text-xs font-semibold text-warm-clay">Cover image</span>
            {coverImage ? (
              <div className="relative mb-2 h-36 w-full overflow-hidden rounded-xl">
                <Image src={coverImage} alt="" fill sizes="400px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-error"
                >
                  <i className="bi bi-x-lg text-xs" />
                </button>
              </div>
            ) : (
              <label className="mb-2 flex h-24 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-warm-clay hover:border-terracotta">
                {uploadingCover ? "Uploading…" : "Click to upload a cover image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
                />
              </label>
            )}
          </div>

          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunset Rooftop Tasting" className={inputClass} />
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What's this experience about?"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Starts</span>
              <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Ends</span>
              <input required type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
            </label>
          </div>
          <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address" className={inputClass} />
          <input
            value={ticketingLink}
            onChange={(e) => setTicketingLink(e.target.value)}
            placeholder="Ticketing link (optional)"
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Price (KES)</span>
              <input required type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className={inputClass} />
            </label>
            <label className={`block ${useBusinessBudget ? "opacity-50" : ""}`}>
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Budget Min (KES)</span>
              <input
                type="number"
                min={0}
                step="100"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="e.g., 2000"
                disabled={useBusinessBudget}
                className={inputClass}
              />
            </label>
            <label className={`block ${useBusinessBudget ? "opacity-50" : ""}`}>
              <span className="mb-1 block text-xs font-semibold text-warm-clay">Budget Max (KES)</span>
              <input
                type="number"
                min={0}
                step="100"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="e.g., 5000"
                disabled={useBusinessBudget}
                className={inputClass}
              />
            </label>
          </div>
          {/* Val, Sep 2026: budget lives at both the business level and
              per-experience — this toggle is how the owner picks which
              one applies to this particular experience. Checked =
              inherit the business's own range (kept live, not copied —
              see withBudgetFallback on the API); unchecked = set a
              one-off range just for this experience. */}
          <label className="flex items-center gap-2 text-xs text-warm-clay">
            <input
              type="checkbox"
              checked={useBusinessBudget}
              onChange={(e) => setUseBusinessBudget(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-terracotta"
            />
            {hasBusinessBudget ? (
              <>Use business&apos;s default budget ({businessBudgetLabel}) instead of setting one just for this experience</>
            ) : (
              <>Use business&apos;s default budget (not set — add one on your profile to inherit it here)</>
            )}
          </label>
          {error && <p className="text-sm text-error">{error}</p>}
          <button disabled={busy || uploadingCover} className="w-full rounded-full bg-terracotta py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "Saving…" : editingId ? "Save Experience" : "Publish Experience"}
          </button>
        </form>
      )}

      {experiences.length === 0 ? (
        <p className="text-sm text-warm-clay">You haven&apos;t hosted an experience yet.</p>
      ) : (
        <div className="space-y-2">
          {experiences.map((exp) => (
            <div key={exp.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">
                {exp.images[0] && !brokenExpThumbs.has(exp.id) && (
                  <Image
                    src={exp.images[0]}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                    onError={() => setBrokenExpThumbs((prev) => new Set(prev).add(exp.id))}
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{exp.title}</div>
                <div className="text-xs text-warm-clay">
                  {new Date(exp.startsAt).toLocaleDateString()} · {exp.isExpired ? "Past" : "Upcoming"}
                </div>
              </div>
              {!exp.isExpired && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(exp)} className="p-1.5 text-warm-clay hover:text-terracotta" aria-label="Edit">
                    <i className="bi bi-pencil" />
                  </button>
                  <button onClick={() => handleDelete(exp.id)} className="p-1.5 text-error" aria-label="Delete">
                    <i className="bi bi-trash" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Subscription / payment ----------

// Shared perks card — used for the business's current tier (no button),
// a genuinely selectable upgrade (button, part of the M-Pesa flow
// below), or a locked preview (perks visible, but not payable — shown
// while ANY trial is active, since payment is blocked globally during
// a trial regardless of which tier's card this is, Val, Sep 2026).
function PlanCard({
  tierKey,
  tiers,
  mode,
  selected,
  onSelect,
  discountPercent,
}: {
  tierKey: "STARTER" | "GROWTH" | "PREMIUM";
  tiers: Record<string, TierLimits> | null;
  mode: "current" | "selectable" | "locked";
  selected?: boolean;
  onSelect?: () => void;
  discountPercent?: number;
}) {
  const t = tiers?.[tierKey];
  if (!t) return null;

  const priceDisplay =
    t.priceKes === 0 ? (
      "Free"
    ) : mode === "selectable" && discountPercent ? (
      <>
        <span className="mr-1.5 text-xs font-normal text-warm-clay line-through">KES {t.priceKes.toLocaleString()}</span>
        KES {Math.round(t.priceKes * (1 - discountPercent / 100)).toLocaleString()}/mo
      </>
    ) : (
      `KES ${t.priceKes.toLocaleString()}/mo`
    );

  const inner = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold text-warm-brown">
          {mode === "selectable" && selected && <i className="bi bi-check-circle-fill text-terracotta" />}
          {tierKey === "STARTER" ? "Starter" : tierKey === "GROWTH" ? "🌟 Featured" : "✨ Premium"}
        </span>
        <span className="text-sm font-semibold text-warm-brown">{priceDisplay}</span>
      </div>
      {mode === "current" && (
        <span className="mb-2 inline-block rounded-full bg-[rgba(93,96,65,0.12)] px-2.5 py-1 text-xs font-semibold text-olive">
          Current plan
        </span>
      )}
      {mode === "locked" && (
        <span className="mb-2 inline-block rounded-full bg-border px-2.5 py-1 text-xs font-semibold text-warm-clay">
          Available once your trial ends
        </span>
      )}
      <ul className="space-y-1 text-sm text-warm-clay">
        <li className="flex items-center gap-1.5">
          <i className="bi bi-camera text-xs" /> Up to {t.photos} photos
        </li>
        <li className="flex items-center gap-1.5">
          <i className="bi bi-camera-reels text-xs" />
          Up to {t.videos} video{t.videos === 1 ? "" : "s"}, {t.videoMaxSeconds} sec each
        </li>
        <li className="flex items-center gap-1.5">
          <i className="bi bi-ticket-perforated text-xs" />
          Up to {t.concurrentExperiences ?? t.monthlyExperiencesIncluded ?? 0} active experiences
        </li>
        {t.extraFeatures.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <i className="bi bi-star text-xs" /> {f}
          </li>
        ))}
      </ul>
    </>
  );

  const baseClass = "rounded-2xl border p-4 text-left transition";
  if (mode === "selectable") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`${baseClass} ${selected ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-cream hover:border-warm-clay"}`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={`${baseClass} ${mode === "locked" ? "border-dashed border-border bg-cream opacity-70" : "border-border bg-cream"}`}>
      {inner}
    </div>
  );
}

function SubscriptionPanel({
  business,
  tiers,
  subStatus,
  onUpgraded,
  showToast,
}: {
  business: Business;
  tiers: Record<string, TierLimits> | null;
  subStatus: {
    shouldPromptUpgrade: boolean;
    upgradeMessage: string | null;
    discountPercent: number;
    firstCohortPremiumTrial: boolean;
    trialOffer: { tier: string; days: number } | null;
    activeTrial: { tier: string; endsAt: string } | null;
    status?: string;
    gracePeriodEndsAt?: string | null;
  } | null;
  onUpgraded: () => void;
  showToast: (msg: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [targetTier, setTargetTier] = useState<"GROWTH" | "PREMIUM">("GROWTH");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId || status === "SUCCESS" || status === "FAILED") return;
    const t = setInterval(async () => {
      const res = await api.payments.status(paymentId);
      setStatus(res.status);
      if (res.status === "SUCCESS") {
        showToast("Payment confirmed! Your tier has been upgraded.");
        onUpgraded();
      } else if (res.status === "FAILED") {
        showToast("Payment failed. You can try again.");
      }
    }, 3000);
    return () => clearInterval(t);
  }, [paymentId, status, onUpgraded, showToast]);

  const handleUpgrade = async () => {
    if (!tiers) return;
    const phoneNumber = normalizeKenyanMsisdn(phone);
    if (!phoneNumber) {
      setError("Enter a valid Safaricom number to receive the M-Pesa prompt, e.g. 0712345678.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // `amount` here is only for the loading-state UI copy (the actual
      // charge is computed and enforced server-side from targetTier +
      // the business's discount, not trusted from this client value —
      // see PaymentService.initiate).
      const amount = tiers[targetTier].priceKes;
      const res = await api.payments.initiate({ businessId: business.id, purpose: "SUBSCRIPTION", targetTier, amount, phoneNumber });
      setPaymentId(res.payment.id);
      setStatus("PENDING");
      showToast(res.simulated ? "Simulated STK Push sent (no real M-Pesa credentials configured)." : "Check your phone for the M-Pesa prompt.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start that payment.");
    } finally {
      setBusy(false);
    }
  };

  const handleStartTrial = async () => {
    setTrialBusy(true);
    try {
      await api.subscriptions.startTrial(business.id);
      showToast("Trial started, enjoy the extra room!");
      onUpgraded();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't start the trial.");
    } finally {
      setTrialBusy(false);
    }
  };

  const isTrialing = !!subStatus?.activeTrial;
  const isGracePeriod = subStatus?.status === "GRACE_PERIOD";
  // Whichever tier's perks are the ones actually in effect right now —
  // the trialed tier while trialing, otherwise whatever's really paid
  // for (or Starter, by default).
  const effectiveTier = (subStatus?.activeTrial?.tier ?? business.tier) as "STARTER" | "GROWTH" | "PREMIUM";
  // One shared countdown concept for two different reasons a tier could
  // be about to revert to Starter: a trial running out, or a paid plan
  // in its post-missed-payment grace period (Val, Sep 2026: "the
  // countdown is for both trial and plan"). Only ever shown in the
  // final week either way — see showCountdown below.
  const countdownEndsAt = subStatus?.activeTrial?.endsAt ?? (isGracePeriod ? subStatus?.gracePeriodEndsAt : null) ?? null;
  const daysLeft = countdownEndsAt
    ? Math.max(0, Math.ceil((new Date(countdownEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const showCountdown = daysLeft != null && daysLeft <= 7;

  // Val, Sep 2026: "for the first 100 businesses... disabling the other
  // tiers. But they still have to activate the option." So while a
  // first-cohort business has an unactivated Premium trial offer
  // sitting there, the manual pay-for-a-tier picker is hidden — they
  // should claim the free trial, not pay to skip it. The moment they
  // activate it (or it's not this cohort, or there's no offer at all),
  // normal tier-picking behavior returns.
  const pendingFirstCohortOffer = !!(business.firstCohortPremiumTrial && subStatus?.trialOffer && !subStatus?.activeTrial);

  // Starter with nothing pending shows all three tiers side by side —
  // its own perks for reference, then Growth/Premium to upgrade into
  // (Val, Sep 2026: "if on a free plan and no free trial available").
  // Starter WITH a pending (non-first-cohort) trial offer keeps the
  // narrower, pre-existing two-card Growth/Premium picker instead —
  // that combination wasn't part of what changed here.
  const showThreeCardStarter = business.tier === "STARTER" && !subStatus?.trialOffer && !pendingFirstCohortOffer;
  const showLegacyStarterUpgrade = business.tier === "STARTER" && !!subStatus?.trialOffer && !pendingFirstCohortOffer;
  const showGrowthUpgrade = business.tier === "GROWTH";
  // Payment itself is blocked globally during any active trial — shown
  // as a locked preview instead (Val, Sep 2026), and the M-Pesa form
  // below has nothing to attach to in that state, so it's hidden too.
  const showPaymentForm = !isTrialing && (showThreeCardStarter || showLegacyStarterUpgrade || showGrowthUpgrade);

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <h2 className="mb-1 text-xl text-warm-brown">Subscription</h2>
      <p className="mb-4 text-sm text-warm-clay">
        Currently on <span className="font-semibold text-text">{tierLabel(business.tier)}</span>
        {business.isGrandfathered && " · Grandfathered pricing"}
        {!!business.discountPercent && ` · ${business.discountPercent}% off`}
      </p>

      {/* Always shows what the current (or currently-trialed) tier
          actually includes — replacing what used to be just a bare
          "Trialing Premium, 27 days left" line with no context on what
          that tier even gets you (Val, Sep 2026). The countdown itself
          only joins this once 7 days or fewer remain, whether that's a
          trial ending or a grace-period plan about to lapse. */}
      {tiers?.[effectiveTier] && (
        <div className="mb-5 rounded-2xl border border-olive bg-[rgba(93,96,65,0.06)] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-olive">
            <i className="bi bi-stars" />
            {isTrialing ? `Trialing ${tierLabel(effectiveTier)}` : `Your ${tierLabel(effectiveTier)} plan includes`}
          </p>
          <PlanCard tierKey={effectiveTier} tiers={tiers} mode="current" />
          {showCountdown && (
            <p className="mt-3 border-t border-border pt-3 text-xs font-semibold text-terracotta">
              <i className="bi bi-clock-history mr-1" />
              {daysLeft} day{daysLeft === 1 ? "" : "s"} left —{" "}
              {isTrialing
                ? "reverts to Free automatically unless you upgrade for real before then."
                : "renew now or this plan reverts to Free automatically."}
            </p>
          )}
        </div>
      )}

      {/* Trial offer — a business owner has to actively start this
          themselves (see subscription.service.ts's comment on why), so
          it's presented as something to claim, not something already
          applied. */}
      {subStatus?.trialOffer && !subStatus.activeTrial && (
        <div className="mb-5 rounded-2xl border border-terracotta bg-[rgba(199,101,58,0.06)] p-4">
          <p className="mb-1 text-sm font-semibold text-terracotta">
            <i className="bi bi-gift mr-1.5" />
            Try {tierLabel(subStatus.trialOffer.tier)} for free
          </p>
          <p className="mb-3 text-xs text-warm-clay">
            {subStatus.trialOffer.days} days, full access, no payment required.
          </p>
          <button
            onClick={handleStartTrial}
            disabled={trialBusy}
            className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {trialBusy ? "Starting…" : "Start Trial"}
          </button>
        </div>
      )}

      {showThreeCardStarter && (
        <>
          <p className="mb-1 text-sm font-semibold text-warm-brown">Choose the plan that fits your business.</p>
          <p className="mb-3 text-xs text-warm-clay">
            Upgrade anytime, your current plan stays active until the upgrade is complete.
          </p>
          <div className="mb-4 grid grid-cols-1 gap-3">
            <PlanCard tierKey="STARTER" tiers={tiers} mode="current" />
            <PlanCard
              tierKey="GROWTH"
              tiers={tiers}
              mode="selectable"
              selected={targetTier === "GROWTH"}
              onSelect={() => setTargetTier("GROWTH")}
              discountPercent={business.discountPercent}
            />
            <PlanCard
              tierKey="PREMIUM"
              tiers={tiers}
              mode="selectable"
              selected={targetTier === "PREMIUM"}
              onSelect={() => setTargetTier("PREMIUM")}
              discountPercent={business.discountPercent}
            />
          </div>
        </>
      )}

      {showLegacyStarterUpgrade && (
        <>
          <p className="mb-1 text-sm font-semibold text-warm-brown">Choose the plan that fits your business.</p>
          <p className="mb-3 text-xs text-warm-clay">
            Upgrade anytime, your current plan stays active until the upgrade is complete.
          </p>
          <div className="mb-4 grid grid-cols-1 gap-3">
            <PlanCard
              tierKey="GROWTH"
              tiers={tiers}
              mode="selectable"
              selected={targetTier === "GROWTH"}
              onSelect={() => setTargetTier("GROWTH")}
              discountPercent={business.discountPercent}
            />
            <PlanCard
              tierKey="PREMIUM"
              tiers={tiers}
              mode="selectable"
              selected={targetTier === "PREMIUM"}
              onSelect={() => setTargetTier("PREMIUM")}
              discountPercent={business.discountPercent}
            />
          </div>
        </>
      )}

      {showGrowthUpgrade && (
        <>
          <p className="mb-1 text-sm font-semibold text-warm-brown">
            {isTrialing ? "What Premium adds on top of Growth." : "Upgrade to Premium."}
          </p>
          {!isTrialing && (
            <p className="mb-3 text-xs text-warm-clay">
              Upgrade anytime, your current plan stays active until the upgrade is complete.
            </p>
          )}
          <div className="mb-4 grid grid-cols-1 gap-3">
            <PlanCard tierKey="GROWTH" tiers={tiers} mode="current" />
            <PlanCard
              tierKey="PREMIUM"
              tiers={tiers}
              mode={isTrialing ? "locked" : "selectable"}
              selected={targetTier === "PREMIUM"}
              onSelect={() => setTargetTier("PREMIUM")}
              discountPercent={business.discountPercent}
            />
          </div>
        </>
      )}

      {showPaymentForm && (
        <>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold text-warm-clay">M-Pesa phone number</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="254712345678"
              className={inputClass}
            />
            {phone.trim() && !normalizeKenyanMsisdn(phone) && (
              <span className="mt-1 block text-xs text-error">Enter a valid Safaricom number, e.g. 0712345678.</span>
            )}
          </label>
          {error && <p className="mb-3 text-sm text-error">{error}</p>}
          <button
            onClick={handleUpgrade}
            disabled={busy || !normalizeKenyanMsisdn(phone) || status === "PENDING"}
            className="w-full rounded-full bg-terracotta py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === "PENDING" ? "Waiting for confirmation…" : busy ? "Starting…" : `Upgrade to ${tierLabel(targetTier)} via M-Pesa`}
          </button>
          {status && (
            <p className="mt-3 text-center text-xs text-warm-clay">
              Payment status: <span className="font-semibold">{status}</span>
            </p>
          )}
        </>
      )}

      {pendingFirstCohortOffer && (
        <p className="text-xs text-warm-clay">
          As one of our first 100 businesses, your only option right now is the free Premium trial above — paid
          upgrades open back up once you've activated or skipped it.
        </p>
      )}
    </div>
  );
}


const inputClass =
  "w-full rounded-2xl border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta";

// ---------- Danger zone: delete business ----------

// Business-account customer support contact, only ever rendered inside
// the dashboard (i.e. only surfaced to users who have a Business
// Account), separate from the general hello@ address in the footer.
function SupportContact() {
  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <h2 className="mb-1 text-xl text-warm-brown">Need help?</h2>
      <p className="mb-3 text-sm text-warm-clay">
        Questions about your listing, subscription, or payments? Our support team is here for business
        accounts.
      </p>
      <div className="flex flex-wrap gap-4">
        <a
          href="mailto:hello@spotly.co.ke"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:underline"
        >
          <i className="bi bi-envelope" /> hello@spotly.co.ke
        </a>
        {/* Number intentionally not shown as visible text (Val, Sep
            2026) — wa.me handles opening the app or web depending on
            the device on its own, same as the public business pages'
            WhatsApp button; the number only needs to exist inside this
            link, not be readable on the page. */}
        <a
          href="https://wa.me/254790473112"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:underline"
        >
          <i className="bi bi-whatsapp" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

function DangerZone({ business }: { business: Business }) {
  const router = useRouter();
  const { refreshAuth } = useAuth();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const canConfirm = confirmText.trim() === business.name;

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.businesses.remove(business.id);
      // Their User account survives this, only the Business Account is
      // removed. Refresh the token so the UI immediately reflects the
      // reverted REGISTERED role instead of requiring a re-login.
      await refreshAuth();
      showToast(`${business.name} has been deleted. Your Spotly account is still active.`);
      router.push("/");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete that business, try again.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-spotly border border-error/30 bg-[rgba(214,90,74,0.05)] p-6">
      <h2 className="mb-1 text-xl text-error">Danger Zone</h2>
      <p className="mb-4 text-sm text-warm-clay">
        Deleting your business removes its profile, media, experiences, and reviews received. Your Spotly
        user account stays active, you can browse, save, and review as a regular user, or register a new
        business later.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error transition hover:bg-error hover:text-white"
        >
          Delete Business Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            Type <span className="font-semibold">{business.name}</span> to confirm, this can&apos;t be undone.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={inputClass}
            placeholder={business.name}
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={!canConfirm || busy}
              className="rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Permanently Delete"}
            </button>
            <button
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
              }}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

