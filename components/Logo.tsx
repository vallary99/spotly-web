import Image from "next/image";
import Link from "next/link";

// Real intrinsic aspect ratio of the trimmed lockup (mark + wordmark
// stacked), so the logo never stretches or distorts, the brand doc
// explicitly prohibits that.
const ASPECT_RATIO = 449 / 187;

// The logo is always rendered as the real asset (never a text fallback),
// so it stays visible and on-brand wherever it's used, nav, footer, and
// the auth modal.
//
// Renders two correctly-sized images and toggles which is visible via
// CSS, rather than one image resized responsively — the width/height
// props below set a genuinely fixed intrinsic size each, and (per the
// comment further down) the hydration-safe inline style always wins
// over any Tailwind height class applied from outside, so a single
// <Image> can't actually change size at different breakpoints this way.
export function Logo({ height = 52, mobileHeight = 34 }: { height?: number; mobileHeight?: number }) {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Spotly home">
      <Image
        src="/spotly-logo.png"
        alt="Spotly, Find It. Book It. Spotly."
        width={Math.round(mobileHeight * ASPECT_RATIO)}
        height={mobileHeight}
        priority
        className="block md:hidden"
        style={{ width: "auto", height: "auto" }}
      />
      <Image
        src="/spotly-logo.png"
        alt="Spotly, Find It. Book It. Spotly."
        width={Math.round(height * ASPECT_RATIO)}
        height={height}
        priority
        className="hidden md:block"
        // Tailwind's preflight base styles apply `height: auto` to every
        // <img> globally, which on its own conflicts with the fixed
        // `height` prop above (Next.js then sees a stylesheet forcing one
        // dimension while the other is left to the HTML attribute, and
        // warns about it). Setting both to "auto" here overrides that
        // stylesheet rule for just this image and removes the mismatch —
        // the actual pixel size still comes from the width/height props,
        // which set the underlying intrinsic attributes.
        style={{ width: "auto", height: "auto" }}
      />
    </Link>
  );
}
