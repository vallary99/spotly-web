"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SectionHeader } from "@/components/SectionHeader";
import { BusinessCard } from "@/components/BusinessCard";
import { BusinessCardRowSkeleton } from "@/components/Skeleton";
import { ExperienceCard } from "@/components/ExperienceCard";
import { Select } from "@/components/Select";
import { useToast } from "@/components/ToastContext";
import { api, type HomeResponse, type Business } from "@/lib/api";
import { HERO_IMAGES } from "@/lib/placeholders";
import { computeOpenStatus } from "@/lib/hours";
import { CITIES, LOCATIONS_BY_CITY } from "@/lib/locations";
import { getCurrentPosition, distanceKm } from "@/lib/location";

// MVP quick filters (PRD Section 6 / BRD FR-2.2), grouped thematically
// rather than one-pill-per-category so the row stays intuitive and short
// even as the category list itself grows (see business.service.ts's
// SEED_CATEGORIES, now 50+ entries). Each `categories` array becomes an
// OR match server-side (?categories=a,b,c), e.g. "Nightlife" catches a
// business categorized Nightclub, Karaoke Bar, Rooftop Lounge, etc, not
// just an exact "Nightlife" category that doesn't actually exist.
//
// "Nearby" sorts the current rails by real distance from the user's
// browser-reported location (OpenStreetMap-based location capture at
// onboarding/dashboard + the free Geolocation API here — no paid map
// provider needed for this specific filter, Val, Sep 2026). Businesses
// with no coordinates set are excluded rather than guessed at; see
// sortByNearby below. "Trending" was removed
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
// The category-group quick filters (Restaurants & Cafés, Adrenaline
// Boost, etc.) used to be hardcoded here. They're now admin-managed
// (Category/QuickFilterGroup tables, editable from spotly-admin's
// Configuration page) and come from GET /home's `quickFilters` field
// instead, so a mapping change there shows up live without a frontend
// deploy. See `data?.quickFilters` below.

function filterOpenNow(list: Business[]): Business[] {
  return list.filter((b) => computeOpenStatus(b.hours)?.open === true);
}

// Businesses with no coordinates set are excluded rather than guessed
// at — no "assume city center" fallback, since a wrong guess here
// actively undermines the one thing this filter promises (Val, Sep
// 2026). No radius cutoff either (there was one; removed) — with only
// a handful of businesses having set a real location so far, a fixed
// cutoff could easily leave just one (or zero) results, which reads as
// "broken" rather than "sorted." Nearest-to-furthest, everyone with
// coordinates included, is what actually stays useful while adoption
// of the location feature itself is still growing.
function sortByNearby(list: Business[], userLocation: { latitude: number; longitude: number }): Business[] {
  return list
    .filter((b): b is Business & { latitude: number; longitude: number } => b.latitude != null && b.longitude != null)
    .map((b) => ({ business: b, km: distanceKm(userLocation, { latitude: b.latitude, longitude: b.longitude }) }))
    .sort((a, b) => a.km - b.km)
    .map((entry) => entry.business);
}

export default function HomePage() {
  const { showToast } = useToast();
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // activeCategory: single-select among the admin-managed quick filter
  // groups from GET /home's `quickFilters` (null = no category filter).
  // activeMeta: independent toggles for Nearby/Open Now/Hidden Gems — a Set so any combination of them can
  // be on at once, and together with activeCategory, per "can be used
  // concurrently."
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<Set<string>>(new Set());
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroSearch, setHeroSearch] = useState("");
  const [heroResults, setHeroResults] = useState<{
    businesses: { id: string; name: string; categories: string[] }[];
    experiences: { id: string; title: string; startsAt: string }[];
  } | null>(null);
  const [city, setCity] = useState(CITIES[0]);
  const [neighborhood, setNeighborhood] = useState(""); // "" = all areas within the city
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locatingNearby, setLocatingNearby] = useState(false);

  const toggleMeta = (key: string) => {
    if (key === "nearby" && !activeMeta.has("nearby") && !userLocation) {
      // Turning Nearby ON for the first time — get the browser's
      // location before actually enabling the toggle, rather than
      // enabling it and then having nothing to sort by. If the user
      // denies/it fails, the toggle just never turns on rather than
      // turning on and silently doing nothing (the exact non-functional
      // state this replaced, Val, Sep 2026).
      setLocatingNearby(true);
      getCurrentPosition()
        .then((pos) => {
          setUserLocation(pos);
          setActiveMeta((prev) => new Set(prev).add("nearby"));
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : "Couldn't get your location.");
        })
        .finally(() => setLocatingNearby(false));
      return;
    }
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
    const filterDef = data?.quickFilters.find((f) => f.id === activeCategory);
    const openNowOn = activeMeta.has("openNow");
    const nearbyOn = activeMeta.has("nearby") && userLocation != null;
    api
      .home({
        city,
        ...(neighborhood ? { neighborhood } : {}),
        ...(filterDef?.categories ? { categories: filterDef.categories.join(",") } : {}),
        ...(activeMeta.has("hiddenGems") ? { isHiddenGem: true } : {}),
      })
      .then((res) => {
        let trendingThisWeek = res.rails.trendingThisWeek;
        let popularNearYou = res.rails.popularNearYou;
        if (openNowOn) {
          trendingThisWeek = filterOpenNow(trendingThisWeek);
          popularNearYou = filterOpenNow(popularNearYou);
        }
        if (nearbyOn) {
          trendingThisWeek = sortByNearby(trendingThisWeek, userLocation!);
          popularNearYou = sortByNearby(popularNearYou, userLocation!);
        }
        if (openNowOn || nearbyOn) {
          setData({ ...res, rails: { ...res.rails, trendingThisWeek, popularNearYou } });
        } else {
          setData(res);
        }
      })
      .finally(() => setLoading(false));
  }, [city, neighborhood, activeCategory, activeMeta, userLocation]);

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
              The best cafés, nights out, and hidden gems in Nairobi, found by the people who live here, not an algorithm guessing.
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
                  disabled={f.key === "nearby" && locatingNearby}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition disabled:opacity-70 ${
                    activeMeta.has(f.key)
                      ? "border-olive bg-olive text-white"
                      : "border-white/40 bg-white/12 text-white hover:bg-white/20"
                  }`}
                  aria-pressed={activeMeta.has(f.key)}
                >
                  <i className={`bi ${f.key === "nearby" && locatingNearby ? "bi-arrow-repeat" : f.icon}`} />
                  {f.key === "nearby" && locatingNearby ? "Finding you…" : f.label}
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
                    <span className="text-xs text-warm-clay">{b.categories?.[0]}</span>
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
        {(data?.quickFilters ?? []).map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveCategory((prev) => (prev === f.id ? null : f.id))}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              activeCategory === f.id
                ? "border-terracotta bg-terracotta text-white"
                : "border-border bg-surface text-text hover:border-terracotta hover:bg-terracotta hover:text-white"
            }`}
          >
            {f.icon && <i className={`bi ${f.icon}`} />}
            {f.label}
          </button>
        ))}
      </div>

      <div id="rails" />

      {loading ? (
        <div className="mt-9">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={i > 0 ? "mt-9" : ""}>
              <div className="mb-4 px-11 max-md:px-[18px]">
                <div className="h-6 w-48 animate-pulse rounded-lg bg-border" />
              </div>
              <BusinessCardRowSkeleton />
            </div>
          ))}
        </div>
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
