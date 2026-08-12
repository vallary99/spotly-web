"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SectionHeader } from "@/components/SectionHeader";
import { BusinessCard } from "@/components/BusinessCard";
import { ExperienceCard } from "@/components/ExperienceCard";
import { Select } from "@/components/Select";
import { api, type HomeResponse, type Business } from "@/lib/api";
import { HERO_IMAGES } from "@/lib/placeholders";
import { computeOpenStatus } from "@/lib/hours";
import { CITIES, LOCATIONS_BY_CITY } from "@/lib/locations";

// MVP quick filters (PRD Section 6 / BRD FR-2.2), grouped thematically
// rather than one-pill-per-category so the row stays intuitive and short
// even as the category list itself grows (see business.service.ts's
// SEED_CATEGORIES, now 50+ entries). Each `categories` array becomes an
// OR match server-side (?categories=a,b,c), e.g. "Nightlife" catches a
// business categorized Nightclub, Karaoke Bar, Rooftop Lounge, etc, not
// just an exact "Nightlife" category that doesn't actually exist.
//
// "Nearby" doesn't map to a server-side filter, it needs real
// geolocation (deferred, no mapping provider in MVP per BRD Section 11),
// so it just shows the default unfiltered view. "Trending" was removed
// from this row entirely, the "Trending This Week" rail below already
// covers that, a duplicate quick-filter pill for the same thing was
// redundant. "Open Now" filters client-side over whatever the current
// query already returned, using the same hours-based open/closed logic
// as the business cards
// themselves.
// Meta filters — independent toggles, not tied to a category, and
// combine with EACH OTHER and with whichever category group below is
// selected (rather than replacing it) per "can be used concurrently."
// Shown on their own row above the category groups.
const META_FILTERS = [
  { key: "nearby", label: "Nearby", icon: "bi-geo" },
  { key: "openNow", label: "Open Now", icon: "bi-clock" },
  { key: "hiddenGems", label: "Hidden Gems ✨", icon: "bi-gem" },
] as const;

// The 16 category groups, in the given reference order. Each maps to a
// set of real business categories (see business.service.ts's
// SEED_CATEGORIES, kept in sync with this same grouping) rather than
// one exact category, matching how e.g. "Restaurants & Cafés" should
// catch a business categorized as any of Restaurant, Cafe, Bakery, etc.
// "Hidden Gems" from the reference list isn't here — it's a quality tag
// (Business.isHiddenGem), not a business type, so it lives in
// META_FILTERS above instead, on its own row, exactly as requested.
// Ordered most to least popular for a Nairobi audience (food and going-out
// categories lead, niche hobby/craft categories trail).
const QUICK_FILTERS = [
  { label: "Restaurants & Cafés", icon: "bi-egg-fried", categories: ["Restaurant", "Cafe", "Bakery", "Diner", "Specialty Food Spot"] },
  { label: "Platters & Buffets", icon: "bi-basket2", categories: ["Buffet", "Sharing Platters Spot", "Nyama Choma Spot", "Choma Base", "Street Food", "Group Dining Venue"] },
  { label: "Drinks & Cocktails", icon: "bi-cup-straw", categories: ["Cocktail Bar", "Wine Bar", "Brewery", "Specialty Drinks Spot"] },
  { label: "Nightlife", icon: "bi-moon-stars", categories: ["Nightclub", "Lounge", "Late-Night Venue"] },
  { label: "Beauty & Wellness", icon: "bi-flower2", categories: ["Spa", "Massage", "Fitness", "Yoga Studio", "Salon", "Wellness Centre"] },
  { label: "Shopping", icon: "bi-bag", categories: ["Antique Store", "Farmers Market", "Thrift Store", "Boutique"] },
  { label: "Wildlife & Nature", icon: "bi-tree", categories: ["Scenic View Point", "Picnic Spot", "Hiking Trail", "Camping Site", "Garden", "Park"] },
  { label: "Live Music & Karaoke", icon: "bi-mic", categories: ["Live Music Venue", "Acoustic Session Venue", "Karaoke Bar"] },
  { label: "Adrenaline Boost", icon: "bi-lightning-charge", categories: ["Go-Karting", "Paintball", "Ziplining", "Climbing Gym", "Roller Skating Rink", "Ice Skating Rink"] },
  { label: "Gaming", icon: "bi-controller", categories: ["Arcade", "VR Gaming", "Gaming Lounge", "Esports Venue", "Simulator Experience"] },
  { label: "Sports", icon: "bi-trophy", categories: ["Sports Ground", "Training Facility", "Sports Court", "Swimming Pool"] },
  { label: "Workshops & Classes", icon: "bi-mortarboard", categories: ["Cooking Class", "Educational Workshop", "Demonstration Experience"] },
  { label: "Dance", icon: "bi-music-note-beamed", categories: ["Dance Class", "Dance Studio", "Social Dancing Venue", "Dance Performance Venue"] },
  { label: "Culture & Heritage", icon: "bi-bank", categories: ["Museum", "Cultural Centre", "Heritage Site", "Cultural Experience"] },
  { label: "Art & Galleries", icon: "bi-easel", categories: ["Art Gallery", "Art Studio", "Art Installation", "Exhibition Space"] },
  { label: "Creative Boost", icon: "bi-palette", categories: ["Pottery Studio", "Painting Studio", "Cake Decorating", "Candle Making", "Crafts Studio"] },
];

