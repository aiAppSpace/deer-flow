/*
  【文件职责】     台账字段表三方对账：类型、报告脚本、签入基线。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     tests/e2e-parity/support/ledger.ts · scripts/parity-ledger-report.mjs ·
                   baseline/parity-diff.json
  【边界与注意】   **这份表漂过，而且漂了很久没人发现。**
                   `scripts/parity-ledger-report.mjs` 自己抄了一份字段表，停在 5 个，
                   而 `DiffEntry` 已经有 11 个——于是那个报告把 focus / order /
                   tabbables / tabOrder / depth **六档一行都没算**，还照样打印出一个
                   像模像样的总数。那个文件头当时就写着「多一个少一个都要在这里显式加」，
                   **而没有任何机器在守那句话**。

                   为什么不写成类型层断言：`tests/` 整棵树不在 `make typecheck` 的
                   include 里（Nuxt 的 tsconfig 只收 `app/**` 与 `tests/nuxt/**`）。
                   实测把字段表改少一个、改多一个假字段，`vue-tsc` 两次都是绿的。
                   在这里写类型断言等于写了个不会执行的注释。

                   为什么读脚本的**源码**而不是 import 它：那个脚本是 CLI，
                   import 即执行——它会去读 test-results/、打印、并 `process.exit`。

                   第三方是**签入的基线本身**：字段表说得再一致，如果基线里真实
                   出现的字段不是这些，两边一起错也照样全绿。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DIFF_ENTRY_FIELDS } from "../e2e-parity/support/ledger";

const scriptSource = readFileSync(
  fileURLToPath(
    new URL("../../scripts/parity-ledger-report.mjs", import.meta.url),
  ),
  "utf8",
);

const baseline = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../baseline/parity-diff.json", import.meta.url)),
    "utf8",
  ),
) as { entries: Record<string, Record<string, string[]>> };

/** 从脚本源码里把 `export const FIELDS = [...]` 的成员抠出来。 */
function fieldsDeclaredInScript(): string[] {
  const block = /export const FIELDS = \[([\s\S]*?)\];/.exec(scriptSource);
  if (!block) throw new Error("脚本里找不到 FIELDS 声明——它改名或改写法了");
  return [...block[1]!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
}

describe("台账字段表三方一致", () => {
  const inScript = fieldsDeclaredInScript();
  const baselineEntries = Object.values(baseline.entries);

  it("形状先断言：三边都真的读到了东西", () => {
    // 少了这条，正则失配或基线读空都会让下面三条在空集上恒绿。
    expect(DIFF_ENTRY_FIELDS.length).toBeGreaterThanOrEqual(10);
    expect(inScript.length).toBeGreaterThanOrEqual(10);
    expect(baselineEntries.length).toBeGreaterThanOrEqual(50);
  });

  it("报告脚本的字段表 = DiffEntry 的字段表", () => {
    expect(
      [...inScript].sort(),
      "脚本少一个字段就是那一档差异**一行都不算**，而总数照样打得出来",
    ).toEqual([...DIFF_ENTRY_FIELDS].sort());
  });

  it("签入基线里每条记录的字段就是这一份表", () => {
    const expected = [...DIFF_ENTRY_FIELDS].sort();
    const wrong = Object.entries(baseline.entries)
      .filter(
        (entry) =>
          JSON.stringify(Object.keys(entry[1]).sort()) !==
          JSON.stringify(expected),
      )
      .map((entry) => entry[0]);
    expect(
      wrong,
      "基线里的记录和字段表对不上——两边一起错的话，光比表是比不出来的",
    ).toEqual([]);
  });
});
