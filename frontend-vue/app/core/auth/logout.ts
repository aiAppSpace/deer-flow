/*
 * L3 authenticated logout owner. Stop preferences and invalidate outstanding
 * account effects before the POST; clear client state on both outcomes.
 * A failed transport uses hard navigation so subscriptions and SSE are retired.
 */

import type { QueryClient } from "@tanstack/vue-query";

import { clearAuthenticatedClientState } from "@/core/auth/client-state";
import { invalidateWorkspaceQueryOwner } from "./workspace-queries";
import { stopUserPreferences } from "@/core/settings/user-preferences";

export type LogoutPorts = {
  /** 发登出请求；抛异常与非 2xx 都算失败。 */
  post: () => Promise<{ ok: boolean }>;
  /** 成功路径的跳转（客户端路由即可）。 */
  navigate: (to: string) => Promise<unknown> | unknown;
  /** 失败路径的硬跳转。 */
  hardNavigate: (to: string) => void;
  /** Cancel pending reads before the POST and clear the cache afterward. */
  queryClient: Pick<QueryClient, "clear" | "cancelQueries">;
};

export type LogoutOutcome = "signed-out" | "forced-out";

/** 退出登录。返回值只用于告诉调用方走的是哪一支，两支都已经登出。 */
export async function performLogout(
  ports: LogoutPorts,
  destination = "/",
): Promise<LogoutOutcome> {
  stopUserPreferences();
  invalidateWorkspaceQueryOwner(ports.queryClient);
  await ports.queryClient.cancelQueries();
  let ok: boolean;
  try {
    ok = (await ports.post()).ok;
  } catch {
    ok = false;
  }
  clearAuthenticatedClientState(ports.queryClient);
  if (ok) {
    await ports.navigate(destination);
    return "signed-out";
  }
  ports.hardNavigate(destination);
  return "forced-out";
}
