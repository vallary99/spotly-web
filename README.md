# Spotly Web — MVP Frontend

Next.js 16 (App Router) + Tailwind CSS v4, built as a continuation of the
`spotly-homepage.html` / `spotly-business-details.html` prototypes —
same visual system (Cinzel + Inter, terracotta/olive/cream palette, 20px
radii, Bootstrap Icons), same interaction patterns (guest-gated saving,
toast confirmations, star-picker reviews), now wired to the real
`spotly-api` backend instead of mock data.

See `LOCAL_SETUP.md` in this project's parent folder for a complete
step-by-step guide to running both projects together.

## Setup

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local
npm run dev
```

Requires the `spotly-api` backend running (see that project's README) —
this app calls it directly for everything: home feed, business details,
auth, bookmarks, reviews, search, payments, media.

## What's built

- **Homepage** (`/`) — hero, search, MVP's 5 quick filters, 3 live rails
  (Trending, Popular, Upcoming Experiences), all from `GET /home`.
- **Business Details** (`/businesses/[id]`) — gallery, quick actions
  (Save/Share/Directions/Call/Review — all functional, not placeholders),
  amenities, hours (computed open/closed from real data), upcoming
  experiences, reviews with a real star-picker modal, related businesses.
- **Saved** (`/saved`) — flat bookmark list (no Collections, per MVP scope).
- **Business registration** (`/business/new`) — Venue/Experience Host
  type, profile fields, amenities. Auto-redirects to the dashboard if
  the signed-in user already owns a business.
- **Business Owner Surface** (`/dashboard`) — profile editor (including
  a real per-day opening-hours editor), photo upload with live
  quality-gate rejection messages, experience create/delete with
  tier-cap awareness, subscription panel with M-Pesa initiate + live
  status polling.
- **Auth** — real signup/login backed by JWT, plus working Google and
  Apple OAuth (redirects to the backend, backend redirects back to
  `/auth/callback` with a token). If the backend doesn't have real
  Google/Apple credentials configured, those buttons surface a clear
  "not configured yet" message instead of failing silently.
- **Auth-resume**: starting an action (List Your Business, Save, Rate &
  Review) while signed out opens the auth modal, and completing
  sign-in/sign-up resumes that exact action automatically — matches the
  BRD's guest-to-auth handoff requirement.
- **Design system** (`app/globals.css`) — brand tokens ported 1:1 from
  the Brand Identity Document via Tailwind v4's `@theme`.

## What's not built yet

- Live map integration (location sections are styled placeholders)
- Filter Drawer / Discover page (explicitly Phase 2 per the BRD)
- Notification centre (explicitly Phase 2)

## A note on external assets in constrained environments

Bootstrap Icons, Google Fonts, and the Unsplash placeholder photos all
load from public CDNs (`cdnjs.cloudflare.com`, `fonts.googleapis.com`,
`images.unsplash.com`). These load normally on any machine with regular
internet access. If you're testing this inside a network-restricted
sandbox, those specific domains may need to be added to the allowlist —
the app's logic and layout are unaffected either way.
