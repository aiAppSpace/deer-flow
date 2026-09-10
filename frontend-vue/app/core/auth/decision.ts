/*
  【文件职责】     以纯函数决定路由是否需要登录跳转。
  【架构位置】     L3
  【主要导出】     decideAuthNavigation · buildLoginLocation · isEnabledRuntimeFlag
  【依赖关系】     ./next-path（回跳校验）；被全局 middleware 与 node 单测调用
  【边界与注意】   M0 只验证 auth-disabled；真实 session 接线属于后续里程碑。
*/

import { validateAuthNextPath } from "./next-path";

export type AuthNavigation = "allow" | "login";

export function isEnabledRuntimeFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * 登录跳转的目标位置（06 §鉴权中间件切成纯函数）。
 *
 * `redirect` query 天然是「不可信输入 → 安全校验」：它会被写进 URL、再被登录后
 * 的回跳直接消费，是一个 open-redirect 的经典入口。校验复用
 * `validateAuthNextPath`——**不要在这里另写一套**，两套规则迟早分叉，而分叉的
 * 那一侧就是漏洞。校验不过时**不带 query**，落回默认工作区，不是原样透传。
 *
 * 写成纯函数是为了能穷举：`//evil.com`、`/\evil.com`、`https:` 这三类都要能
 * 在单测里逐个撞一遍，而不是靠一次手工点击。
 */
export function buildLoginLocation(
  fullPath: string | null | undefined,
): string {
  const safe = validateAuthNextPath(fullPath);
  return safe === null
    ? "/login"
    : `/login?redirect=${encodeURIComponent(safe)}`;
}

export function decideAuthNavigation(input: {
  path: string;
  authDisabled: boolean;
  authenticated: boolean;
  /**
   * `/workspace` 之外、但这一次访问确实要登录的路由。
   *
   * 独立产物视窗是唯一一个：它的路径本身不说明任何事，要不要登录取决于
   * query 里指向的是谁的文件——公开演示件放行，别的都要登录。那个判定住在
   * `core/artifacts/viewer.ts`，这里只接受它的结论。
   */
  guarded?: boolean;
}): AuthNavigation {
  if (!input.guarded && !input.path.startsWith("/workspace")) {
    return "allow";
  }
  return input.authDisabled || input.authenticated ? "allow" : "login";
}
