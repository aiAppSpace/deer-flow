/*
  【文件职责】     钉住「mock 里那三条返回完整 channel values 的路由，走的是同一个函数」。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     tests/e2e/utils/mock-api.ts
  【边界与注意】   **后端事实**：`GET /threads/{id}`、`GET /threads/{id}/state`、
                   `POST /threads/{id}/history` 三条都走同一个 accessor 的
                   `aget(config)` 取同一个最新快照，再用同一个
                   `serialize_channel_values_for_api` 序列化——
                   也就是说它们的 `values` **必须是同一份**。
                   `POST /threads/search` 是例外：它只返回 `{title}` 的投影
                   （这条也是实测的，写在 `threadChannelValues` 的注释里）。

                   **为什么要有它（2026-09-12 第十八轮实测）**：
                   `threadChannelValues` 的注释写着「把『完整』抽成一个函数，
                   就是为了让这条后端事实在 mock 里也是结构性的」——
                   **而 `/history` 那条路由自己手抄了第三份，并且已经漂了**。
                   给 mock 补 `todos` 时（真后端一直返回它，产品也读它），
                   `GET /threads/{id}` 与 `/state` 都跟上了，只有 `/history` 没有。

                   后果不是「少一个字段」：**同一个字段两种行为**——
                   本仓读 `/state` 看得见待办列表，上游用 SDK 的 `useStream`
                   从 `/history` 水合、看不见。对照场景当场卡在「React 没能到达」，
                   而在此之前**没有任何机器说得出这两条路由已经不一致**。

                   判据取「三条路由都提到 `threadChannelValues`」加上
                   「文件里没有第二份手拼的 channel values」——后者按**签名**认：
                   一个同时含 `messages:` 与 `artifacts:` 的 `values: {…}` 字面量
                   就是在手拼这份快照。流帧里的 `values: {}` 不带这两个键，天然不收。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const mockApi = readFileSync(
  fileURLToPath(new URL("../e2e/utils/mock-api.ts", import.meta.url)),
  "utf8",
);

/** 一条路由注册到下一条之间的源码。 */
function handlerOf(pattern: string): string {
  const at = mockApi.indexOf(pattern);
  if (at < 0) return "";
  const next = mockApi.indexOf("page.route(", at + pattern.length);
  return mockApi.slice(at, next < 0 ? mockApi.length : next);
}

describe("mock 的完整 channel values 只有一个来源", () => {
  /* 形状断言：路由改名会让下面那条静默全绿（坑 176/195）。 */
  it("三条路由都还在", () => {
    for (const pattern of [
      '"**/api/langgraph/threads/*/state"',
      '"**/api/langgraph/threads/*/history"',
    ]) {
      expect(mockApi, `找不到路由 ${pattern}`).toContain(pattern);
    }
    expect(mockApi).toContain("const threadChannelValues =");
  });

  it("state 与 history 都走 threadChannelValues", () => {
    for (const pattern of [
      '"**/api/langgraph/threads/*/state"',
      '"**/api/langgraph/threads/*/history"',
    ]) {
      expect(
        handlerOf(pattern),
        `${pattern} 没走 threadChannelValues——后端这三条返回的是同一份快照，` +
          "各抄一份就会像第十八轮那样悄悄漂开（同一个字段两种行为）。",
      ).toContain("threadChannelValues(");
    }
  });

  it("文件里没有第二份手拼的 channel values", () => {
    /*
      签名：一个 `values: {` 字面量里同时出现 `messages:` 与 `artifacts:`。
      `POST /threads/search` 的投影只有 `{title, goal}`，不匹配；
      流帧里的 `values: {}` 也不匹配。
    */
    const handwritten = [
      ...mockApi.matchAll(/values:\s*\{([\s\S]{0,900}?)\n\s{0,8}\}/g),
    ]
      .filter(
        (match) =>
          match[1]!.includes("messages:") && match[1]!.includes("artifacts:"),
      )
      .map((match) => mockApi.slice(0, match.index).split("\n").length);
    expect(
      handwritten,
      "这里在手拼一份完整的 channel values——改成调 `threadChannelValues(thread)`。" +
        "（行号见上；第十八轮就是这么漂的。）",
    ).toEqual([]);
  });
});
