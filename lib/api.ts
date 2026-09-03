// Thin fetch wrapper around the Spotly API (see spotly-api project).
// Attaches the JWT automatically when present and normalizes error
// handling so components can just `await` and catch a single error shape.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("spotly_token");
}

export function setToken(token: string) {
  localStorage.setItem("spotly_token", token);
}

export function clearToken() {
  localStorage.removeItem("spotly_token");
}

export function isAuthed(): boolean {
  return Boolean(getToken());
}

// Decodes the JWT payload client-side (no verification needed here — the
// backend is the source of truth on every request; this is purely for UI
// branching like "does this user already own a business").
export function decodeToken(): { sub: string; email: string; role: string; businessId?: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const token = auth ? getToken() : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body && !(rest.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    // A 401 on an authed request means the stored token is invalid or
    // expired — clear it immediately and tell the rest of the app
    // (AuthContext listens for this) so stale "authed" UI state doesn't
    // keep firing more requests that'll just 401 again. Individual pages
    // still need to catch the thrown ApiError so this doesn't surface as
    // an unhandled crash — this only handles the auth-state side.
    if (res.status === 401 && auth) {
      clearToken();
      localStorage.removeItem("spotly_user");
      window.dispatchEvent(new Event("spotly:unauthorized"));
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- Types (mirrors backend entities/DTOs) ----------

export interface TierLimit {
  priceKes: number;
  photos: number;
  videos: number;
  videoMaxSeconds: number;
  concurrentExperiences: number | null;
  monthlyExperiencesIncluded: number | null;
  extraFeatures: string[];
  experienceAddonPriceKes: number;
}

export interface Business {
  id: string;
  ownerId: string;
  type: "VENUE" | "EXPERIENCE_HOST";
  name: string;
  // Replaced by `categories` (up to 5) — kept nowhere else, every
  // consumer reads the array now.
  categories: string[];
  description?: string | null;
  // Split from the old single `phone` field: callPhone is dialled
  // directly, whatsappPhone opens WhatsApp (web or app) instead.
  callPhone?: string | null;
  whatsappPhone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  hours?: Record<string, { open: string; close: string } | null> | null;
  amenities: string[];
  city?: string | null;
  neighborhood?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  reservationPolicy?: "RESERVATION_ONLY" | "WALK_IN_ONLY" | "BOTH" | null;
  // Whether this business was auto-enrolled in the first-100-businesses
  // free Premium trial offer (Val, Sep 2026) — used only to decide
  // whether the dashboard hides the manual pay-for-a-tier picker while
  // that offer is still pending activation; see subStatus.trialOffer
  // for the offer itself.
  firstCohortPremiumTrial?: boolean;
  tier: "STARTER" | "GROWTH" | "PREMIUM";
  subscriptionStatus: "ACTIVE" | "GRACE_PERIOD" | "DOWNGRADED";
  isGrandfathered: boolean;
  discountPercent?: number;
  isSuspended?: boolean;
  isHiddenGem?: boolean;
  // Owner-chosen photo id to use as the card/homepage thumbnail; null
  // or absent means "use the default" (oldest approved photo). The API
  // already reorders `media` to put this photo first when set, so most
  // UI can just keep reading media[0] — this field is mainly needed by
  // the dashboard's "set as cover" control to know which one is
  // currently selected.
  coverMediaId?: string | null;
  // Owner-only metrics — only present in the API response when the
  // requester is the business's own owner (see business.service.ts).
  // Never render these on public cards/pages.
  profileViews?: number;
  savesCount?: number;
  // Attached server-side on every list/detail response.
  averageRating?: number;
  reviewCount?: number;
  createdAt: string;
  media?: Media[];
  reviews?: unknown[];
  experiences?: Experience[];
}

export interface Media {
  id: string;
  businessId: string;
  type: "PHOTO" | "VIDEO";
  url: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
}

export interface Experience {
  id: string;
  businessId: string;
  businessName?: string;
  title: string;
  description?: string | null;
  images: string[];
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  price?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  // True when budgetMin/budgetMax above are the BUSINESS's default
  // range, not something set on this experience itself (see the API's
  // withBudgetFallback). Only meaningful for telling the dashboard's
  // edit form whether to default to "use business default" — display
  // components can just show budgetMin/budgetMax either way.
  inheritedBudget?: boolean;
  ticketingLink?: string | null;
  isExpired: boolean;
}

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: number[]; // index 0 = 1-star ... index 4 = 5-star
  reviews: Array<{
    id: string;
    rating: number;
    text?: string | null;
    photos: string[];
    visitDate?: string | null;
    helpfulCount: number;
    createdAt: string;
    reviewer: { id: string; name: string };
  }>;
}

export interface HomeResponse {
  hero: { featured: Array<{ id: string; name: string }> };
  quickFilters: Array<{ id: string; label: string; icon: string | null; categories: string[] }>;
  rails: {
    trendingThisWeek: Business[];
    popularNearYou: Business[];
    upcomingExperiences: Experience[];
  };
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
}

// ---------- API calls ----------

export const api = {
  auth: {
    signup: (dto: { email: string; password: string; name: string }) =>
      request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(dto), auth: false }),
    login: (dto: { email: string; password: string }) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(dto), auth: false }),
    refresh: () => request<AuthResponse>("/auth/refresh", { method: "POST" }),
    forgotPassword: (email: string) =>
      request<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email, resetUrlBase: typeof window !== "undefined" ? window.location.origin : "" }),
        auth: false,
      }),
    resetPassword: (token: string, newPassword: string) =>
      request<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
        auth: false,
      }),
  },
  home: (params?: { city?: string; neighborhood?: string; category?: string; categories?: string; q?: string; isHiddenGem?: boolean }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<HomeResponse>(`/home${qs ? `?${qs}` : ""}`, { auth: false });
  },
  businesses: {
    list: (params?: { neighborhood?: string; category?: string; q?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request<Business[]>(`/businesses${qs ? `?${qs}` : ""}`, { auth: false });
    },
    // Not { auth: false } — the backend endpoint is still @Public() (a
    // guest can call this with no token), but it also returns MORE data
    // when a valid token IS present and identifies the requester as the
    // business's own owner (full media regardless of status, and
    // profileViews/savesCount — see business.service.ts). Omitting the
    // token here unconditionally meant the owner's own dashboard always
    // got the guest-level (approved-only) view of their own business.
    get: (id: string) => request<Business>(`/businesses/${id}`),
    hostingHistory: (id: string) => request<Experience[]>(`/businesses/${id}/experiences/history`, { auth: false }),
    create: (dto: Record<string, unknown>) =>
      request<Business>("/businesses", { method: "POST", body: JSON.stringify(dto) }),
    update: (id: string, dto: Record<string, unknown>) =>
      request<Business>(`/businesses/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
    setCoverPhoto: (id: string, mediaId: string | null) =>
      request<{ coverMediaId: string | null }>(`/businesses/${id}/cover-photo`, {
        method: "PATCH",
        body: JSON.stringify({ mediaId }),
      }),
    remove: (id: string) => request(`/businesses/${id}`, { method: "DELETE" }),
    categories: () => request<string[]>("/businesses/categories", { auth: false }),
    maxCategories: () => request<{ maxCategories: number }>("/businesses/max-categories", { auth: false }),
  },
  reviews: {
    forBusiness: (businessId: string) =>
      request<ReviewSummary>(`/reviews?businessId=${businessId}`, { auth: false }),
    create: (businessId: string, dto: { rating: number; text?: string; visitDate?: string }) =>
      request(`/reviews?businessId=${businessId}`, { method: "POST", body: JSON.stringify(dto) }),
  },
  bookmarks: {
    list: () => request<Array<{ id: string; businessId?: string; business?: Business; experienceId?: string; experience?: Experience }>>("/bookmarks"),
    create: (dto: { businessId?: string; experienceId?: string }) =>
      request<{ id: string; businessId?: string; experienceId?: string }>("/bookmarks", { method: "POST", body: JSON.stringify(dto) }),
    remove: (id: string) => request(`/bookmarks/${id}`, { method: "DELETE" }),
  },
  experiences: {
    list: (params?: { category?: string; upcoming?: boolean }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request<Experience[]>(`/experiences${qs ? `?${qs}` : ""}`, { auth: false });
    },
    create: (businessId: string, dto: Record<string, unknown>) =>
      request<Experience>(`/businesses/${businessId}/experiences`, { method: "POST", body: JSON.stringify(dto) }),
    update: (id: string, dto: Record<string, unknown>) =>
      request<Experience>(`/experiences/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
    remove: (id: string) => request(`/experiences/${id}`, { method: "DELETE" }),
    uploadCoverImage: async (businessId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch(`${API_URL}/businesses/${businessId}/experience-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new ApiError(body.message || "Couldn't upload that image.", res.status);
      }
      return res.json() as Promise<{ url: string; storageKey: string }>;
    },
  },
  subscriptions: {
    tiers: () => request<Record<string, TierLimit>>("/subscriptions/tiers", { auth: false }),
    status: (businessId: string) =>
      request<{
        tier: string;
        status: string;
        isGrandfathered: boolean;
        discountPercent: number;
        firstCohortPremiumTrial: boolean;
        trialOffer: { tier: string; days: number } | null;
        activeTrial: { tier: string; endsAt: string } | null;
        limits: TierLimit;
        usage: { profileViews: number; savesCount: number };
        shouldPromptUpgrade: boolean;
        upgradeMessage: string | null;
      }>(`/businesses/${businessId}/subscription`),
    startTrial: (businessId: string) => request(`/businesses/${businessId}/start-trial`, { method: "POST" }),
  },
  payments: {
    initiate: (dto: { businessId: string; purpose: string; targetTier?: string; amount: number; phoneNumber: string }) =>
      request<{ payment: { id: string }; simulated: boolean }>("/payments/mpesa/stk-push", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    status: (id: string) => request<{ status: string; mpesaReceiptNumber?: string }>(`/payments/mpesa/${id}/status`),
  },
  search: (q: string) =>
    request<{ businesses: Array<{ id: string; name: string; categories: string[] }>; experiences: Array<{ id: string; title: string; startsAt: string }> }>(
      `/search?q=${encodeURIComponent(q)}`,
      { auth: false },
    ),
  media: {
    getUploadUrl: (businessId: string, type: "PHOTO" | "VIDEO", ext: string) =>
      request<{
        uploadUrl: string;
        publicUrl: string;
        storageKey: string;
        simulated?: boolean;
        // Present only for VIDEO when Cloudinary is actually configured
        // server-side — everything needed to upload the file straight to
        // Cloudinary from the browser, bypassing this API's own request
        // body entirely (Vercel's 4.5MB serverless function body limit,
        // Val, Sep 2026 — routinely too small for even a short video,
        // never a problem locally where no such platform limit exists).
        // Omitted when Cloudinary isn't configured (local dev default),
        // in which case the caller falls back to the same multipart
        // flow it always used.
        signedUpload?: {
          cloudinaryUploadUrl: string;
          apiKey: string;
          timestamp: number;
          signature: string;
          publicId: string;
        };
      }>(`/businesses/${businessId}/media/upload-url?type=${type}&ext=${ext}`, { method: "POST" }),
    submit: (businessId: string, formData: FormData, query: string) =>
      request<Media>(`/businesses/${businessId}/media?${query}`, { method: "POST", body: formData }),
    confirmVideoUpload: (businessId: string, dto: { url: string; storageKey: string; durationSeconds: number }) =>
      request<Media>(`/businesses/${businessId}/media/confirm-video`, { method: "POST", body: JSON.stringify(dto) }),
    remove: (businessId: string, mediaId: string) =>
      request(`/businesses/${businessId}/media/${mediaId}`, { method: "DELETE" }),
  },
};
