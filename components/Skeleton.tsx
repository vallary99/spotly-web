// Reusable skeleton loading placeholders (NFR-2: "Loading states shall
// use skeleton placeholders rather than spinners"). Kept as small,
// composable pieces rather than one big per-page component, since the
// pages that need them (homepage rails, business card grids, the
// business detail page, the dashboard) all shape their content
// differently.
import type { CSSProperties } from "react";

function Block({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded-lg bg-border ${className}`} style={style} />;
}

// Matches BusinessCard's dimensions (w-[268px], 170px photo) so the
// swap from skeleton to real card doesn't jump the layout.
export function BusinessCardSkeleton() {
  return (
    <div className="w-[268px] shrink-0 overflow-hidden rounded-spotly border border-border bg-surface">
      <Block className="h-[170px] rounded-none" />
      <div className="space-y-2 p-4">
        <Block className="h-4 w-3/4" />
        <Block className="h-3 w-1/2" />
        <Block className="h-3 w-2/5" />
      </div>
    </div>
  );
}

export function BusinessCardRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden px-11 max-md:px-4">
      {Array.from({ length: count }).map((_, i) => (
        <BusinessCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Homepage: hero placeholder + a couple of skeleton rails, roughly
// matching the real layout (SectionHeader + horizontal card row) so
// the page doesn't visibly reflow once data arrives.
export function HomeSkeleton() {
  return (
    <div className="py-6">
      <div className="px-11 max-md:px-4">
        <Block className="h-[280px] w-full rounded-spotly" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mt-9">
          <div className="mb-4 px-11 max-md:px-4">
            <Block className="h-6 w-48" />
          </div>
          <BusinessCardRowSkeleton />
        </div>
      ))}
    </div>
  );
}

// Business detail page: gallery + title/meta + a two-column body, same
// rough proportions as the real page.
export function BusinessDetailSkeleton() {
  return (
    <div className="px-11 pt-4 max-md:px-4">
      <Block className="h-[360px] w-full rounded-spotly" />
      <div className="mt-6 space-y-3">
        <Block className="h-8 w-64" />
        <Block className="h-4 w-40" />
        <div className="flex gap-2.5">
          <Block className="h-9 w-28 rounded-full" />
          <Block className="h-9 w-28 rounded-full" />
          <Block className="h-9 w-28 rounded-full" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Block className="h-4 w-full" />
          <Block className="h-4 w-full" />
          <Block className="h-4 w-2/3" />
        </div>
        <Block className="h-40 w-full rounded-spotly" />
      </div>
    </div>
  );
}

// Dashboard (Business Owner Surface): profile card + a row of stat
// tiles, matching the real screen's rough shape.
// Dashboard: rebuilt to match the current two-tab layout (Val, Sep
// 2026 — the old version predated the Profile/Gallery split and the
// gallery's Pinterest-style masonry grid entirely, so it showed a
// generic shape that matched neither tab). Since Gallery is the
// default tab a returning owner lands on, this skeleton mimics ITS
// shape specifically — small tile blocks of varying height, same as
// the real masonry grid — rather than a generic placeholder that
// doesn't resemble what's about to actually render.
export function DashboardSkeleton() {
  // Varying heights so the placeholder itself has the same uneven,
  // masonry look as real photos/videos do — a uniform grid of
  // identical boxes would look like a different, more rigid layout
  // than what's coming.
  const tileHeights = [140, 190, 160, 210, 150, 180, 130, 200, 170, 155];
  return (
    <div className="px-11 py-8 max-md:px-4">
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4 max-md:grid-cols-2">
        <Block className="h-20 rounded-spotly" />
        <Block className="h-20 rounded-spotly" />
        <Block className="h-20 rounded-spotly max-md:col-span-2" />
      </div>

      {/* Tab bar */}
      <Block className="mb-6 h-11 w-full max-w-xs rounded-full" />

      {/* Gallery grid — matches DashboardGallery's own columns-3/4/5
          breakpoints closely enough that the swap from skeleton to
          real content doesn't visibly reflow. */}
      <div className="columns-3 gap-1.5 sm:columns-4 md:columns-5">
        {tileHeights.map((h, i) => (
          <Block key={i} className="mb-1.5 w-full rounded-lg" style={{ height: h }} />
        ))}
      </div>
    </div>
  );
}

// Saved page: a simple stacked-card list.
export function SavedSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-11 py-8 max-md:px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-spotly border border-border bg-surface p-3">
          <Block className="h-16 w-16 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Block className="h-4 w-1/2" />
            <Block className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
