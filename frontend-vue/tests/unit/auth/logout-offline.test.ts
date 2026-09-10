/*
  【文件职责】     守住「Gateway 连不上时也要退得掉」。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     app/core/auth/logout.ts
  【边界与注意】   这一条是 wave 38 复量翻出来的：交接文档把 `workspace.logout` 归进
                   「落地页与静态整站模式在对齐范围之外」——**归错了**，它是上游
                   `gateway-offline-banner.tsx:126` 那颗按钮，长在工作区的掉线横幅上。

                   两处叠加起来才是完整的缺陷：① 本仓那条横幅上只有「重试」，
                   而重试治不了「会话本身坏了」；② 本仓唯一的退出入口（设置 → 账户）
                   在 POST 失败时**就地放弃**，只显示一行错误。合起来就是
                   「会话坏了 + 后端不通 → 没有任何出路」。

                   上游 `AuthProvider.tsx:117` 的注释写得很清楚：失败时硬跳转，
                   `matching the legacy form-POST logout behaviour during a gateway outage`。

                   对照台账看不见：横幅只在 session 是 `unavailable` 时渲染（第⑥类）。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { performLogout } from "@/core/auth/logout";

function ports(post: () => Promise<{ ok: boolean }>) {
  return {
    post,
    navigate: vi.fn(),
    hardNavigate: vi.fn(),
    queryClient: { clear: vi.fn() },
  };
}

describe("performLogout", () => {
  it("signs out and routes normally when the gateway answers", async () => {
    const p = ports(async () => ({ ok: true }));
    await expect(performLogout(p)).resolves.toBe("signed-out");

    expect(p.navigate).toHaveBeenCalledWith("/login");
    expect(p.hardNavigate).not.toHaveBeenCalled();
  });

  /*
    非 2xx 与抛异常是同一支：**都已经登出**，只是走硬跳转。
    只测 ok 那一支的话，退回 `if (!ok) return;` 也是绿的。
  */
  it.each([
    ["a non-2xx answer", async () => ({ ok: false })],
    [
      "a network failure",
      async () => {
        throw new Error("offline");
      },
    ],
  ])("still forces the user out on %s", async (_label, post) => {
    const p = ports(post as () => Promise<{ ok: boolean }>);
    await expect(performLogout(p)).resolves.toBe("forced-out");

    // 本地态无论哪一支都要清掉，否则旧用户的数据会留在 Query 树里。
    expect(p.queryClient.clear).toHaveBeenCalledTimes(1);
    // 硬跳转，不是客户端路由：这一支的前提就是「后端状态不可信」。
    expect(p.hardNavigate).toHaveBeenCalledWith("/login");
    expect(p.navigate).not.toHaveBeenCalled();
  });
});

/*
  纯函数对了还不够：**两个调用点都得真的走它**，而这一点上面那几条用例看不见
  （wave 38 的负向验证里「设置里的登出绕开共享实现」「横幅上去掉退出键」都是假绿）。
  行为验收在 `tests/e2e-auth/auth-contract.spec.ts` 那条「后端也 503 时仍然退得掉」，
  这里只钉「两处都还在」——挂载那两个组件要连上 Query 与 Nuxt 上下文，代价远大于收益。
*/
describe("退出的两个入口", () => {
  const sourceOf = (relative: string) =>
    readFileSync(
      fileURLToPath(new URL(`../../../${relative}`, import.meta.url)),
      "utf8",
    ).replaceAll(/<!--[\s\S]*?-->/g, "");

  it.each([
    "app/components/workspace/settings/AccountSettings.vue",
    "app/components/workspace/GatewayStatusBanner.vue",
  ])("%s 走共享的 performLogout", (file) => {
    expect(sourceOf(file)).toContain("performLogout({");
  });

  /* 掉线横幅上那颗按钮本身：上游 gateway-offline-banner.tsx:119 唯一的那颗。 */
  it("keeps the sign-out button on the offline banner", () => {
    expect(
      sourceOf("app/components/workspace/GatewayStatusBanner.vue"),
    ).toContain("$i18n.t.value.workspace.logout");
  });
});
