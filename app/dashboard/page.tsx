"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/ToastContext";
import { api, ApiError, type Business, type Experience, type Media } from "@/lib/api";
import { Select } from "@/components/Select";
import { Lightbox } from "@/components/Lightbox";
import { normalizeKenyanMsisdn } from "@/lib/phone";

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

  const [business, setBusiness] = useState<Business | null>(null);
  const [tiers, setTiers] = useState<Record<string, TierLimits> | null>(null);
  const [subStatus, setSubStatus] = useState<{
    shouldPromptUpgrade: boolean;
    upgradeMessage: string | null;
    discountPercent: number;
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

  if (!authed) {
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
        <div className="px-11 py-24 text-center text-warm-clay" suppressHydrationWarning>
          Loading your Business Owner Surface…
        </div>
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
            <ProfileEditor business={business} onSaved={load} />
            <MediaSection businessId={businessId} media={business.media || []} coverMediaId={business.coverMediaId ?? null} tier={business.tier} tiers={tiers} onChanged={load} />
            <VideoSection businessId={businessId} media={business.media || []} tier={business.tier} tiers={tiers} onChanged={load} />
            <ExperienceManager
              businessId={businessId}
              experiences={hostingHistory}
              tier={business.tier}
              tiers={tiers}
              onChanged={load}
            />
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

function ProfileEditor({ business, onSaved }: { business: Business; onSaved: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState(business.name);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(business.category);
  const [customCategory, setCustomCategory] = useState("");
  const [amenities, setAmenities] = useState<string[]>(business.amenities || []);
  const [description, setDescription] = useState(business.description || "");
  const [phone, setPhone] = useState(business.phone || "");
  const [email, setEmail] = useState(business.email || "");
  const [address, setAddress] = useState(business.address || "");
  const [website, setWebsite] = useState(business.website || "");
  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>(
    business.hours || Object.fromEntries(DAYS.map((d) => [d, null])),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Same "real categories in use" list the registration form uses, so
    // a category typed in via "Other" elsewhere shows up here too, not
    // just a static seed list.
    api.businesses
      .categories()
      .then((list) => setCategories(list))
      .catch(() => {
        // Fall back to just the business's current category so the
        // dropdown isn't empty if this call fails, editing shouldn't be
        // blocked by it.
        setCategories([business.category]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const handleSave = async () => {
    if (category === "Other" && !customCategory.trim()) {
      showToast("Tell us what kind of business this is.");
      return;
    }
    setBusy(true);
    try {
      await api.businesses.update(business.id, {
        name,
        category: category === "Other" ? customCategory.trim() : category,
        description,
        phone,
        email,
        address,
        website,
        hours,
        amenities,
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
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Category</span>
          <Select
            value={category}
            onChange={setCategory}
            options={[
              ...Array.from(new Set([business.category, ...categories])).map((c) => ({ value: c, label: c })),
              { value: "Other", label: "Other, type your own" },
            ]}
            className="w-full"
            searchable
          />
        </label>
      </div>
      {category === "Other" && (
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">What kind of business is this?</span>
          <input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className={inputClass}
            placeholder="e.g. Bowling Alley"
          />
        </label>
      )}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-warm-clay">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
      </label>
      <label className="mb-5 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Address</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
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

// ---------- Media ----------

function VideoSection({
  businessId,
  media,
  tier,
  tiers,
  onChanged,
}: {
  businessId: string;
  media: Media[];
  tier: string;
  tiers: Record<string, TierLimits> | null;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videos = media.filter((m) => m.type === "VIDEO" && m.status === "APPROVED");
  const limit = tiers?.[tier]?.videos ?? 0;
  const maxSeconds = tiers?.[tier]?.videoMaxSeconds ?? 60;

  // The quality gate needs a real duration to enforce the tier's max —
  // without this, checkVideo silently passes anything (0s never exceeds
  // a positive max), so the length limit would exist in name only. A
  // browser can read this itself by loading the file into a throwaway
  // <video> element and waiting for its metadata, no upload needed yet.
  const getDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Couldn't read that video file."));
      };
      video.src = URL.createObjectURL(file);
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const durationSeconds = Math.round(await getDuration(file));
      if (durationSeconds > maxSeconds) {
        setError(`This video is ${durationSeconds}s, your ${tier} tier's limit is ${maxSeconds}s.`);
        return;
      }
      const ext = file.name.split(".").pop() || "mp4";
      const { publicUrl, storageKey } = await api.media.getUploadUrl(businessId, "VIDEO", ext);
      const formData = new FormData();
      formData.append("file", file);
      await api.media.submit(
        businessId,
        formData,
        `type=VIDEO&url=${encodeURIComponent(publicUrl)}&storageKey=${encodeURIComponent(storageKey)}&durationSeconds=${durationSeconds}`,
      );
      showToast("Video published.");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed, try again.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl text-warm-brown">Videos</h2>
        <span className="text-xs font-semibold text-warm-clay">
          {videos.length} of {limit} used · up to {maxSeconds}s each
        </span>
      </div>

      {videos.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {videos.map((m) => (
            <div key={m.id} className="group relative">
              <video src={m.url} controls className="h-28 w-full rounded-lg bg-black object-cover" />
              <button
                onClick={async () => {
                  try {
                    await api.media.remove(businessId, m.id);
                    showToast("Video removed.");
                    onChanged();
                  } catch (err) {
                    showToast(err instanceof ApiError ? err.message : "Couldn't remove that video.");
                  }
                }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(67,53,47,0.75)] text-xs text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Delete video"
              >
                <i className="bi bi-trash" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-cream px-4 py-2.5 text-sm font-semibold">
        <i className="bi bi-camera-video" />
        {busy ? "Checking video…" : "Upload Video"}
        <input type="file" accept="video/*" className="hidden" onChange={handleFile} disabled={busy || videos.length >= limit} />
      </label>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      {videos.length >= limit && (
        <p className="mt-2 text-xs text-warm-clay">You&apos;ve used all {limit} videos on your {tier} tier. Upgrade for more.</p>
      )}
    </div>
  );
}

function MediaSection({
  businessId,
  media,
  coverMediaId,
  tier,
  tiers,
  onChanged,
}: {
  businessId: string;
  media: Media[];
  coverMediaId: string | null;
  tier: string;
  tiers: Record<string, TierLimits> | null;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [flaggedLightboxSrc, setFlaggedLightboxSrc] = useState<string | null>(null);

  const photos = media.filter((m) => m.type === "PHOTO" && m.status === "APPROVED");
  const flaggedPhotos = media.filter((m) => m.type === "PHOTO" && m.status === "FLAGGED");
  const limit = tiers?.[tier]?.photos ?? 0;
  // No explicit choice made yet means the default cover is whichever
  // photo is first in this array — the API already orders it that way
  // (oldest-uploaded first, or the chosen cover if one's set — see
  // BusinessService.attachRatingsAndStripMetrics).
  const effectiveCoverId = coverMediaId ?? photos[0]?.id ?? null;

  const handleSetCover = async (mediaId: string) => {
    setCoverBusyId(mediaId);
    try {
      await api.businesses.setCoverPhoto(businessId, mediaId);
      showToast("Cover photo updated.");
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't set that as the cover photo.");
    } finally {
      setCoverBusyId(null);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const { publicUrl, storageKey } = await api.media.getUploadUrl(businessId, "PHOTO", ext);
      const formData = new FormData();
      formData.append("file", file);
      await api.media.submit(businessId, formData, `type=PHOTO&url=${encodeURIComponent(publicUrl)}&storageKey=${encodeURIComponent(storageKey)}`);
      showToast("Photo published.");
      onChanged();
    } catch (err) {
      // The quality gate's rejection reason (too small, too blurry, etc.)
      // surfaces here in plain language, matches BRD's "Media Upload
      // Rejected" empty-state spec.
      setError(err instanceof ApiError ? err.message : "Upload failed, try again.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl text-warm-brown">Photos</h2>
        <span className="text-xs font-semibold text-warm-clay">
          {photos.length} of {limit} used
        </span>
      </div>

      {photos.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {photos.map((m, i) => (
            <div key={m.id} className="group relative">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="block w-full cursor-zoom-in"
                aria-label="View full photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt=""
                  className="h-20 w-full rounded-lg object-cover transition group-hover:brightness-90"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div className="hidden h-20 w-full flex-col items-center justify-center gap-1 rounded-lg bg-cream text-warm-clay">
                  <i className="bi bi-image text-lg" />
                  <span className="text-[0.6rem]">Unavailable</span>
                </div>
              </button>
              {m.id === effectiveCoverId ? (
                <span className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-terracotta px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">
                  <i className="bi bi-star-fill" /> Cover
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetCover(m.id);
                  }}
                  disabled={coverBusyId === m.id}
                  className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(67,53,47,0.75)] text-xs text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-100"
                  aria-label="Set as cover photo"
                  title="Set as cover photo"
                >
                  <i className={coverBusyId === m.id ? "bi bi-hourglass-split" : "bi bi-star"} />
                </button>
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await api.media.remove(businessId, m.id);
                    showToast("Photo removed.");
                    onChanged();
                  } catch (err) {
                    showToast(err instanceof ApiError ? err.message : "Couldn't remove that photo.");
                  }
                }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(67,53,47,0.75)] text-xs text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Delete photo"
              >
                <i className="bi bi-trash" />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex != null && (
        <Lightbox
          images={photos.map((m) => m.url)}
          startIndex={lightboxIndex}
          alt="Business photo"
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-cream px-4 py-2.5 text-sm font-semibold">
        <i className="bi bi-cloud-upload" />
        {busy ? "Checking photo…" : "Upload Photo"}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy || photos.length >= limit} />
      </label>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      {photos.length >= limit && <p className="mt-2 text-xs text-warm-clay">You&apos;ve used all {limit} photos on your {tier} tier. Upgrade for more.</p>}

      {flaggedPhotos.length > 0 && (
        <div className="mt-5 rounded-2xl border border-warning bg-[rgba(227,169,59,0.08)] p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-warm-brown">
            <i className="bi bi-flag" /> Flagged for review
          </p>
          <p className="mb-3 text-xs text-warm-clay">
            These photos matched an image already used on a different business account, so they&apos;re
            held back from your public listing while our team reviews them. If this looks wrong, for
            example, you re-uploaded your own photo, you can safely delete it and try a different image.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {flaggedPhotos.map((m) => (
              <div key={m.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setFlaggedLightboxSrc(m.url)}
                  className="block w-full cursor-zoom-in"
                  aria-label="View full photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt=""
                    className="h-20 w-full rounded-lg object-cover opacity-70"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <div className="hidden h-20 w-full flex-col items-center justify-center gap-1 rounded-lg bg-cream text-warm-clay opacity-70">
                    <i className="bi bi-image text-lg" />
                    <span className="text-[0.6rem]">Unavailable</span>
                  </div>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await api.media.remove(businessId, m.id);
                      showToast("Flagged photo removed.");
                      onChanged();
                    } catch (err) {
                      showToast(err instanceof ApiError ? err.message : "Couldn't remove that photo.");
                    }
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(67,53,47,0.75)] text-xs text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Delete flagged photo"
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            ))}
          </div>
          {flaggedLightboxSrc && (
            <Lightbox
              images={[flaggedLightboxSrc]}
              alt="Flagged photo"
              onClose={() => setFlaggedLightboxSrc(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Experiences ----------

function ExperienceManager({
  businessId,
  experiences,
  tier,
  tiers,
  onChanged,
}: {
  businessId: string;
  experiences: Experience[];
  tier: string;
  tiers: Record<string, TierLimits> | null;
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
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenExpThumbs, setBrokenExpThumbs] = useState<Set<string>>(new Set());

  const live = experiences.filter((e) => !e.isExpired);
  const cap = tiers?.[tier]?.concurrentExperiences;

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setLocation("");
    setTicketingLink("");
    setPrice("");
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
    // datetime-local inputs need "YYYY-MM-DDTHH:mm", not a full ISO string.
    setStartsAt(exp.startsAt.slice(0, 16));
    setEndsAt(exp.endsAt ? exp.endsAt.slice(0, 16) : "");
    setLocation(exp.location || "");
    setTicketingLink(exp.ticketingLink || "");
    setPrice(exp.price != null ? String(exp.price) : "");
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
    // Every field is required for a real, complete listing — the form's
    // own `required` attributes stop a browser submitting an empty text
    // input, but the cover image and datetime fields need their own
    // check here since there's no plain HTML way to make a "you must
    // upload something" or "this can't be earlier than X" rule enforce
    // itself.
    if (!coverImage) {
      setError("A cover image is required.");
      return;
    }
    if (endsAt && startsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("End time must be after the start time.");
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
          <input required type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (KES, enter 0 if free)" className={inputClass} />
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
    trialOffer: { tier: string; days: number } | null;
    activeTrial: { tier: string; endsAt: string } | null;
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

  const daysLeft = subStatus?.activeTrial
    ? Math.max(0, Math.ceil((new Date(subStatus.activeTrial.endsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <h2 className="mb-1 text-xl text-warm-brown">Subscription</h2>
      <p className="mb-4 text-sm text-warm-clay">
        Currently on <span className="font-semibold text-text">{tierLabel(business.tier)}</span>
        {business.isGrandfathered && " · Grandfathered pricing"}
        {!!business.discountPercent && ` · ${business.discountPercent}% off`}
      </p>

      {/* Active trial — a countdown, not another offer to choose. */}
      {subStatus?.activeTrial && (
        <div className="mb-5 rounded-2xl border border-olive bg-[rgba(93,96,65,0.06)] p-4">
          <p className="text-sm font-semibold text-olive">
            <i className="bi bi-stars mr-1.5" />
            Trialing {tierLabel(subStatus.activeTrial.tier)}, {daysLeft} day{daysLeft === 1 ? "" : "s"} left
          </p>
          <p className="mt-1 text-xs text-warm-clay">
            Your trial reverts to the Free package automatically when it ends, unless you upgrade for real before then.
          </p>
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

      {business.tier !== "PREMIUM" && (
        <>
          <p className="mb-1 text-sm font-semibold text-warm-brown">Choose the plan that fits your business.</p>
          <p className="mb-3 text-xs text-warm-clay">
            Upgrade anytime, your current plan stays active until the upgrade is complete.
          </p>
          <div className="mb-4 grid grid-cols-1 gap-3">
            {(business.tier !== "GROWTH" ? (["GROWTH", "PREMIUM"] as const) : (["PREMIUM"] as const)).map((tierKey) => {
              const t = tiers?.[tierKey];
              const selected = targetTier === tierKey;
              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => setTargetTier(tierKey)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-cream hover:border-warm-clay"
                  }`}
                >
                  {!!business.discountPercent && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-olive px-2.5 py-1 text-xs font-semibold text-white">
                      <i className="bi bi-tag" /> Try {tierLabel(tierKey)} for {business.discountPercent}% off
                    </span>
                  )}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-warm-brown">
                      {selected && <i className="bi bi-check-circle-fill text-terracotta" />}
                      {tierKey === "GROWTH" ? "🌟 Featured" : "✨ Premium"}
                    </span>
                    <span className="text-sm font-semibold text-warm-brown">
                      {t ? (
                        business.discountPercent ? (
                          <>
                            <span className="mr-1.5 text-xs font-normal text-warm-clay line-through">
                              KES {t.priceKes.toLocaleString()}
                            </span>
                            KES {Math.round(t.priceKes * (1 - business.discountPercent / 100)).toLocaleString()}/mo
                          </>
                        ) : (
                          `KES ${t.priceKes.toLocaleString()}/mo`
                        )
                      ) : (
                        "…"
                      )}
                    </span>
                  </div>
                  {t && (
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
                  )}
                </button>
              );
            })}
          </div>
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
      <a
        href="mailto:support@spotly.co.ke"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:underline"
      >
        <i className="bi bi-envelope" /> support@spotly.co.ke
      </a>
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

