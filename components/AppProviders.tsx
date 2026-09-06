"use client";

import { ToastProvider } from "./ToastContext";
import { AuthProvider } from "./AuthContext";
import { BookmarksProvider } from "./BookmarksContext";
import { AuthModal } from "./AuthModal";
import { MobileBottomNav } from "./MobileBottomNav";
import { VerificationBanner } from "./VerificationBanner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        {/* Needs useAuth() (only fetches the bookmark list once signed
            in), so it has to live inside AuthProvider too. */}
        <BookmarksProvider>
          {/* Above children/page content so it reads as a site-wide
              strip rather than something bolted onto one specific
              page's own header. */}
          <VerificationBanner />
          {children}
          <AuthModal />
          {/* Needs useAuth(), so it has to live inside AuthProvider — not
              back in layout.tsx alongside AppProviders, which would put it
              outside the context tree entirely. Renders nothing above the
              md breakpoint; see the component for why it's otherwise
              global (present on every page without touching each page
              file individually). */}
          <MobileBottomNav />
        </BookmarksProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
