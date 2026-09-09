/*
  【文件职责】     离线钉住 audit 分诊表的**形状**，以及它确实被 `make audit` 读着。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     baseline/audit-triage.json · scripts/audit-triage.mjs · Makefile
  【边界与注意】   **这里不跑 `pnpm audit`**（要网络，`make verify` 必须离线可跑）。
                   「表里的包 == audit 实际报的包」由 `make audit` 在联网时查；
                   这里查的是另一半——**表本身是不是还有意义**：

                   ① 每条都有 reachability / decision / why / revisit，且都不为空。
                      **`revisit` 必填不是形式主义**：wave 201 刚证明过一次——
                      wave 107 那条「有意不钉」是靠留下的翻案判据在四轮后被推翻并补上的。
                      只写结论、不写「什么时候该重新问一次」，等于把它埋了。
                   ② `make audit` 真的走 `scripts/audit-triage.mjs`。
                      不查这一条的话，有人把 Makefile 改回裸 `pnpm audit`，
                      这张表就变成一份没有任何消费者的文档——**本仓已经撞见过
                      「零消费者的表」两次**（wave 83 那张 17 条里 2 条是假的）。
                   ③ runtime 的那几条**必须**写清判据：进产物的包才是真有风险面的，
                      它们的 why 短于一句话就说明没查。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const triage = JSON.parse(
  readFileSync(
    new URL("../../baseline/audit-triage.json", import.meta.url),
    "utf8",
  ),
) as {
  packages: {
    package: string;
    entry: string;
    reachability: "runtime" | "build" | "dev";
    decision: "accept" | "hold";
    why: string;
    revisit: string;
  }[];
};
const makefile = readFileSync(`${ROOT}Makefile`, "utf8");

describe("audit 分诊表", () => {
  it("形状先断言：表非空", () => {
    expect(triage.packages.length).toBeGreaterThan(3);
  });

  it.each(triage.packages)(
    "$package 四个字段都在，且都不是敷衍的空话",
    (row) => {
      expect(["runtime", "build", "dev"]).toContain(row.reachability);
      expect(["accept", "hold"]).toContain(row.decision);
      expect(row.entry.length, `${row.package} 没写从哪进来的`).toBeGreaterThan(
        0,
      );
      expect(
        row.why.length,
        `${row.package} 的 why 太短——写不出判据就说明还没查清楚`,
      ).toBeGreaterThan(40);
      expect(
        row.revisit.length,
        `${row.package} 没写翻案判据：什么时候该重新问一次？`,
      ).toBeGreaterThan(10);
    },
  );

  it("包名不重复、按字典序", () => {
    const names = triage.packages.map((row) => row.package);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort());
  });

  it("进产物的那几条，判据要更长——它们才是真有风险面的", () => {
    const runtime = triage.packages.filter(
      (row) => row.reachability === "runtime",
    );
    expect(
      runtime.length,
      "一条 runtime 都没有？先确认解析没坏",
    ).toBeGreaterThan(0);
    for (const row of runtime) {
      expect(
        row.why.length,
        `${row.package} 会进客户端产物，why 不能只有一句话`,
      ).toBeGreaterThan(80);
    }
  });

  it("make audit 确实走分诊脚本，不是裸 pnpm audit", () => {
    const commands = makefile
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .filter((line) => line.includes("audit"));
    expect(
      commands.some((line) => line.includes("scripts/audit-triage.mjs")),
      "Makefile 里找不到对分诊脚本的调用",
    ).toBe(true);
    expect(
      commands.filter((line) => /\bpnpm\b.*\baudit\b/.test(line)),
      "有人把 audit 改回裸 pnpm audit 了——那张分诊表就没有消费者了",
    ).toEqual([]);
  });
});
