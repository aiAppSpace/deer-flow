/*
  【文件职责】     将 auth 纯决策接到 Nuxt 路由边界。
  【架构位置】     L3
  【主要导出】     全局路由 middleware
  【依赖关系】     消费 runtimeConfig 与 decideAuthNavigation
  【边界与注意】   401 才是未登录；Gateway 不可用不得伪装成 unauthenticated。

                   **session query 只能动态 import。** 这是全局 middleware——它进
                   Nuxt entry，它静态依赖的一切都进**每个**路由的关键路径，包括
                   `/` 这类不需要 session 的公开页。而 `session-query` →
                   `session` → `auth/types` 拖着整个 zod runtime（实测 57,358 raw /
                   11,635 brotli）。营销页永远走不到下面那个 `if`，却一直在为它
                   下载解析器。`await import()` 让 zod 只在真的要探测 session 时
                   才进来；query key 仍是同一个模块实例，`useAuthSession` 与
                   `/auth/callback` 拿到的还是同一份缓存。
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
    /*
      `useQueryClient()` 必须在 `await` **之前**取到。它是 inject 型 composable，
      依赖 Nuxt 的异步上下文；跨过 `await import()` 再调用会拿不到 client，
      middleware 直接抛错——表现是登录、注册、setup、OIDC 回调全部停在原地
      且没有任何有用报错。`make e2e-auth` 12 条里红了 10 条就是这个形状。
    */
    const queryClient = useQueryClient();
    const { authSessionQueryOptions } =
      await import("@/core/auth/session-query");
    const session = await queryClient.fetchQuery(authSessionQueryOptions());
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
