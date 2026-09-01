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
const FALLBACK_CATEGORIES = [
  "Pottery Studio", "Painting Studio", "Cake Decorating", "Candle Making", "Crafts Studio", "Photography Studio",
  "Art Gallery", "Art Studio", "Art Installation", "Exhibition Space", "Museum", "Cultural Centre", "Heritage Site",
  "Cultural Experience", "Live Music Venue", "Acoustic Session Venue", "Karaoke Bar", "Dance Class", "Dance Studio",
  "Social Dancing Venue", "Dance Performance Venue", "Nightclub", "Lounge", "Late-Night Venue", "Go-Karting", "Paintball",
  "Ziplining", "Climbing Gym", "Roller Skating Rink", "Ice Skating Rink", "Arcade", "VR Gaming", "Gaming Lounge",
  "Esports Venue", "Simulator Experience", "Scenic View Point", "Picnic Spot", "Hiking Trail", "Camping Site", "Garden",
  "Park", "Spa", "Massage", "Fitness", "Yoga Studio", "Salon", "Wellness Centre", "Sports Ground", "Training Facility",
  "Sports Court", "Swimming Pool", "Antique Store", "Farmers Market", "Thrift Store", "Boutique", "Cooking Class",
  "Educational Workshop", "Demonstration Experience", "Restaurant", "Cafe", "Bakery", "Diner", "Specialty Food Spot",
  "Cocktail Bar", "Wine Bar", "Brewery", "Specialty Drinks Spot", "Buffet", "Sharing Platters Spot", "Nyama Choma Spot",
  "Choma Base", "Street Food", "Group Dining Venue", "Services",
];

const AMENITY_OPTIONS = [
  "WiFi", "Parking", "Outdoor Seating", "Pet Friendly", "Wheelchair Accessible", "Card Payments", "Family Friendly", "Takeaway", "Reservations",
];

const RESERVATION_POLICY_OPTIONS = [
  { value: "RESERVATION_ONLY", label: "Reservations Only" },
  { value: "WALK_IN_ONLY", label: "Walk-Ins Only" },
  { value: "BOTH", label: "Reservations & Walk-Ins" },
];

const MAX_CATEGORIES_FALLBACK = 5;

export default function NewBusinessPage() {
  const { authed, businessId, openAuthModal, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [type, setType] = useState<"VENUE" | "EXPERIENCE_HOST">("VENUE");
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [neighborhood, setNeighborhood] = useState(LOCATIONS_BY_CITY[CITIES[0]][0]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [reservationPolicy, setReservationPolicy] = useState<"RESERVATION_ONLY" | "WALK_IN_ONLY" | "BOTH" | "">("BOTH");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [maxCategories, setMaxCategories] = useState(MAX_CATEGORIES_FALLBACK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.businesses
      .categories()
      .then((list) => list.length > 0 && setCategories(list))
      .catch(() => {
        // Fallback silently
      });
    // Admin-configurable cap (Val, Sep 2026: "cap at 5 for now but make
    // it configurable") — falls back to the hardcoded default above if
    // this can't be reached, same silent-fallback instinct as the
    // categories list fetch just above.
    api.businesses
      .maxCategories()
      .then((res) => setMaxCategories(res.maxCategories))
      .catch(() => {
        // Fallback silently
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
  }, [authed, businessId, openAuthModal, router]);

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

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCategories.length === 0) {
      setError("Please select at least one category.");
      return;
    }
    if (!description.trim()) {
      setError("A short description helps people know what to expect, please add one.");
      return;
    }
    if (budgetMin && budgetMax && parseFloat(budgetMin) > parseFloat(budgetMax)) {
      setError("Minimum budget must be less than or equal to maximum budget.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.businesses.create({
        type,
        name,
        categories: selectedCategories,
        description: description.trim(),
        callPhone: callPhone || undefined,
        whatsappPhone: whatsappPhone || undefined,
        email: email || undefined,
        address: address || undefined,
        website: website || undefined,
        city,
        neighborhood,
        amenities,
        reservationPolicy: reservationPolicy || undefined,
        budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
        budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      });
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

          {/* Categories - Multi-select */}
          <div>
            <span className="mb-2 block text-sm font-semibold text-warm-brown">Categories ({selectedCategories.length}/{maxCategories})</span>
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
                      : "border-border bg-surface text-text"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {selectedCategories.length === 0 && <p className="mt-1 text-xs text-error">Please select at least one category</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Neighborhood / Area">
              <Select
                value={neighborhood}
                onChange={setNeighborhood}
                options={LOCATIONS_BY_CITY[city].map((n) => ({ value: n, label: n }))}
              />
            </Field>
            <Field label="Reservation Policy">
              <Select
                value={reservationPolicy}
                onChange={(val) => setReservationPolicy(val as any)}
                options={[{ value: "", label: "Not specified" }, ...RESERVATION_POLICY_OPTIONS]}
              />
            </Field>
          </div>

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
            <Field label="Call Phone">
              <input value={callPhone} onChange={(e) => setCallPhone(e.target.value)} className={inputClass} placeholder="+254700000000" />
            </Field>
            <Field label="WhatsApp Phone">
              <input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className={inputClass} placeholder="+254700000000" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="hello@business.co.ke" />
            </Field>
            <Field label="Address">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="14 Wood Avenue, Kilimani" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Website (optional)">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="mybusiness.co.ke" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Budget Min (KES, optional)">
              <input
                type="number"
                min="0"
                step="100"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                className={inputClass}
                placeholder="e.g., 2000"
              />
            </Field>
            <Field label="Budget Max (KES, optional)">
              <input
                type="number"
                min="0"
                step="100"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                className={inputClass}
                placeholder="e.g., 5000"
              />
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
