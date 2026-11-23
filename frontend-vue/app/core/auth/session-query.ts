/*
  【文件职责】     定义 Gateway session 的唯一 Vue Query key、queryFn 与缓存策略。
  【架构位置】     L3 authentication/server state
  【主要导出】     AUTH_SESSION_QUERY_KEY · authSessionQueryOptions
  【依赖关系】     @tanstack/vue-query · ./session
  【边界与注意】   middleware、callback 与 workspace UI 必须复用此查询，不能各存一份 session。
*/

import { queryOptions } from "@tanstack/vue-query";

import { probeSession, type SessionProbe } from "./session";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const;

// The cached query is the recovery owner. Multiple composable consumers must
// share a streak; removing the query (logout/account change) also retires it.
const recoveryFailures = new WeakMap<object, number>();
const RECOVERY_AUTH_FAILURE_THRESHOLD = 3;

export function authSessionQueryOptions(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
) {
  return queryOptions({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async ({ client }) => {
      const query = client.getQueryCache().find({
        queryKey: AUTH_SESSION_QUERY_KEY,
        exact: true,
      });
      const current = client.getQueryData<SessionProbe>(AUTH_SESSION_QUERY_KEY);
      const recovering = current?.tag === "unavailable";
      const session = await probeSession(fetchImpl, current);
      if (!query) return session;
      if (!recovering || session.tag === "authenticated") {
        recoveryFailures.delete(query);
        return session;
      }
      const previous = recoveryFailures.get(query) ?? 0;
      if (session.tag === "unavailable") {
        recoveryFailures.set(query, Math.max(0, previous - 1));
        return session;
      }
      const failures = previous + 1;
      if (failures < RECOVERY_AUTH_FAILURE_THRESHOLD) {
        recoveryFailures.set(query, failures);
        return { tag: "unavailable" } as const;
      }
      recoveryFailures.delete(query);
      // React delegates the third recovery 401 to AuthProvider.refreshUser.
      // The final authoritative probe decides whether to retain or end session.
      return probeSession(fetchImpl);
    },
    // UserPreferencesBoundary owns the throttled visibility refresh.
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });
}
