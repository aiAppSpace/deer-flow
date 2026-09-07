/*
  【文件职责】     把场景目录在两个应用上各跑一遍，证明每个场景两边都到得了。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts · support/react-preview.ts
  【边界与注意】   这里**仍然不做**差异比对。它回答的是比对的前置问题：这个场景在
                   两个应用上是不是同一个可达状态？答案为否时，比对层看到的会是一堆
                   「一边超时了」造成的噪声，而不是真差异。

                   一个场景在一边到得了、另一边到不了，本身就是一处真差异——通常是
                   测试锚点（data-testid、可访问名）没对齐。让它在这一层红，
                   比让它在截图 diff 里表现成一整屏不同要好定位得多。
*/

import { expect, test, type Page } from "@playwright/test";

import { reactAppPresent } from "./support/react-preview";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
  type ParityDimension,
} from "./support/scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

function label(dimension: ParityDimension) {
  return `${dimension.viewport}/${dimension.theme}/${dimension.locale}`;
}

for (const scenario of PARITY_SCENARIOS) {
  for (const state of scenarioStates(scenario))
    // 终态可以自己钉断点（wave 147），不写就沿用场景那一层的。
    for (const dimension of state.dimensions ??
      scenario.dimensions ?? [DEFAULT_DIMENSION]) {
      const name = state.id ? `${scenario.id}#${state.id}` : scenario.id;
      test(`${name} · ${label(dimension)} · 两个应用都到得了`, async ({
        page,
        context,
      }) => {
        // 一个应用一个 page：mock 路由、init script 和视口都是 page 级状态，
        // 复用同一个 page 会让第二个应用带着第一个的残留。
        const vuePage: Page = page;
        const reactPage = await context.newPage();

        await expect(
          runScenario(vuePage, VUE_APP, scenario, dimension, state),
          `Vue 没能到达场景 ${name}（${label(dimension)}）`,
        ).resolves.toBeTruthy();

        await expect(
          runScenario(reactPage, REACT_APP, scenario, dimension, state),
          `React 没能到达场景 ${name}（${label(dimension)}）`,
        ).resolves.toBeTruthy();

        await reactPage.close();
      });
    }
}
