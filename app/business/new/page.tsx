"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/ToastContext";
import { api, ApiError } from "@/lib/api";
import { CITIES, LOCATIONS_BY_CITY } from "@/lib/locations";
import { Select } from "@/components/Select";

// Used only until the real list loads from GET /businesses/categories
// (which merges this same seed with whatever categories businesses have
// actually registered under, including anything typed in via "Other"),
// so the dropdown isn't empty for a moment on first paint.
// Mirrors business.service.ts's SEED_CATEGORIES exactly — kept in sync
// manually since there's no shared constants file between the two
// projects yet. Used only until the real list loads from
// GET /businesses/categories.
const FALLBACK_CATEGORIES = [
  "Pottery Studio",
  "Painting Studio",
  "Cake Decorating",
  "Candle Making",
  "Crafts Studio",
  "Art Gallery",
  "Art Studio",
  "Art Installation",
  "Exhibition Space",
  "Museum",
  "Cultural Centre",
  "Heritage Site",
  "Cultural Experience",
  "Live Music Venue",
  "Acoustic Session Venue",
  "Karaoke Bar",
  "Dance Class",
  "Dance Studio",
  "Social Dancing Venue",
  "Dance Performance Venue",
  "Nightclub",
  "Lounge",
  "Late-Night Venue",
  "Go-Karting",
  "Paintball",
  "Ziplining",
  "Climbing Gym",
  "Roller Skating Rink",
  "Ice Skating Rink",
  "Arcade",
  "VR Gaming",
  "Gaming Lounge",
  "Esports Venue",
  "Simulator Experience",
  "Scenic View Point",
  "Picnic Spot",
  "Hiking Trail",
  "Camping Site",
  "Garden",
  "Park",
  "Spa",
  "Massage",
  "Fitness",
  "Yoga Studio",
  "Salon",
  "Wellness Centre",
  "Sports Ground",
  "Training Facility",
  "Sports Court",
  "Swimming Pool",
  "Antique Store",
  "Farmers Market",
  "Thrift Store",
  "Boutique",
  "Cooking Class",
  "Educational Workshop",
  "Demonstration Experience",
  "Restaurant",
  "Cafe",
  "Bakery",
  "Diner",
  "Specialty Food Spot",
  "Cocktail Bar",
  "Wine Bar",
  "Brewery",
  "Specialty Drinks Spot",
  "Buffet",
  "Sharing Platters Spot",
  "Nyama Choma Spot",
  "Choma Base",
  "Street Food",
  "Group Dining Venue",
  "Services",
];
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

export default function NewBusinessPage() {
  const { authed, businessId, openAuthModal, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [type, setType] = useState<"VENUE" | "EXPERIENCE_HOST">("VENUE");
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [category, setCategory] = useState(FALLBACK_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [neighborhood, setNeighborhood] = useState(LOCATIONS_BY_CITY[CITIES[0]][0]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Real categories in use (plus the seed list), this is what makes a
    // custom "Other" entry from one business show up as a real, pickable
    // option for the next business, instead of everyone re-typing it.
    api.businesses
      .categories()
      .then((list) => list.length > 0 && setCategories(list))
      .catch(() => {
        // Fall back to the static seed list silently, registration
        // shouldn't be blocked by this endpoint being unreachable.
      });
  }, []);

  useEffect(() => {
    if (!authed) {
      openAuthModal();
      return;
    }
    if (businessId) {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, businessId]);

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (category === "Other" && !customCategory.trim()) {
      setError("Tell us what kind of business this is.");
      return;
    }
    if (!description.trim()) {
      setError("A short description helps people know what to expect, please add one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.businesses.create({
        type,
        name,
        category: category === "Other" ? customCategory.trim() : category,
        description: description.trim(),
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        website: website || undefined,
        city,
        neighborhood,
        amenities,
      });
      // Backend flips this user's role to BUSINESS_OWNER, but their
      // current token still says REGISTERED until refreshed, see
      // POST /auth/refresh.
      await refreshAuth();
      showToast(`${name} is live on Spotly!`);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't register that business, try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <>
        <Navbar />
        <div className="px-11 py-24 text-center text-warm-clay">Sign in to list your business.</div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <h1 className="mb-1 text-3xl text-warm-brown">List Your Business</h1>
        <p className="mb-8 text-sm text-warm-clay">
          Starter tier is free for Nairobi&apos;s first 200 businesses, up to 5 photos, 1 video, no calendar deadline.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business type */}
          <div>
            <span className="mb-2 block text-sm font-semibold text-warm-brown">Business type</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType("VENUE")}
                className={`flex-1 rounded-spotly border p-4 text-left transition ${
                  type === "VENUE" ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 font-semibold">Venue</div>
                <div className="text-xs text-warm-clay">A permanent, ongoing business, café, restaurant, salon.</div>
              </button>
              <button
                type="button"
                onClick={() => setType("EXPERIENCE_HOST")}
                className={`flex-1 rounded-spotly border p-4 text-left transition ${
                  type === "EXPERIENCE_HOST" ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 font-semibold">Experience Host</div>
                <div className="text-xs text-warm-clay">Publish one-time or recurring events, no fixed venue.</div>
              </button>
            </div>
          </div>

          <Field label="Business name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jiko Kilimani" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select
                value={category}
                onChange={setCategory}
                options={[...categories.map((c) => ({ value: c, label: c })), { value: "Other", label: "Other, type your own" }]}
              />
            </Field>
            <Field label="Neighborhood / Area">
              <Select
                value={neighborhood}
                onChange={setNeighborhood}
                options={LOCATIONS_BY_CITY[city].map((n) => ({ value: n, label: n }))}
              />
            </Field>
          </div>
          {category === "Other" && (
            <Field label="What kind of business is this?">
              <input
                required
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className={inputClass}
                placeholder="e.g. Bowling Alley"
              />
              <p className="mt-1.5 text-xs text-warm-clay">
                This becomes a real category, future businesses of the same type will see it in this
                dropdown instead of needing to pick &quot;Other&quot; themselves.
              </p>
            </Field>
          )}
          <p className="-mt-2 text-xs text-warm-clay">
            <i className="bi bi-geo-alt mr-1" />
            City: <span className="font-semibold text-text">{city}</span>, Spotly launches in Nairobi first; more cities coming soon.
          </p>

          <Field label="Description">
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="What makes this place worth discovering? This shows on your business page."
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+254700000000" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="hello@business.co.ke" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Address">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="14 Wood Avenue, Kilimani" />
            </Field>
            <Field label="Website (optional)">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="mybusiness.co.ke" />
            </Field>
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-warm-brown">Amenities</span>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => toggleAmenity(a)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    amenities.includes(a)
                      ? "border-terracotta bg-terracotta text-white"
                      : "border-border bg-surface text-text"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-terracotta py-3.5 text-sm font-semibold text-white transition hover:bg-[#b5572f] disabled:opacity-60"
          >
            {busy ? "Setting up your business…" : "List My Business"}
          </button>
        </form>
      </div>
      <Footer />
    </>
  );
}

const inputClass =
  "w-full rounded-2xl border border-border bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-warm-brown">{label}</span>
      {children}
    </label>
  );
}
