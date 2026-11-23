"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { QueryClientProvider } from "@/components/query-client-provider";
import { useAuth } from "@/core/auth/AuthProvider";
import { isStaticWebsiteOnly } from "@/core/static-mode";

import { startUserPreferences } from "./user-preferences";

const useClientLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function UserPreferencesBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const identity = user?.id ?? null;
  const owner =
    !isStaticWebsiteOnly() && user?.id !== "default" ? user?.id : undefined;
  // SSR and initial hydration render the same workspace with the settings
  // store's safe server snapshot. Initialize the browser cache before paint.
  const [activeIdentity, setActiveIdentity] = useState(identity);
  useClientLayoutEffect(() => {
    const stop = owner ? startUserPreferences(owner) : undefined;
    setActiveIdentity(identity);
    return stop;
  }, [owner, identity]);
  // Only gate a subsequent account switch, keeping the old owner's settings
  // out of the new owner's consumers until the new cache is activated.
  if (identity !== activeIdentity) return null;
  return (
    <QueryClientProvider key={JSON.stringify(identity)}>
      {children}
    </QueryClientProvider>
  );
}
