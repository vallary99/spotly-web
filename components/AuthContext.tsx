"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setToken, clearToken, isAuthed, decodeToken, ApiError } from "@/lib/api";
import { useToast } from "./ToastContext";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  authed: boolean;
  businessId: string | null;
  authModalOpen: boolean;
  onAuthSuccess: (() => void) | null;
  openAuthModal: (onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  hydrateFromToken: (token: string) => void;
  refreshAuth: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_STORAGE_KEY = "spotly_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializers run synchronously during the component's first
  // render, not in a useEffect — this is the actual fix for a real race
  // condition: previously user/businessId started as null and were only
  // corrected inside a useEffect, but React fires child effects before
  // parent effects, so a child page's own "if (!authed) openAuthModal()"
  // effect could run — and wrongly open the sign-in modal for an already
  // logged-in person — before this provider's effect had a chance to
  // read localStorage and set the real state. Reading synchronously here
  // means `authed` is correct from the very first render.
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored && isAuthed() ? JSON.parse(stored) : null;
  });
  const [businessId, setBusinessId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return isAuthed() ? (decodeToken()?.businessId ?? null) : null;
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingSuccessCb, setPendingSuccessCb] = useState<(() => void) | null>(null);
  const { showToast } = useToast();

  // Self-heals a stale token: if someone's stored JWT predates them
  // registering a business (e.g. a refreshAuth() call after business
  // creation silently failed on a flaky connection, or a business was
  // granted through another tab/device), businessId would otherwise sit
  // wrong until their next explicit login — showing "List Your
  // Business" to someone who already has a business account. Runs once
  // per session, only when logged in with no businessId yet, so it
  // costs a confirming call to non-owners exactly once and nothing at
  // all to owners whose token is already correct.
  useEffect(() => {
    if (!user || businessId) return;
    api.auth
      .refresh()
      .then((res) => {
        setToken(res.accessToken);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
        setUser(res.user);
        setBusinessId(decodeToken()?.businessId ?? null);
      })
      .catch(() => {
        // Invalid/expired token: the request wrapper's own 401 handling
        // (spotly:unauthorized) already covers logging the person out.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // lib/api.ts dispatches this the moment any request comes back 401 —
  // the stored token is invalid/expired (commonly from testing across
  // restarts, or a token that outlived a dev database reset). Without
  // this, the UI kept believing it was still authed and every
  // auth-required page kept throwing an uncaught ApiError trying to use
  // a dead token. This resets React state to match reality and tells
  // the person what happened instead of letting the page crash.
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setBusinessId(null);
      showToast("Your session expired, please sign in again.");
    };
    window.addEventListener("spotly:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("spotly:unauthorized", handleUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (res: { accessToken: string; user: User }) => {
    setToken(res.accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
    setUser(res.user);
    setBusinessId(decodeToken()?.businessId ?? null);
  };

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.auth.signup({ email, password, name });
    persist(res);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    persist(res);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setBusinessId(null);
  }, []);

  // Used by /auth/callback after Google redirect back with a token
  // in the URL, the backend only sends a JWT (via redirect), not a full
  // user object like the email/password flows get, so this decodes the
  // token client-side to reconstruct enough of a User to populate the UI.
  const hydrateFromToken = useCallback((token: string) => {
    setToken(token);
    const decoded = decodeToken();
    if (!decoded) return;
    const reconstructed: User = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.email.split("@")[0],
      role: decoded.role,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(reconstructed));
    setUser(reconstructed);
    setBusinessId(decoded.businessId ?? null);
  }, []);

  // Called right after a business is successfully registered, see
  // note on the backend's POST /auth/refresh, so the nav and any
  // BUSINESS_OWNER-gated actions work immediately without a manual
  // logout/login.
  const refreshAuth = useCallback(async () => {
    const res = await api.auth.refresh();
    persist(res);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authed: Boolean(user),
        businessId,
        authModalOpen,
        onAuthSuccess: pendingSuccessCb,
        openAuthModal: (onSuccess) => {
          setPendingSuccessCb(() => onSuccess ?? null);
          setAuthModalOpen(true);
        },
        closeAuthModal: () => {
          setAuthModalOpen(false);
          setPendingSuccessCb(null);
        },
        signup,
        login,
        hydrateFromToken,
        refreshAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
