"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthContext";

interface BookmarkTarget {
  businessId?: string;
  experienceId?: string;
}

interface BookmarksContextValue {
  // True once the initial fetch (or the "not signed in, nothing to
  // fetch" case) has settled — lets a card avoid a flash of "not
  // saved" before the real list has loaded.
  loaded: boolean;
  isSaved: (target: BookmarkTarget) => boolean;
  // Resolves to the NEW saved state (true = now saved, false = now
  // unsaved) so a caller can update its own local UI/toast wording
  // without re-deriving it from isSaved() itself.
  toggleSave: (target: BookmarkTarget) => Promise<boolean>;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

function matches(entry: BookmarkTarget & { id: string }, target: BookmarkTarget) {
  if (target.businessId) return entry.businessId === target.businessId;
  if (target.experienceId) return entry.experienceId === target.experienceId;
  return false;
}

// Fetched ONCE here (when signed in) rather than by every single
// BusinessCard/ExperienceCard on a page independently — a homepage
// rail alone can render dozens of cards, and each doing its own
// GET /bookmarks would mean dozens of duplicate requests just to know
// whether their own one item is saved. This also fixes the actual bug
// that motivated pulling this out into a shared place at all: every
// card's own save button used to unconditionally call
// bookmarks.create() with no unsave path and no real initial state —
// clicking "unsave" a second time just created a harmless-but-useless
// duplicate-request, and a business you'd already saved always showed
// as un-saved again on a fresh page load (Val, Sep 2026: "Unsave
// doesn't work").
export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();
  const [entries, setEntries] = useState<Array<BookmarkTarget & { id: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!authed) {
      setEntries([]);
      setLoaded(true);
      return;
    }
    api.bookmarks
      .list()
      .then((rows) => {
        setEntries(rows.map((r) => ({ id: r.id, businessId: r.businessId, experienceId: r.experienceId })));
        setLoaded(true);
      })
      .catch(() => setLoaded(true)); // still "loaded" — isSaved() just says false for everything, matching the old (broken) default rather than getting stuck
  }, [authed]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  const isSaved = useCallback((target: BookmarkTarget) => entries.some((e) => matches(e, target)), [entries]);

  const toggleSave = useCallback(
    async (target: BookmarkTarget) => {
      const existing = entries.find((e) => matches(e, target));
      if (existing) {
        await api.bookmarks.remove(existing.id);
        setEntries((prev) => prev.filter((e) => e.id !== existing.id));
        return false;
      }
      const created = await api.bookmarks.create(target);
      setEntries((prev) => [...prev, { id: created.id, ...target }]);
      return true;
    },
    [entries],
  );

  return <BookmarksContext.Provider value={{ loaded, isSaved, toggleSave }}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error("useBookmarks must be used within a BookmarksProvider");
  return ctx;
}