function filterOpenNow(list: Business[]): Business[] {
  return list.filter((b) => computeOpenStatus(b.hours)?.open === true);
}

export default function HomePage() {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // activeCategory: single-select among the 16 QUICK_FILTERS groups
  // (null = no category filter). activeMeta: independent toggles for
  // Nearby/Open Now/Hidden Gems — a Set so any combination of them can
  // be on at once, and together with activeCategory, per "can be used
  // concurrently."
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<Set<string>>(new Set());
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroSearch, setHeroSearch] = useState("");
  const [heroResults, setHeroResults] = useState<{
    businesses: { id: string; name: string; category: string }[];
    experiences: { id: string; title: string }[];
  } | null>(null);
  const [city, setCity] = useState(CITIES[0]);
  const [neighborhood, setNeighborhood] = useState(""); // "" = all areas within the city

  const toggleMeta = (key: string) => {
    setActiveMeta((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (heroSearch.trim().length < 2) {
      setHeroResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.search(heroSearch).then(setHeroResults).catch(() => setHeroResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [heroSearch]);

  useEffect(() => {
    setLoading(true);
    const filterDef = QUICK_FILTERS.find((f) => f.label === activeCategory);
    const openNowOn = activeMeta.has("openNow");
    api
      .home({
        city,
        ...(neighborhood ? { neighborhood } : {}),
        ...(filterDef?.categories ? { categories: filterDef.categories.join(",") } : {}),
        ...(activeMeta.has("hiddenGems") ? { isHiddenGem: true } : {}),
      })
      .then((res) => {
        if (openNowOn) {
          setData({
            ...res,
            rails: {
              ...res.rails,
              trendingThisWeek: filterOpenNow(res.rails.trendingThisWeek),
              popularNearYou: filterOpenNow(res.rails.popularNearYou),
            },
          });
        } else {
          setData(res);
        }
      })
      .finally(() => setLoading(false));
  }, [city, neighborhood, activeCategory, activeMeta]);

  return (
    <>
      <Navbar />

      {/* HERO — location row up top (auto-filters, no search button
          needed since there's nothing to submit), tagline, then the
          Nearby/Open Now/Hidden Gems meta-filter row where "Explore
          Nearby" used to be. No search input and no "List Your
          Business"/"Dashboard" button here anymore, both already live in
          the nav (desktop top bar, mobile bottom nav), so this was pure
          duplication. */}
      <section className="relative m-5 mt-5 min-h-[560px] overflow-hidden rounded-[28px] max-md:m-2.5 max-md:min-h-[520px]">
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1100ms]"
            style={{ backgroundImage: `url('${src}')`, opacity: i === heroIdx ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(67,53,47,0.35)] via-[rgba(67,53,47,0.15)] to-[rgba(67,53,47,0.78)]" />

        <div className="relative z-[2] flex min-h-[560px] w-full flex-col p-11 max-md:min-h-[520px] max-md:p-5">
          {/* MOBILE ONLY — location dropdowns at the top of the hero, no
              search here (mobile search lives in the bottom nav's sheet
              instead). Desktop's equivalent is the floating white search
              panel below, at the hero's bottom edge — kept as two
              separate blocks since they're different styles/positions
              per breakpoint, not just a resize of the same one. */}
          <div className="flex flex-wrap gap-2.5 md:hidden">
            <Select
              value={city}
              onChange={(newCity) => {
                setCity(newCity);
                setNeighborhood(""); // reset area when switching city, the two are dependent
              }}
              options={CITIES.map((c) => ({ value: c, label: c }))}
              className="w-[150px]"
              variant="onDark"
            />
            <Select
              value={neighborhood}
              onChange={setNeighborhood}
              options={[{ value: "", label: "All Areas" }, ...LOCATIONS_BY_CITY[city].map((n) => ({ value: n, label: n }))]}
              className="w-[150px]"
              variant="onDark"
            />
          </div>

          <div className="flex flex-1 flex-col justify-end pt-6 text-white">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-white/16 px-3.5 py-1.5 text-xs backdrop-blur-sm">
              <i className="bi bi-stars" /> Nairobi&apos;s first 200 businesses
            </span>
            <h1 className="mb-3.5 max-w-xl text-[2.9rem] font-semibold leading-[1.15] max-md:text-3xl">
              Discover What&apos;s Happening Nearby
            </h1>
            <p className="mb-7 max-w-lg text-lg opacity-92 max-md:mb-5 max-md:text-base">
              The best cafés, nights out, and hidden gems in Nairobi — found by the people who live here, not an algorithm guessing.
            </p>

            {/* Nearby / Open Now / Hidden Gems — where "Explore Nearby"
                used to be. Contained with matching horizontal padding to
                the hero's own p-11/p-5, so pills never run past the
                hero's rounded corners; scrolls horizontally if they
                don't all fit rather than wrapping, since wrapping here
                would push the hero's own height around based on filter
                state, which reads as jumpy for a hero specifically (the
                categories row below, outside the hero, still gets the
                wrap-on-desktop treatment discussed earlier — this row is
                deliberately scroll-only at every size, it's a much
                shorter list of 3). */}
            <div className="h-scroll -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
              {META_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => toggleMeta(f.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition ${
                    activeMeta.has(f.key)
                      ? "border-olive bg-olive text-white"
                      : "border-white/40 bg-white/12 text-white hover:bg-white/20"
                  }`}
                  aria-pressed={activeMeta.has(f.key)}
                >
                  <i className={`bi ${f.icon}`} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute right-7 top-7 z-[3] flex gap-2 max-md:hidden">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIdx(i)}
              className={`h-2 rounded-full transition-all ${i === heroIdx ? "w-[22px] bg-white" : "w-2 bg-white/45"}`}
              aria-label={`Hero slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* DESKTOP ONLY — floating white search panel at the hero's bottom
          edge, overlapping it, matching the original design. No search
          button: selecting a location filters immediately, there's
          nothing to submit. Mobile keeps its own top-of-hero dropdowns
          above instead, unchanged. */}
      <div className="relative z-[5] mx-11 -mt-[42px] mb-1 hidden rounded-spotly border border-border bg-surface p-[18px] shadow-[0_18px_40px_rgba(67,53,47,0.14)] md:block">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <div className="flex items-center gap-3 rounded-full border border-border bg-cream px-[18px] py-2.5">
              <i className="bi bi-search text-warm-clay" />
              <input
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                placeholder="Search restaurants, coffee, experiences…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            {heroResults && (heroResults.businesses.length > 0 || heroResults.experiences.length > 0) && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_40px_rgba(67,53,47,0.2)]">
                {heroResults.businesses.map((b) => (
                  <Link
                    key={b.id}
                    href={`/businesses/${b.id}`}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm text-text hover:bg-cream"
                  >
                    <i className="bi bi-shop text-warm-clay" />
                    <span className="flex-1">{b.name}</span>
                    <span className="text-xs text-warm-clay">{b.category}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Select
            value={city}
            onChange={(newCity) => {
              setCity(newCity);
              setNeighborhood(""); // reset area when switching city, the two are dependent
            }}
            options={CITIES.map((c) => ({ value: c, label: c }))}
            className="w-[150px]"
          />
          <Select
            value={neighborhood}
            onChange={setNeighborhood}
            options={[{ value: "", label: "All Areas" }, ...LOCATIONS_BY_CITY[city].map((n) => ({ value: n, label: n }))]}
            className="w-[150px]"
          />
        </div>
      </div>

      {/* CATEGORY FILTERS ROW — the only quick-filter row left outside
          the hero now. The 16 groups, single-select (clicking one
          replaces the previous selection, clicking the active one again
          clears it back to "all categories"). Wraps on desktop/tablet,
          scrolls horizontally on mobile — see earlier discussion. */}
      {(activeCategory || activeMeta.size > 0 || neighborhood) && (
        <div className="flex justify-end px-11 pt-[18px] max-md:px-[18px]">
          <button
            onClick={() => {
              setActiveCategory(null);
              setActiveMeta(new Set());
              setNeighborhood("");
            }}
            className="flex items-center gap-1.5 rounded-full bg-warm-brown px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <i className="bi bi-x-lg text-[0.65rem]" /> Clear filters
          </button>
        </div>
      )}
      <div
        className={`h-scroll flex flex-nowrap gap-2.5 overflow-x-auto px-11 pb-1 max-md:px-[18px] md:flex-wrap md:overflow-visible ${
          activeCategory || activeMeta.size > 0 || neighborhood ? "pt-2.5" : "pt-[26px]"
        }`}
      >
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setActiveCategory((prev) => (prev === f.label ? null : f.label))}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              activeCategory === f.label
                ? "border-terracotta bg-terracotta text-white"
                : "border-border bg-surface text-text hover:border-terracotta hover:bg-terracotta hover:text-white"
            }`}
          >
            <i className={`bi ${f.icon}`} />
            {f.label}
          </button>
        ))}
      </div>

      <div id="rails" />

      {loading ? (
        <div className="px-11 py-16 text-center text-warm-clay max-md:px-[18px]">Loading Nairobi&apos;s best spots…</div>
      ) : (
        <>
          {/* TRENDING */}
          <div className="px-11 pt-[38px] max-md:px-[18px]">
            <SectionHeader title="Trending This Week" />
            {data && data.rails.trendingThisWeek.length > 0 ? (
              <div className="h-scroll flex gap-[18px] overflow-x-auto pb-3.5">
                {data.rails.trendingThisWeek.map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
              </div>
            ) : (
              <EmptyRail text={activeMeta.has("openNow") ? "Nothing matching this filter is open right now." : "Businesses will show up here as they join Spotly this week."} />
            )}
          </div>

          {/* POPULAR NEAR YOU */}
          <div className="px-11 pt-[38px] max-md:px-[18px]">
            <SectionHeader title="Popular Near You" />
            {data && data.rails.popularNearYou.length > 0 ? (
              <div className="h-scroll flex gap-[18px] overflow-x-auto pb-3.5">
                {data.rails.popularNearYou.map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
              </div>
            ) : (
              <EmptyRail text={activeMeta.has("openNow") ? "Nothing matching this filter is open right now." : "Save a few places and we'll start surfacing what's popular nearby."} />
            )}
          </div>

          {/* UPCOMING EXPERIENCES */}
          <div className="px-11 pt-[38px] max-md:px-[18px]">
            <SectionHeader title="Upcoming Experiences" />
            {data && data.rails.upcomingExperiences.length > 0 ? (
              <div className="h-scroll flex gap-[18px] overflow-x-auto pb-3.5">
                {data.rails.upcomingExperiences.map((e) => (
                  <ExperienceCard key={e.id} experience={e} />
                ))}
              </div>
            ) : (
              <EmptyRail text="No experiences hosted yet, check back soon." />
            )}
          </div>
        </>
      )}

      <div className="h-10" />
      <Footer />
    </>
  );
}

function EmptyRail({ text }: { text: string }) {
  return <p className="rounded-spotly border border-dashed border-border bg-surface/50 p-6 text-sm text-warm-clay">{text}</p>;
}
