import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

// Real production domain — required for metadataBase so relative OG
// image/canonical URLs (used throughout the app, e.g. the business
// detail page's generateMetadata) resolve to real, absolute ones
// instead of silently staying relative and being ignored by
// crawlers/link-preview bots.
const SITE_URL = "https://spotly.co.ke";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // `default` is what the homepage (and any page that doesn't set its
  // own title) uses; `template` is what every OTHER page's title gets
  // wrapped in — a business page setting title: business.name renders
  // as "<Business Name> | Spotly" without that page needing to know
  // the suffix itself.
  title: {
    default: "Spotly Kenya | Discover Places, Activities & Events",
    template: "%s | Spotly",
  },
  description:
    "Discover Nairobi differently with Spotly. Find unique places, exciting activities, hidden gems and upcoming events, all in one place. Whether you're looking for somewhere to eat, something fun to do, or your next favourite spot, Spotly helps you discover what's around you.",
  keywords: ["Nairobi", "things to do in Nairobi", "events in Nairobi", "restaurants Nairobi", "Nairobi experiences", "discover Nairobi", "Spotly"],
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_KE",
    siteName: "Spotly",
    url: SITE_URL,
    title: "Spotly — Find It. Book It. Spotly.",
    description:
      "Discover Nairobi's best businesses, hidden gems and experiences, browsed and saved and returned to.",
    images: [{ url: "/spotly-logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotly — Find It. Book It. Spotly.",
    description:
      "Discover Nairobi's best businesses, hidden gems and experiences, browsed and saved and returned to.",
    images: ["/spotly-logo.png"],
  },
  // Google Search Console: if you use the "HTML tag" verification
  // method instead of the file-upload one, the code goes here as
  // verification: { google: "the-code-they-gave-you" } — see the
  // conversation this shipped from for why the file-upload method
  // (dropping their file straight into /public) is what's actually
  // wired up right now instead.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Organization/WebSite structured data — explicit, machine-readable
  // facts about what Spotly actually is, rather than leaving Google to
  // infer it purely from crawled page text (Val, Sep 2026: a search for
  // "spotly.co.ke" wasn't confidently recognizing it as a real,
  // specific platform yet). This alone doesn't guarantee anything about
  // ranking, but it's the standard, correct way to hand a search engine
  // this information directly instead of hoping it's inferred right.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Spotly",
    alternateName: "Spotly Kenya",
    url: SITE_URL,
    description:
      "Discover Nairobi's best businesses, hidden gems and experiences, browsed and saved and returned to.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {/* Cinzel + Inter, loaded the same way as the original prototypes
            (plain <link>, not next/font) so this works identically
            regardless of network restrictions in any given environment. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Bootstrap Icons, approved icon set per Brand Identity Document,
            used independently of any CSS framework choice. */}
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.11.3/font/bootstrap-icons.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-cream text-text pb-16 md:pb-0">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
