"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/ToastContext";
import { api, ApiError } from "@/lib/api";
import { CITIES, LOCATIONS_BY_CITY } from "@/lib/locations";
import { geocodeAddress, detectCurrentCity } from "@/lib/location";
import { Select } from "@/components/Select";

// Leaflet touches `window` at import time, so it can never render
// during SSR — dynamically imported with ssr:false rather than a plain
// import, which would crash the server render entirely.
const LocationPickerModal = dynamic(() => import("@/components/LocationPickerModal").then((m) => m.LocationPickerModal), {
  ssr: false,
});

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
const COLLAPSED_CATEGORY_COUNT = 12;

const MADE_IN_KENYA_CATEGORIES = [
  { value: "FASHION", label: "Fashion", hint: "Clothing, shoes, bags and similar" },
  { value: "BEAUTY", label: "Beauty", hint: "Skincare, haircare, cosmetics, fragrances" },
  { value: "ART_CRAFTS", label: "Art & Crafts", hint: "Pottery, paintings, handmade and woven pieces, sculptures" },
  { value: "JEWELLERY_ACCESSORIES", label: "Jewellery & Accessories", hint: "Jewellery, watches, hair accessories, sunglasses" },
  { value: "GIFTS_LIFESTYLE", label: "Gifts & Lifestyle", hint: "Curated gift boxes, stationery, candles and more" },
];

