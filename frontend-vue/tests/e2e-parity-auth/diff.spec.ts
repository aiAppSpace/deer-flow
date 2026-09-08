/*
  【文件职责】     把开着鉴权才到得了的那几屏在两个应用上比出差异，钉住一份只能缩短的清单。
  【架构位置】     对照套件（e2e-parity-auth）
  【主要导出】     无；Playwright 用例
  【依赖关系】     ../e2e-parity/support/diff-entry（**与主套件同一把尺子**）· scenarios ·
                   baseline/parity-auth-diff.json
  【边界与注意】   判词**不在这里定义**，从 e2e-parity/support/diff-entry.ts 取。照抄一份会让
                   这个工厂有两把尺子，而两把不一样的尺子比没有尺子更糟（wave 190）。

                   baseline 与主套件**分开一份**：两套跑的是不同的构建（auth 开 / 关），
                   写同一份文件的话，谁后跑谁就把对方的条目抹掉。

                   刷新：`make parity-auth-accept`，与主套件同一条纪律——accept 逐行比对新旧，
                   **有新增行就拒写**，真要接受得 `PARITY_ACCEPT_GROW=1` 再跑一次。
*/
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { captureScenario } from "../e2e-parity/support/capture";
import { PARITY_CONTEXT_OPTIONS } from "../e2e-parity/support/context-options";
import { buildDiffEntry } from "../e2e-parity/support/diff-entry";
import { addedRows, type DiffEntry } from "../e2e-parity/support/ledger";
import { reactAppPresent } from "../e2e-parity/support/react-preview";
import {
  DEFAULT_DIMENSION,
  scenarioStates,
} from "../e2e-parity/support/scenarios";
import { AUTH_PARITY_SCENARIOS } from "./scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3117";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3118";
const ACCEPT = process.env.PARITY_ACCEPT === "1";
const ACCEPT_GROW = process.env.PARITY_ACCEPT_GROW === "1";

const BASELINE = new URL(
  "../../baseline/parity-auth-diff.json",
  import.meta.url,
);

/**
 * 两棵可访问性树至少要有这么多**公共行**，这次取样才算「两个应用在比同一屏」。
 *
 * wave 191 录到过一份「两边完全不同」的基线：React 停在登录表单、Vue 因为夹具
 * 把它当成已登录而跳去了工作区。那份东西**每一档都满是行、看起来像一份丰收的
 * 差异清单**，实际上记的是「我把两个应用放在了不同的屏上」。
 * 差异清单长成那样时，正确的反应不是签收，是**当场红**。
 *
 * 8 是量出来的下限：登录页两边公共行实测 20 行以上（wave 193）。
 */
const MIN_SHARED_ARIA_LINES = 8;

function sharedAriaLines(react: string, vue: string): number {
  const vueLines = new Set(
    vue
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return react
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && vueLines.has(line)).length;
}

test.skip(!reactAppPresent, "兄弟应用不在 checkout 里，整组跳过");

test("开着鉴权那几屏的双向差异都与签入的清单一致", async ({ browser }) => {
  test.setTimeout(600_000);

  const entries: Record<string, DiffEntry> = {};
  for (const scenario of AUTH_PARITY_SCENARIOS) {
    for (const state of scenarioStates(scenario))
      for (const dimension of state.dimensions ??
        scenario.dimensions ?? [DEFAULT_DIMENSION]) {
        // 一个取样点一个 context，理由与主套件同：样本的差异只能来自被测应用。
        const vueContext = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const reactContext = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const vuePage: Page = await vueContext.newPage();
        const reactPage: Page = await reactContext.newPage();
        const vue = await captureScenario(
          vuePage,
          VUE_APP,
          scenario,
          dimension,
          state,
        );
        const react = await captureScenario(
          reactPage,
          REACT_APP,
          scenario,
          dimension,
          state,
        );
        await vueContext.close();
        await reactContext.close();

        const suffix = state.id ? `#${state.id}` : "";
        const key = `${scenario.id}${suffix}/${dimension.viewport}/${dimension.theme}/${dimension.locale}`;

        expect(
          sharedAriaLines(react.aria, vue.aria),
          `${key}：两个应用的可访问性树几乎没有公共行，这不是「差异很多」，` +
            `是它们根本不在同一屏上——先弄清楚谁跳走了，再谈比对。`,
        ).toBeGreaterThanOrEqual(MIN_SHARED_ARIA_LINES);

        entries[key] = buildDiffEntry(react, vue);
      }
  }

  if (ACCEPT) {
    mkdirSync(dirname(fileURLToPath(BASELINE)), { recursive: true });
    const previous = existsSync(fileURLToPath(BASELINE))
      ? (
          (await import(BASELINE.href, { with: { type: "json" } })).default as {
            entries: Record<string, DiffEntry>;
          }
        ).entries
      : {};
    const added = addedRows(previous, entries);
    if (!ACCEPT_GROW) {
      expect(
        added,
        "台账只能缩短，而这次 accept 会**新增**下面这些行。先逐条弄清楚是新坏的" +
          "还是有意接受的；确实要接受就 PARITY_ACCEPT_GROW=1 再跑一次，" +
          "并在提交说明里写清楚每一行是什么。基线这次没有被改写。",
      ).toEqual([]);
    }
    writeFileSync(
      fileURLToPath(BASELINE),
      JSON.stringify(
        {
          $comment:
            "React 与 Vue 在**开着鉴权**才到得了的那几屏上的双向差异（登录、安装向导）。" +
            "主对照套件用的是关掉鉴权的构建，那两屏在它那里会直接跳走——wave 189 实测。" +
            "这份清单与 parity-diff.json 同一条纪律：只能缩短，刷新用 make parity-auth-accept。",
          entries,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  expect(
    existsSync(fileURLToPath(BASELINE)),
    "基线不存在：先跑一次 make parity-auth-accept",
  ).toBe(true);
  const baseline = (await import(BASELINE.href, { with: { type: "json" } }))
    .default as { entries: Record<string, DiffEntry> };

  expect(
    entries,
    "对照差异与 baseline/parity-auth-diff.json 不一致：修好的从清单里删掉，" +
      "新出现的先弄清楚是真差异还是取样不稳定。",
  ).toEqual(baseline.entries);
});
