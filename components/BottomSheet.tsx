"use client";

import { useEffect } from "react";

// Generic bottom-sheet shell: dark backdrop + a panel that slides up
// from the bottom edge, the standard mobile pattern for "a small,
// focused task without leaving the current screen" — used here for
// mobile search and the mobile profile menu, both of which are simple
// dropdowns on desktop but deserve a proper touch-first treatment on
// mobile rather than a shrunk-down dropdown.
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end bg-[rgba(20,15,12,0.5)] md:hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-[28px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(67,53,47,0.25)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <span className="mx-auto h-1 w-10 rounded-full bg-border absolute left-1/2 top-2 -translate-x-1/2" />
          {title && <h2 className="text-base font-semibold text-warm-brown">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-warm-clay transition hover:bg-border"
            aria-label="Close"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
