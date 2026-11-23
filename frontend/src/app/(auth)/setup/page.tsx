"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { RememberSessionOption } from "@/components/auth/remember-session-option";
import { Button } from "@/components/ui/button";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/core/api/fetcher";
import { useAuth } from "@/core/auth/AuthProvider";
import { loadRememberLoginPreference } from "@/core/auth/remember-login";
import {
  fetchSetupStatus,
  isSystemAlreadyInitializedError,
} from "@/core/auth/setup";
import { parseAuthError } from "@/core/auth/types";
import { useI18n } from "@/core/i18n/hooks";

type SetupMode = "loading" | "init_admin" | "change_password" | "unavailable";

export default function SetupPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { theme, resolvedTheme } = useTheme();
  const { t } = useI18n();
  const [mode, setMode] = useState<SetupMode>("loading");
  const [setupStatusAttempt, setSetupStatusAttempt] = useState(0);

  // --- Shared state ---
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pageGeneration = useRef(0);
  useLayoutEffect(() => {
    pageGeneration.current += 1;
    return () => {
      pageGeneration.current += 1;
    };
  }, [user?.id]);
  const [rememberMe, setRememberMe] = useState(
    () => loadRememberLoginPreference().rememberMe,
  );

  // --- Change-password mode only ---
  const [currentPassword, setCurrentPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (isAuthenticated && user?.needs_setup) {
      setMode("change_password");
    } else if (!isAuthenticated) {
      // Check if the system has no users yet. A slow Gateway must not leave the
      // setup page in an infinite loading state or silently redirect away.
      setMode("loading");
      void fetchSetupStatus()
        .then((data: { needs_setup?: boolean }) => {
          if (cancelled) return;
          if (data.needs_setup) {
            setMode("init_admin");
          } else {
            // System already set up and user is not logged in — go to login
            router.replace("/login");
          }
        })
        .catch(() => {
          if (!cancelled) setMode("unavailable");
        });
    } else {
      // Authenticated but needs_setup is false — already set up
      router.replace("/workspace");
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, router, setupStatusAttempt]);

  // ── Init-admin handler ─────────────────────────────────────────────
  const handleInitAdmin = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (loading) return;
    const generation = pageGeneration.current;
    const current = () => generation === pageGeneration.current;
    setError("");

    if (newPassword !== confirmPassword) {
      setError(t.setup.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password: newPassword,
          remember_me: rememberMe,
        }),
      });

      if (!current()) return;
      if (!res.ok) {
        const data = await res.json();
        if (!current()) return;
        if (isSystemAlreadyInitializedError(data)) {
          router.replace("/login");
          return;
        }
        const authError = parseAuthError(data);
        setError(authError.message);
        return;
      }

      router.push("/workspace");
    } catch {
      if (current()) setError(t.login.networkError);
    } finally {
      if (current()) setLoading(false);
    }
  };

  // ── Change-password handler ────────────────────────────────────────
  const handleChangePassword = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (loading) return;
    const generation = pageGeneration.current;
    const current = () => generation === pageGeneration.current;
    setError("");

    if (newPassword !== confirmPassword) {
      setError(t.setup.passwordMismatch);
      return;
    }
    if (newPassword.length < 8) {
      setError(t.setup.passwordTooShort);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_email: email || undefined,
          remember_me: rememberMe,
        }),
      });

      if (!current()) return;
      if (!res.ok) {
        const data = await res.json();
        if (!current()) return;
        const authError = parseAuthError(data);
        setError(authError.message);
        return;
      }

      router.push("/workspace");
    } catch {
      if (current()) setError(t.login.networkError);
    } finally {
      if (current()) setLoading(false);
    }
  };

  const actualTheme = theme === "system" ? resolvedTheme : theme;

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">{t.common.loading}</p>
      </div>
    );
  }

  if (mode === "unavailable") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <div>
            <h1 className="text-xl font-semibold">
              {t.login.serviceUnavailableTitle}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {t.login.serviceUnavailableDescription}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button
              type="button"
              onClick={() => {
                setMode("loading");
                setSetupStatusAttempt((attempt) => attempt + 1);
              }}
            >
              {t.login.retry}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.replace("/login")}
            >
              {t.login.signIn}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin initialization form ──────────────────────────────────────
  if (mode === "init_admin") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <FlickeringGrid
          className="absolute inset-0 z-0 mask-[url(/images/deer.svg)] mask-size-[100vw] mask-center mask-no-repeat md:mask-size-[72vh]"
          squareSize={4}
          gridGap={4}
          color={actualTheme === "dark" ? "white" : "black"}
          maxOpacity={0.3}
          flickerChance={0.25}
        />
        <div className="border-border/20 bg-background/5 w-full max-w-md space-y-6 rounded-3xl border p-8 backdrop-blur-sm">
          <div className="text-center">
            <h1 className="font-serif text-3xl">DeerFlow</h1>
            <p className="text-muted-foreground mt-2">
              {t.setup.createAdminTitle}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t.setup.createAdminSubtitle}
            </p>
          </div>
          <form onSubmit={handleInitAdmin} className="space-y-2">
            <div className="flex flex-col space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                {t.login.email}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t.login.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label htmlFor="password" className="text-sm font-medium">
                {t.setup.password}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={t.setup.passwordPlaceholder}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                {t.setup.confirmPassword}
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder={t.setup.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <RememberSessionOption
              checked={rememberMe}
              onCheckedChange={setRememberMe}
            />
            {error && (
              <p role="alert" className="text-destructive ms-1 text-sm">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.setup.creatingAdmin : t.setup.createAdmin}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Change-password form (needs_setup after login) ─────────────────
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <FlickeringGrid
        className="absolute inset-0 z-0 mask-[url(/images/deer.svg)] mask-size-[100vw] mask-center mask-no-repeat md:mask-size-[72vh]"
        squareSize={4}
        gridGap={4}
        color={actualTheme === "dark" ? "white" : "black"}
        maxOpacity={0.3}
        flickerChance={0.25}
      />
      <div className="border-border/20 bg-background/5 w-full max-w-md space-y-6 rounded-3xl border p-8 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="font-serif text-3xl">DeerFlow</h1>
          <p className="text-muted-foreground mt-2">
            {t.setup.completeAdminTitle}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t.setup.completeAdminSubtitle}
          </p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            type="email"
            placeholder={t.setup.emailPlaceholder}
            aria-label={t.setup.emailPlaceholder}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t.setup.currentPassword}
            aria-label={t.setup.currentPassword}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t.setup.newPassword}
            aria-label={t.setup.newPassword}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            type="password"
            placeholder={t.setup.confirmNewPassword}
            aria-label={t.setup.confirmNewPassword}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
          <RememberSessionOption
            checked={rememberMe}
            onCheckedChange={setRememberMe}
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t.setup.settingUp : t.setup.completeSetup}
          </Button>
        </form>
      </div>
    </div>
  );
}
