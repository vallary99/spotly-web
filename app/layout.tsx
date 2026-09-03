import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

export const metadata: Metadata = {
  title: "Spotly | Discover Places, Activities & Events in Nairobi",
  description:
    "Discover Nairobi differently with Spotly. Find unique places, exciting activities, hidden gems and upcoming events, all in one place. Whether you're looking for somewhere to eat, something fun to do, or your next favourite spot, Spotly helps you discover what's around you.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
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