export default function NewBusinessPage() {
  const { authed, user, businessId, openAuthModal, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [type, setType] = useState<"VENUE" | "EXPERIENCE_HOST" | "MADE_IN_KENYA">("VENUE");
  // Gates the actual Made in Kenya form behind an explanation + explicit
  // confirmation (Val, Sep 2026: "a clear description of what Made in
  // Kenya means, if they confirm that they understand then they are
  // given a different flow") — resets whenever they switch away from
  // this type, so picking it again always re-shows the explanation
  // rather than remembering a stale confirmation from earlier in the
  // same visit.
  const [mikUnderstood, setMikUnderstood] = useState(false);
  const [madeInKenyaCategory, setMadeInKenyaCategory] = useState("");
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Val, Sep 2026: "categories should be collapsible" — the full list
  // runs to 50+ entries, a lot to scroll through for something most
  // people only need to glance at a handful of.
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  // The map only ever renders inside the popup now — this just
  // controls whether that popup is open, not whether a location has
  // been set (that's latitude/longitude themselves).
  const [mapOpen, setMapOpen] = useState(false);

  // Fires on an explicit button press, not on blur. Always just a
  // starting point: they can still drag it or use "my location" if the
  // guess is off, which it sometimes will be — a lot of addresses here
  // are landmark-based ("Karen Landmark Building") rather than a clean
  // street+number, and free geocoding is honest about being
  // approximate for those.
  const handleShowMap = async () => {
    setGeocoding(true);
    try {
      const result = address.trim() ? await geocodeAddress(address) : null;
      if (result) {
        setLatitude(result.latitude);
        setLongitude(result.longitude);
      } else if (address.trim()) {
        // Genuinely no visible feedback before this — a failed lookup
        // and a successful-but-silent one looked identical, which made
        // this exact class of bug hard to tell apart from "working as
        // intended, just no match" (Val, Sep 2026).
        showToast("Couldn't find that address on the map. Drag the pin or use your current location instead.");
      }
    } finally {
      setGeocoding(false);
      setMapOpen(true); // open the popup either way, so they can place the pin manually if the lookup didn't land
    }
  };
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

  // Val, Sep 2026: "let them pick a city which should default to their
  // current location, and for this case, Nairobi." Best-effort and
  // silent — a denied permission or unresolvable location just leaves
  // the existing CITIES[0] (Nairobi) default in place, never blocks or
  // shows an error for something this incidental. Currently a no-op in
  // practice (CITIES has only one entry today) but resolves correctly
  // once more cities launch.
  useEffect(() => {
    detectCurrentCity().then((detected) => {
      if (detected && CITIES.includes(detected)) setCity(detected);
    });
  }, []);

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

    if (type === "MADE_IN_KENYA") {
      if (!madeInKenyaCategory) {
        setError("Please select a category.");
        return;
      }
      if (!description.trim()) {
        setError("A short description helps people know what you make, please add one.");
        return;
      }
    } else {
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
    }

    setBusy(true);
    setError(null);
    try {
      await api.businesses.create({
        type,
        name,
        // Made in Kenya has no general categories multi-select — its
        // one category lives in madeInKenyaCategory instead (Val, Sep
        // 2026: one category per business, not several). categories
        // still gets sent as an empty array rather than omitted, since
        // the backend DTO expects the field to exist.
        categories: type === "MADE_IN_KENYA" ? [] : selectedCategories,
        madeInKenyaCategory: type === "MADE_IN_KENYA" ? madeInKenyaCategory : undefined,
        description: description.trim(),
        callPhone: callPhone || undefined,
        whatsappPhone: whatsappPhone || undefined,
        email: email || undefined,
        address: address || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        website: website || undefined,
        city,
        // Never sent for Experience Host — see the field itself for why.
        neighborhood: type === "EXPERIENCE_HOST" ? undefined : neighborhood,
        amenities,
        reservationPolicy: type === "MADE_IN_KENYA" ? undefined : (reservationPolicy || undefined),
        budgetMin: type === "MADE_IN_KENYA" ? undefined : (budgetMin ? parseFloat(budgetMin) : undefined),
        budgetMax: type === "MADE_IN_KENYA" ? undefined : (budgetMax ? parseFloat(budgetMax) : undefined),
      });
      await refreshAuth();
      if (type === "MADE_IN_KENYA") {
        // Not live yet — no "is live" toast, no dashboard redirect with
        // upload prompts that don't apply until approved (Val, Sep
        // 2026: approval happens before anything else can happen).
        showToast("Application submitted. We'll email you once it's reviewed.");
        router.push("/business/new/submitted");
      } else {
        showToast(`${name} is live on Spotly!`);
        router.push("/dashboard");
      }
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

  if (user && !user.emailVerified) {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <i className="bi bi-envelope-exclamation mb-3 block text-4xl text-terracotta" />
          <h1 className="mb-2 text-2xl text-warm-brown">Verify your email first</h1>
          <p className="mb-6 text-sm text-warm-clay">
            We sent a verification link to <strong>{user.email}</strong> when you signed up. Confirm it before
            listing a business. Check your inbox (and spam folder).
          </p>
          <button
            onClick={async () => {
              try {
                await api.auth.resendVerification(user.email);
                showToast("Verification email sent. Check your inbox.");
              } catch (err) {
                showToast(err instanceof ApiError ? err.message : "Couldn't send that, try again.");
              }
            }}
            className="rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white"
          >
            Resend verification email
          </button>
        </div>
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
            <div className="flex gap-3 max-md:flex-col">
              <button
                type="button"
                onClick={() => { setType("VENUE"); setMikUnderstood(false); }}
                className={`flex-1 rounded-spotly border p-4 text-left transition ${
                  type === "VENUE" ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 font-semibold">Venue</div>
                <div className="text-xs text-warm-clay">A permanent, ongoing business, café, restaurant, salon.</div>
              </button>
              <button
                type="button"
                onClick={() => { setType("EXPERIENCE_HOST"); setMikUnderstood(false); }}
                className={`flex-1 rounded-spotly border p-4 text-left transition ${
                  type === "EXPERIENCE_HOST" ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 font-semibold">Experience Host</div>
                <div className="text-xs text-warm-clay">Publish one-time or recurring events, no fixed venue.</div>
              </button>
              <button
                type="button"
                onClick={() => { setType("MADE_IN_KENYA"); setMikUnderstood(false); }}
                className={`flex-1 rounded-spotly border p-4 text-left transition ${
                  type === "MADE_IN_KENYA" ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 font-semibold">Made in Kenya</div>
                <div className="text-xs text-warm-clay">Sell a catalogue of Kenyan-made products, reviewed before going live.</div>
              </button>
            </div>
          </div>

          {/* The explanation + confirmation gate — nothing else in the
              form renders until this is checked (Val, Sep 2026).
              Shortened and de-headlined (Val, Sep 2026 round 2) — the
              original long paragraph under a formal "What X means"
              title mostly repeated what the selection card above it
              already said, adding scroll depth for no real benefit;
              three short lines read faster and don't need a heading to
              feel legible. */}
          {type === "MADE_IN_KENYA" && !mikUnderstood && (
            <div className="rounded-spotly border border-terracotta bg-[rgba(199,101,58,0.06)] p-4">
              <p className="mb-3 text-sm text-text">
                🇰🇪 Made in Kenya is for products designed, crafted, produced or manufactured in Kenya.
              </p>
              <p className="mb-4 text-sm text-text">
                Showcase your products on Spotly and help more people discover and shop locally made products.
              </p>
              <label className="mb-1 flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={mikUnderstood} onChange={(e) => setMikUnderstood(e.target.checked)} className="mt-0.5" />
                <span>I confirm that my products are genuinely made, designed, crafted or manufactured in Kenya.</span>
              </label>
            </div>
          )}

          {(type !== "MADE_IN_KENYA" || mikUnderstood) && (
          <>
          {type === "MADE_IN_KENYA" ? (
            <>
              <Field label="Business name">
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your brand name" />
              </Field>

              <Field label="Description">
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder="What do you make, and what makes it special?"
                />
              </Field>

              <div>
                <span className="mb-2 block text-sm font-semibold text-warm-brown">Category</span>
                <div className="space-y-2">
                  {MADE_IN_KENYA_CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setMadeInKenyaCategory(c.value)}
                      className={`w-full rounded-spotly border p-3.5 text-left transition ${
                        madeInKenyaCategory === c.value ? "border-terracotta bg-[rgba(199,101,58,0.06)]" : "border-border bg-surface"
                      }`}
                    >
                      <div className="font-semibold">{c.label}</div>
                      <div className="text-xs text-warm-clay">{c.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="City">
                  <Select value={city} onChange={setCity} options={CITIES.map((c) => ({ value: c, label: c }))} />
                </Field>
                <Field label="Neighborhood / Area">
                  <Select
                    value={neighborhood}
                    onChange={setNeighborhood}
                    options={(LOCATIONS_BY_CITY[city] || []).map((n) => ({ value: n, label: n }))}
                  />
                </Field>
              </div>

              <Field label="Address">
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Street, building, area" />
              </Field>

              <Field label="Location on map">
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
              </Field>

              <Field label="Website (optional)">
                <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="mybrand.co.ke" />
              </Field>

              <div>
                <span className="mb-2 block text-sm font-semibold text-warm-brown">Amenities</span>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        amenities.includes(a) ? "border-terracotta bg-terracotta text-white" : "border-border bg-surface text-text"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
          <>
          <Field label="Business name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jiko Kilimani" />
          </Field>

          {/* Categories - Multi-select, collapsible (Val, Sep 2026) —
              collapsed by default to a handful, expanding to the full
              list on request. Anything already selected always stays
              visible even while collapsed, so picking a category
              buried further down the list never makes it disappear. */}
          <div>
            <span className="mb-2 block text-sm font-semibold text-warm-brown">Categories ({selectedCategories.length}/{maxCategories})</span>
            <div className="flex flex-wrap gap-2">
              {(categoriesExpanded
                ? categories
                : Array.from(new Set([...selectedCategories, ...categories.slice(0, COLLAPSED_CATEGORY_COUNT)]))
              ).map((cat) => (
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
            {categories.length > COLLAPSED_CATEGORY_COUNT && (
              <button
                type="button"
                onClick={() => setCategoriesExpanded((v) => !v)}
                className="mt-2 text-sm font-semibold text-terracotta"
              >
                {categoriesExpanded ? "Show fewer categories" : `Show all categories (${categories.length})`}
              </button>
            )}
            {selectedCategories.length === 0 && <p className="mt-1 text-xs text-error">Please select at least one category</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Experience Host has no fixed venue, so a specific
                neighborhood doesn't apply — their events could happen
                anywhere across the city (Val, Sep 2026). City instead,
                even though it's currently a single-option dropdown
                (Nairobi-only launch) — still the more correct field for
                this business type, and future-proof once more cities
                launch. Venue keeps neighborhood, since it does have one
                fixed, specific location. */}
            {type === "EXPERIENCE_HOST" ? (
              <Field label="City">
                <Select value={city} onChange={setCity} options={CITIES.map((c) => ({ value: c, label: c }))} />
              </Field>
            ) : (
              <Field label="Neighborhood / Area">
                <Select
                  value={neighborhood}
                  onChange={setNeighborhood}
                  options={LOCATIONS_BY_CITY[city].map((n) => ({ value: n, label: n }))}
                />
              </Field>
            )}
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
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
                placeholder="14 Wood Avenue, Kilimani"
              />
            </Field>
          </div>

          <Field label="Location on map">
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
          </Field>

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
          </>
          )}
          </>
          )}

          {(type !== "MADE_IN_KENYA" || mikUnderstood) && (
          <>
          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-terracotta py-3.5 text-sm font-semibold text-white transition hover:bg-[#b5572f] disabled:opacity-60"
          >
            {busy
              ? (type === "MADE_IN_KENYA" ? "Submitting…" : "Setting up your business…")
              : (type === "MADE_IN_KENYA" ? "Request Approval" : "List My Business")}
          </button>
          </>
          )}
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
