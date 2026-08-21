import Link from "next/link";
import { Logo } from "./Logo";

// Hidden on mobile entirely — the bottom nav already covers primary
// navigation there, and a footer competing for space above a fixed
// bottom nav on an already-short screen adds little. Desktop keeps it
// unchanged.
export function Footer() {
  return (
    <footer className="mt-auto hidden px-11 pb-2.5 pt-12 text-center text-sm text-warm-clay md:block">
      <div className="mb-3 flex justify-center">
        <Logo height={44} />
      </div>
      Discover your city, one spot at a time.
      <br />
      &copy; {new Date().getFullYear()} Spotly
      <div className="mt-3 flex justify-center gap-4 text-xs">
        <Link href="/privacy" className="hover:text-terracotta">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-terracotta">Terms of Service</Link>
        <a href="mailto:hello@spotly.co.ke" className="hover:text-terracotta">hello@spotly.co.ke</a>
      </div>
    </footer>
  );
}
