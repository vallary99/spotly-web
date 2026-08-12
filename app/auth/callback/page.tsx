"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/ToastContext";
import { Logo } from "@/components/Logo";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrateFromToken } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      hydrateFromToken(token);
      showToast("Welcome to Spotly!");
    }
    router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream">
      <Logo height={56} />
      <p className="text-warm-clay">Signing you in…</p>
      <Suspense fallback={null}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
