import type { SessionProbe } from "@/core/auth/session";

/** Preferences require a real browser session; synthetic/degraded users cannot sync. */
export function preferenceOwner(
  session: SessionProbe | undefined,
  _authDisabled: boolean,
): string | undefined {
  return session?.tag === "authenticated" && session.user.id !== "default"
    ? session.user.id
    : undefined;
}
