// Reusable skeleton loading placeholders (NFR-2: "Loading states shall
// use skeleton placeholders rather than spinners"). Kept as small,
// composable pieces rather than one big per-page component, since the
// pages that need them (homepage rails, business card grids, the
// business detail page, the dashboard) all shape their content
// differently.

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-border ${className}`} />;
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
export function DashboardSkeleton() {
  return (
    <div className="px-11 py-8 max-md:px-4">
      <div className="mb-6 flex items-center gap-4">
        <Block className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Block className="h-5 w-56" />
          <Block className="h-3 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-20 rounded-spotly" />
        ))}
      </div>
      <div className="mt-8 space-y-3">
        <Block className="h-40 w-full rounded-spotly" />
        <Block className="h-40 w-full rounded-spotly" />
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
