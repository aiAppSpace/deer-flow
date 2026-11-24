"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { resolveAuthNextPath } from "@/core/auth/next-path";
import { useI18n } from "@/core/i18n/hooks";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [status, setStatus] = useState<
    "loading" | "success" | "unauthenticated" | "unavailable"
  >("loading");
  const calledRef = useRef(false);
  const mountedRef = useRef(true);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const doAuthCheck = useCallback(async () => {
    if (calledRef.current) return;
    calledRef.current = true;

    const next = resolveAuthNextPath(searchParams.get("next"));

    try {
      const res = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (!mountedRef.current) return;

      if (res.ok) {
        setStatus("success");
        // Small delay so the user sees the success message
        redirectTimer.current = setTimeout(() => router.replace(next), 300);
      } else if (res.status === 401) {
        setStatus("unauthenticated");
        redirectTimer.current = setTimeout(
          () => router.replace("/login?error=sso_failed"),
          1500,
        );
      } else {
        setStatus("unavailable");
        redirectTimer.current = setTimeout(
          () =>
            router.replace(
              `/login?error=gateway_unavailable&next=${encodeURIComponent(next)}`,
            ),
          1500,
        );
      }
    } catch {
      if (!mountedRef.current) return;
      setStatus("unavailable");
      redirectTimer.current = setTimeout(
        () =>
          router.replace(
            `/login?error=gateway_unavailable&next=${encodeURIComponent(next)}`,
          ),
        1500,
      );
    }
  }, [searchParams, router]);

  useEffect(() => {
    void doAuthCheck();
  }, [doAuthCheck]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (redirectTimer.current !== undefined)
        clearTimeout(redirectTimer.current);
    };
  }, []);

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <p className="text-muted-foreground">{t.login.callbackSigningIn}</p>
          </>
        )}
        {status === "success" && (
          <p className="text-muted-foreground">{t.login.callbackRedirecting}</p>
        )}
        {status === "unauthenticated" && (
          <p className="text-muted-foreground">
            {t.login.callbackFailedRedirect}
          </p>
        )}
        {status === "unavailable" && (
          <p className="text-muted-foreground">
            {t.login.callbackUnavailableRedirect}
          </p>
        )}
      </div>
    </div>
  );
}
