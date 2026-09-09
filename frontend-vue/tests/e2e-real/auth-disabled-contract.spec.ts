import { expect, test } from "@playwright/test";

import { AUTH_DISABLED_USER } from "@/core/auth/auth-disabled-user";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3101";

/*
  合成用户必须与真 Gateway 的 `/auth/me` 一致——这条契约存在的意义就是让
  后端漂移不会静默发生。

  2026-09 合并上游时它抓到一条：#5265（project workspaces）给响应加了
  `permissions`，而**两个前端的合成用户和 `User` 类型都没有这个字段**
  （React 那边同样没有，只是它没有这条测试守着）。两边至今都没有任何代码读它，
  所以这里不把它塞进 `User` 类型充数，而是显式列出「后端有、前端有意不建模」
  的字段，并**两个方向都钉住**：

  - 去掉这些字段之后，剩下的必须与 `AUTH_DISABLED_USER` **完全相等**
    ——某个已建模字段变了，照样红；
  - 后端多出来的字段必须**恰好**是这一组——再冒出一个新的没人看过的字段，
    这条依然红，而不是被 `toMatchObject` 那类子集断言悄悄放过。

  什么时候把 `permissions` 收进来：前端真的开始按它做门禁的时候
  （那一刻它就该进 `User` 类型、进合成用户，并从这张表里删掉）。
*/
const UNMODELLED_BY_FRONTEND = ["permissions"] as const;

test.describe("auth-disabled contract (real backend)", () => {
  test("gateway /auth/me returns the frontend synthetic user without a cookie", async ({
    context,
  }) => {
    const resp = await context.request.get(`${APP}/api/v1/auth/me`);

    expect(resp.status(), await resp.text()).toBe(200);
    const body = (await resp.json()) as Record<string, unknown>;

    const extra = Object.keys(body)
      .filter((key) => !(key in AUTH_DISABLED_USER))
      .sort();
    expect(
      extra,
      "后端多出了前端没建模的字段：要么建模它，要么在 UNMODELLED_BY_FRONTEND 里写明为什么不建",
    ).toEqual([...UNMODELLED_BY_FRONTEND].sort());

    const modelled = Object.fromEntries(
      Object.entries(body).filter(
        ([key]) => !(UNMODELLED_BY_FRONTEND as readonly string[]).includes(key),
      ),
    );
    expect(modelled).toEqual(AUTH_DISABLED_USER);
  });
});
