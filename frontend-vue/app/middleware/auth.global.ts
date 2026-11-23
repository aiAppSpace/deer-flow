/*
 * L3 Nuxt route boundary. Capture injected QueryClient before dynamic imports;
 * load session decoding and artifact classification only on guarded routes.
 * Only 401 means unauthenticated; an unknown Gateway session remains recoverable.
 */

import {
  buildLoginLocation,
  decideAuthNavigation,
  isEnabledRuntimeFlag,
} from "@/core/auth/decision";
import { ARTIFACT_VIEWER_ROUTE } from "@/core/artifacts/viewer-route";
import { useQueryClient } from "@tanstack/vue-query";

export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();
  const authDisabled = isEnabledRuntimeFlag(config.public.authDisabled);
  // Artifact classification also imports asynchronously. Capture injection
  // while this middleware still has its original context, before either import.
  const queryClient =
    !authDisabled &&
    (to.path.startsWith("/workspace") || to.path === ARTIFACT_VIEWER_ROUTE)
      ? useQueryClient()
      : null;
  /*
    独立产物视窗的路径不说明任何事——要不要登录取决于 query 指向谁的文件。
    判定模块同样是**动态** import 的：它顺带拖着产物分类与演示集，
    而绝大多数路由（首页在内）永远走不到这里。
  */
  let guarded = false;
  if (to.path === ARTIFACT_VIEWER_ROUTE) {
    const { parseArtifactViewerQuery, requiresAuthenticatedViewer } =
      await import("@/core/artifacts/viewer");
    const target = parseArtifactViewerQuery(to.query);
    // 目标解析不出来时按「要登录」处理：错误提示本身不该泄漏给未登录的人。
    guarded = target === null || requiresAuthenticatedViewer(target);
  }
  let authenticated = false;
  if ((to.path.startsWith("/workspace") || guarded) && !authDisabled) {
    // Reuse the QueryClient captured before the first asynchronous boundary.
    const { authSessionQueryOptions } =
      await import("@/core/auth/session-query");
    const session = await queryClient!.fetchQuery(authSessionQueryOptions());
    if (session.tag === "unavailable") {
      // Preserve the protected route. The workspace consumes the same query
      // state and exposes a visible retry path until the Gateway recovers.
      return;
    }
    if (session.tag === "authenticated" && session.user.needs_setup) {
      return navigateTo("/setup");
    }
    authenticated = session.tag === "authenticated";
  }
  const decision = decideAuthNavigation({
    path: to.path,
    authDisabled,
    authenticated,
    guarded,
  });
  if (decision === "login") {
    // 回跳目标的安全校验在纯函数里（06 §鉴权中间件切成纯函数）：
    // 这一行只负责执行副作用。
    return navigateTo(buildLoginLocation(to.fullPath));
  }
});
