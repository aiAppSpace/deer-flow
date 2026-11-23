/*
  【文件职责】     钉住「场景里每一个 UUID 形状的夹具 id 都登记进了 KNOWN_IDS」。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/e2e-parity/support/capture.ts · scenarios.ts · e2e/utils/mock-api.ts
  【边界与注意】   为什么要有它：`normalizeRequest` 把「UUID 形状且不在 `KNOWN_IDS` 里」
                   的路径段抹成 `«generated»`。那条规则是为了吃掉**客户端随机生成**的
                   id，但它对**夹具** id 一样有效——两个应用请求了不同的夹具线程，
                   归一之后会变成同一个字符串，**差异就此消失**（硬规则 2：
                   每一条归一化都在抹掉信息）。

                   wave 120 实测：`support/` 下六个 UUID 字面量里**有三个没登记**
                   （两个历史线程 id + workspace-changes 的 run id）。它们当时没造成
                   假绿（两个应用请求的是同一个），但那是运气，不是判据。

                   **双向**：没登记的要红（正方向），登记了却在源码里找不到的也要红
                   （反方向，死配置——线索 186）。**零豁免**：真有一个「必须被当成
                   客户端生成」的 UUID 字面量出现时，把它挪出这几份文件，
                   而不是在这里开口子。
*/

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { KNOWN_IDS } from "../../e2e-parity/support/capture";

const SOURCES = [
  "../../../shared/showcase.ts",
  ...readdirSync(new URL("../../e2e-parity/support/", import.meta.url))
    .filter((name) => name.endsWith("-scenarios.ts"))
    .map((name) => `../../e2e-parity/support/${name}`),
  "../../e2e-parity/support/scenarios.ts",
  "../../e2e-parity/support/fixture-thread.ts",
  "../../e2e/utils/mock-api.ts",
];

const UUID_LITERAL =
  /"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/gi;

const text = SOURCES.map((rel) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"),
).join("\n");

const literals = [
  ...new Set([...text.matchAll(UUID_LITERAL)].map((m) => m[1]!)),
];

describe("对照取样的夹具 id", () => {
  it("形状先断言：真的扫到了一批 UUID 字面量", () => {
    expect(
      literals.length,
      "一个 UUID 字面量都没扫到——取法失效了，下面两条会变成算不出来的 0",
    ).toBeGreaterThan(3);
  });

  it("每一个都登记进了 KNOWN_IDS", () => {
    const missing = literals.filter((id) => !KNOWN_IDS.has(id));
    expect(
      missing,
      "这些夹具 id 会被 normalizeRequest 抹成 «generated»——" +
        "两个应用请求了不同的它，差异会消失。补进 KNOWN_IDS",
    ).toEqual([]);
  });

  it("KNOWN_IDS 里没有死条目", () => {
    const stale = [...KNOWN_IDS].filter((id) => !literals.includes(id));
    expect(
      stale,
      "这些 id 在场景与 mock 源码里已经找不到了：删掉，别留死配置",
    ).toEqual([]);
  });
});
