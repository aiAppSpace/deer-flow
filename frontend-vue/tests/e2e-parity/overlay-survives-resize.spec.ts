/*
  【文件职责】     缩窗口跨过断点之后，**还开着的浮层必须还能用**——在视口里，且仍贴着可见的触发器。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts 的 runScenario · support/settle.ts · support/context-options.ts
  【边界与注意】   **两个应用都跑**，理由同 keyboard-trap：台账只报「两边不一致」，
                   单边回归没有门禁看得见。

                   **不变量直接说出来**：

                       把窗口缩过断点之后，凡是还开着的浮层，
                       都必须整个在视口里，并且仍贴着一个可见的触发器。

                   React ChatBox 与 Vue WorkspacePanels 都保持聊天子树的稳定 owner。
                   旧 React mobile early return 引发的重挂和浮层丢失已由
                   chat-box-responsive-owner DOM 回归及 chat-state-resize 双端回归
                   覆盖，不能再把自动关闭写成允许的端差异。
                   本量具继续验证已经打开的浮层几何，并对两个应用分别要求实际
                   命中过断点后仍打开的浮层；dialog 的数量另由 combined-reflow 守卫。

                   ⚠ **量之前要先确认缩到位了**：`runScenario` → `applyDimension`
                   会 `setViewportSize(VIEWPORTS[...])`，所以缩窗口必须放在
                   `runScenario` **之后**（第五十二轮踩过：`PROBE_WIDTH` 是死的）。
                   这里把缩完的 `innerWidth` 读回来断言。

                   ⚠ **变异验证做过**（签入前必做）：把 `MAX_GAP_PX` 从 64 调到 0，
                   这条门禁当场红并报出 `离触发器 37px` / `离触发器 4px`，
                   且「跑不到位」清零；还原后绿。**它不是潜在守卫。**

                   ⚠ **第一次变异跑红的是门禁自己**：`survey()` 序列化到浏览器里跑，
                   闭包不到模块作用域，于是把内联的 64 「整理」成具名常量之后
                   每个终态都抛 `ReferenceError`。**抓到它的是那条「跑不到位清零」的
                   反空转断言**——没有它，`broken` 会一直是空数组，这条门禁
                   **绿着交付而什么都没验**。门限因此改成按参数传。

                   ⚠ **「浮层数没变」有歧义**（第五十三轮踩过）：它同时覆盖
                   「1→1 浮层扛住了」与「0→0 这屏压根没开过浮层」，含义相反。
                   所以这里记的是**每一格缩前缩后的数**，不是只记变化。
*/

import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyOverlayGeometry as survey } from "./support/overlay-survey";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

/** 缩到窄屏那一档；375 是受支持档里最窄的（320 不在受支持档，见交接文档）。 */
const NARROW = { width: 375, height: 812 };

/*
  间距门限。浮层贴着触发器时是 anchor 的偏移量，第五十三轮实测本仓那 5 条
  是 0 / 4 / 4 / 37 / （抽屉无触发器）。37 那条是模型选择器的对话框，
  它本来就不是紧贴的 popper。**64 给足余量**——这条门禁要抓的是「飘到几百像素外」，
  不是「偏了几个像素」。
*/
const MAX_GAP_PX = 64;

/*
  ⚠ **门限要当参数传进来，不能闭包外面的常量**：这个函数是序列化到浏览器里跑的，
  `page.evaluate` 里够不到模块作用域（第五十三轮踩过——把内联的 64 "整理"成
  具名常量之后，每个终态都抛 `ReferenceError`，是反空转断言把它抓出来的）。
*/

for (const [name, base] of APPS) {
  test(`${name}: 缩过断点后还开着的浮层仍然可用`, async ({ browser }) => {
    // Every registered terminal state must finish before the global deadline.
    // Stage19 exhausted the old 15-minute cap; preserve all per-step assertions.
    const registeredStates = PARITY_SCENARIOS.reduce(
      (count, scenario) => count + scenarioStates(scenario).length,
      0,
    );
    test.setTimeout(Math.max(900_000, registeredStates * 15_000));
    const broken: string[] = [];
    const unreachable: string[] = [];
    /** 反空转之一：至少有一格在缩完之后**真的还开着浮层**，否则这条门禁什么都没验。 */
    let stillOpenSomewhere = 0;
    /** 反空转之二：缩窗口到底落地没有。 */
    const widths = new Set<number>();
    let scanned = 0;

    for (const scenario of PARITY_SCENARIOS)
      for (const state of scenarioStates(scenario)) {
        const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
        const dimension =
          state.dimensions?.[0] ??
          scenario.dimensions?.[0] ??
          DEFAULT_DIMENSION;
        /* 本来就是窄屏那一档的终态没有「缩过断点」可言。 */
        if (dimension.viewport === "mobile") continue;
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        try {
          await runScenario(page, base, scenario, dimension, state, 30_000);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const before = await page.evaluate(survey, MAX_GAP_PX);
          /* 这屏压根没开浮层的话，缩不缩都没有可验的东西。 */
          if (!before.count) {
            scanned += 1;
            continue;
          }
          /* ⚠ 必须在 runScenario 之后——applyDimension 会覆盖 viewport。 */
          await page.setViewportSize(NARROW);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const after = await page.evaluate(survey, MAX_GAP_PX);
          widths.add(after.innerWidth);
          if (after.count) stillOpenSomewhere += 1;
          for (const problem of after.bad) broken.push(`${key}: ${problem}`);
          scanned += 1;
        } catch (error) {
          unreachable.push(
            `${key}: ${String(error).split("\n")[0]?.slice(0, 90)}`,
          );
        } finally {
          await context.close();
        }
      }

    expect(
      broken,
      "缩过断点之后这些浮层还开着，但已经不能用了——跑出视口、触发器没了、或者飘得离触发器很远。" +
        "⚠ 修法**不是**让它跟着关（那是照抄上游重挂树的副作用，见文件头），" +
        "而是让它跟着触发器重新定位",
    ).toEqual([]);
    expect(
      unreachable,
      "这些终态跑不到位，门禁什么都没量到（空转就是失守）",
    ).toEqual([]);
    expect(scanned, "一个终态都没量到").toBeGreaterThan(0);
    expect(
      [...widths],
      `缩窗口没落地：缩完读回的 innerWidth 应当只有 ${NARROW.width}`,
    ).toEqual([NARROW.width]);
    expect(
      stillOpenSomewhere,
      `${name} 缩完之后一个浮层都没留下，几何门禁没有验证到实际打开的浮层`,
    ).toBeGreaterThan(0);
  });
}
