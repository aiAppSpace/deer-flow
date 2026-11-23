/*
  【文件职责】     探测 Gateway 当前 session 并区分未登录与服务不可用。
  【架构位置】     L3
  【主要导出】     probeSession · SessionProbe
  【依赖关系】     auth types · injected fetch
  【边界与注意】   认识 Gateway session 响应，禁止进入 L1/L2。
*/

import { userSchema, type User } from "./types";

export type SessionProbe =
  | { tag: "authenticated"; user: User }
  | { tag: "unauthenticated" }
  | { tag: "unavailable" };

/** Probe the Gateway session without turning an outage into a logged-out claim. */
export async function probeSession(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  current?: SessionProbe,
): Promise<SessionProbe> {
  const unavailable: SessionProbe =
    current?.tag === "authenticated" ? current : { tag: "unavailable" };
  try {
    const response = await fetchImpl("/api/v1/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
    if (response.status === 401) return { tag: "unauthenticated" };
    // Only an authoritative 401 revokes a known identity. HTTP, transport
    // and malformed-response failures retain it; cold starts still report
    // Gateway unavailable through the existing session channel.
    if (!response.ok) return unavailable;
    const parsed = userSchema.safeParse(await response.json());
    return parsed.success
      ? { tag: "authenticated", user: parsed.data }
      : unavailable;
  } catch {
    return unavailable;
  }
}
