/*
  【文件职责】     跑完同一串交互之后，两个应用停在**同一个滚动位置**。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts 的 runScenario · support/react-preview.ts
  【边界与注意】   **这条门禁守的是 `runScenario` 里那道「交互前等开场动画」**
                   （理由与全部读数写在 scenarios.ts 该处），不是守某个像素值。

                   为什么不能让对照台账自己守：台账在这上面**是飘的**——
                   四次 Linux 读数 2/3/0/3 行。它飘是因为分岔取决于两个应用各自的
                   chunk 什么时候就位，而不是取决于应用有没有改坏。一条偶发红的
                   门禁会被当成噪音忽略掉，等于没有门（记忆
                   `deerflow-gate-needs-an-entrypoint` 的同一形状）。
                   这里换成直接量那个**确定的**量：滚动位置。

                   **断言两边相等，不断言等于某个数**：滚动量取决于内容高度，
                   而内容高度会随文案与字体变；「两边一样」不会。
                   去掉 scenarios.ts 那道等待，本机实测这条立刻变成
                   `vue 460 / react 411` 而红——做过变异验证。
*/

import { expect, test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { reactAppPresent } from "./support/react-preview";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

/*
  挑 `integrations#permission-request`：它是唯一一个**实测**在这上面分岔过的终态
  （三个交互步骤，第一步就把两边滚到不同位置）。一个场景够了——守的是
  `runScenario` 的行为，不是这一屏。
*/
test("同一串交互跑完，两个应用停在同一个滚动位置", async ({ browser }) => {
  test.setTimeout(180_000);

  const measured: Record<string, number> = {};
  for (const [app, base] of [
    ["vue", VUE_APP],
    ["react", REACT_APP],
  ] as const) {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    const scenario = PARITY_SCENARIOS.find((s) => s.id === "integrations")!;
    const state = scenarioStates(scenario).find(
      (s) => s.id === "permission-request",
    )!;
    await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);

    const scrollTop = await page.evaluate(() => {
      const viewport = document
        .querySelector("[role=dialog]")
        ?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
      if (!viewport) throw new Error("设置对话框里没有可滚动的取景框");
      return Math.round(viewport.scrollTop);
    });
    measured[app] = scrollTop;
    await context.close();
  }

  expect(
    measured.vue,
    `跑完同一串交互后滚动位置分岔了（vue=${measured.vue} react=${measured.react}）：` +
      "多半是 runScenario 那道「交互前等开场动画」没了，于是 Playwright 的 " +
      "scroll-into-view 骑在 zoom-in-95 上按不同的几何算滚动量",
  ).toBe(measured.react);
});
