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

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
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
        browser,
      }) => {
        /*
          **一个应用一个 context，不是一个 page**（第二十轮改的，同 diff.spec）。

          原来这里是 `context.newPage()`，注释写的理由是「mock 路由、init script
          和视口都是 **page 级**状态」——**范围比实际需要的窄**：cookie 是
          **context 级**的，而两个应用把侧栏收起态存在**同名** cookie
          `sidebar_state` 里（上游 `sidebar.tsx:28`，本仓
          `useWorkspaceSidebar.restoreFromCookie`）。于是先跑的 Vue 一收起，
          后跑的 React 就带着 `sidebar_state=false` 开局——**开局状态被上一个
          应用改掉了**，再点一下反而展开。

          实测现场：`sidebar-collapsed` 这条场景两个维度都红，截图里
          Vue 收起、React 展开，看起来像产品差异，其实是夹具串味。
          `diff.spec` 一直是一应用一 context，所以台账那边从没中招。
        */
        const vueContext = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const reactContext = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const vuePage: Page = await vueContext.newPage();
        const reactPage: Page = await reactContext.newPage();

        try {
          await expect(
            runScenario(vuePage, VUE_APP, scenario, dimension, state),
            `Vue 没能到达场景 ${name}（${label(dimension)}）`,
          ).resolves.toBeTruthy();

          await expect(
            runScenario(reactPage, REACT_APP, scenario, dimension, state),
            `React 没能到达场景 ${name}（${label(dimension)}）`,
          ).resolves.toBeTruthy();
        } finally {
          await vueContext.close();
          await reactContext.close();
        }
      });
    }
}
