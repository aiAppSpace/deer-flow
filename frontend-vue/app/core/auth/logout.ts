/*
  【文件职责】     退出登录的唯一实现：**Gateway 连不上时也要走得掉**。
  【架构位置】     L3（纯逻辑 + 注入的副作用端口）
  【主要导出】     performLogout
  【依赖关系】     client-state（清 Query 树与草稿）
  【边界与注意】   **失败不能就地放弃。** 上游 AuthProvider.tsx:117 的 logout 在 POST 失败时
                   仍然清掉本地态并**硬跳转**（注释原文：hard navigation ensures every
                   in-flight subscription is torn down, matching the legacy form-POST
                   logout behaviour during a gateway outage）。本仓此前是
                   `if (!response.ok) { error = signOutFailed; return; }`——
                   而「会话坏了 + Gateway 连不上」正是最需要退出的那一刻，
                   那时候人被留在原地，只看到一行错误（wave 38）。

                   跳转目标保留本仓这一侧的 `/login`（上游去 `/`）：从工作区退出之后
                   要的是登录页，不是营销落地页。**失败那一支用 `location.href` 而不是
                   `navigateTo`**：客户端路由不会拆掉在飞的订阅与 SSE，而这一支的前提
                   就是「后端状态不可信」。

                   **这里原来写着「L2 core」，wave 61 改成 L3。** 它形状上确实是
                   「纯逻辑 + 注入端口」，但 L2 在本仓不是形状而是**位置与依赖**：
                   ARCHITECTURE.md 的分层表把 L2 圈定在 `app/core/markdown/`、
                   `app/core/code-editor/`、`app/components/markdown/`、
                   `app/components/ui/`、`app/lib/{utils,focusable}.ts`，并明写 L2
                   **不得依赖**「DeerFlow API、线程、认证、产物和业务 store」。
                   本文件在 `app/core/auth/` 下、import `@/core/auth/client-state`，
                   正好命中 `architecture.test.ts` 的 `l2ForbiddenImports` 第一条。
                   之所以一直没红：那条边界只遍历 `l2Files` 白名单，而它不在里面——
                   **自称 L2 却不在名单上的文件，恰好谁都不检查**（wave 61 已补上反向门禁）。
*/

import type { QueryClient } from "@tanstack/vue-query";

import { clearAuthenticatedClientState } from "@/core/auth/client-state";

export type LogoutPorts = {
  /** 发登出请求；抛异常与非 2xx 都算失败。 */
  post: () => Promise<{ ok: boolean }>;
  /** 成功路径的跳转（客户端路由即可）。 */
  navigate: (to: string) => Promise<unknown> | unknown;
  /** 失败路径的硬跳转。 */
  hardNavigate: (to: string) => void;
  /** 只用来清本地缓存；收窄到 `clear`，理由见 client-state.ts。 */
  queryClient: Pick<QueryClient, "clear">;
};

export type LogoutOutcome = "signed-out" | "forced-out";

/** 退出登录。返回值只用于告诉调用方走的是哪一支，两支都已经登出。 */
export async function performLogout(
  ports: LogoutPorts,
  destination = "/login",
): Promise<LogoutOutcome> {
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
