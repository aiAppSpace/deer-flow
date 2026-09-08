/*
  【文件职责】     把每个场景在两个应用上的样本比出差异，并钉住一份只能缩短的清单。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/capture.ts · support/scenarios.ts · baseline/parity-diff.json
  【边界与注意】   这就是「还差哪些」的机器答案。它**不是**一份写在散文里的清单，
                   因为散文清单会先于代码过期，也会被下一个读者当成已经决定不做的东西。

                   钉的是差异本身而不是差异条数。条数只能告诉你「变多了」，
                   而清单能告诉你变的是哪一条；更重要的是，条数相同、内容全换了
                   这种情况，按条数比对完全看不见。

                   一次跑完全部场景写进**一份**基线，是为了让「某个场景消失了」
                   和「某个场景多出来了」同样会红。分成一个场景一份文件的话，
                   删掉一份文件是静默的。

                   刷新基线：`make parity-accept`。刷新前先看清楚每一条变化是修好了
                   还是新坏了——accept 只是记录，不是判断。
*/

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { captureScenario, sampleGeometry } from "./support/capture";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { reactAppPresent } from "./support/react-preview";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  type ParityState,
  scenarioStates,
  locateTarget,
  runScenario,
  type ParityDimension,
} from "./support/scenarios";

import { type DiffEntry, addedRows } from "./support/ledger";
import { buildDiffEntry, countPseudoSamples } from "./support/diff-entry";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";
const ACCEPT = process.env.PARITY_ACCEPT === "1";
/**
 * 明知台账会变长、仍然要写进去时的开关。
 *
 * **「这份清单只能缩短」此前是一句纯散文**：`make parity-accept` 无条件覆盖基线，
 * 没有任何东西比对新旧（wave 85 量出来的；同一句话在
 * `baseline/parity-scenario-coverage.json` 与 `support/scenarios.ts` 里还各有一份）。
 * Makefile 里那句「否则这个目标会变成把回归洗白的按钮」说的正是这件事，
 * 而它一直只靠人记得。
 *
 * 现在把它挡在**唯一能让台账变长的那条路**上：accept 时逐行比对，
 * 有新增行就拒写并把它们打出来。真要接受（比如接上一档新尺子、量出一批
 * 此前看不见的差异），`PARITY_ACCEPT_GROW=1 make parity-accept`，
 * 并在提交说明里写清楚每一行是什么。
 */
const ACCEPT_GROW = process.env.PARITY_ACCEPT_GROW === "1";

const BASELINE = new URL("../../baseline/parity-diff.json", import.meta.url);
const REPORT = new URL(
  "../../test-results/e2e-parity/report.json",
  import.meta.url,
);

/**
 * 几何容差。
 *
 * 不能要求逐像素相等：两边的 primitive 各有自己的内边距与边框实现，那正是
 * ARCHITECTURE 里只对齐可观察行为的三处之一。但也不能没有判据。
 *
 * 2px 是先定后测的，数字一直没动过；下面这组事实随台账重测一次。当前 32 处位置/
 * 尺寸差异里最小的 |Δ| 是 4px（channels 的两行、browser-feature 的宽高），最大 528px，
 * **2~4px 这一档一条都没有**——也就是说这个阈值仍然没有压住任何贴边的东西，它挡掉的
 * 只会是真正的零头。哪天有差异落进这一档，要做的是回去看那一处，而不是顺手把数字调大。
 *
 * 阈值挡掉的零头现在有一处有名有姓：artifact 面板那条路径的锚点，React 的布局位置是
 * 193、Vue 是 192（React 侧那个 `overflow:hidden` 的行容器内容高 52、盒子高 50，
 * 被滚了 1px）。此前两边都量成 192，因为视口坐标把那 1px 滚动一起量了进去。
 */

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

/**
 * 台账的键。
 *
 * 有具名终态时插一段 `#终态`；没有 `states` 的场景键**逐字不变**——
 * 加这一档不能让既有的 39 个样本换名字（换了名字，台账会一次报出
 * 「全部消失 + 全部新增」，而那和真差异长得一模一样）。
 */
function key(
  scenarioId: string,
  state: ParityState,
  dimension: ParityDimension,
) {
  const suffix = state.id ? `#${state.id}` : "";
  return `${scenarioId}${suffix}/${dimension.viewport}/${dimension.theme}/${dimension.locale}`;
}

test("每个场景的双向差异都与签入的清单一致", async ({ browser }) => {
  test.setTimeout(600_000);

  const entries: Record<string, DiffEntry> = {};
  /*
    伪元素那一档**取到了东西**的锚点数。

    这一档在干净树上是 0 行——而 0 行有两种：**算出来的 0** 和**没算的 0**。
    `pseudo()` 里但凡写错一句（比如把 `content` 的判断写反、或者
    `getComputedStyle` 少传第二个参数），它会永远返回 `none`，两边一致，
    台账 0 行，**而且没有任何一条用例会红**（线索 131 的形状：
    尺子坏了会让它守的那件事静默全绿）。
    所以这里数一下真的采到伪元素的锚点，下面断言它不是 0。
  */
  let pseudoSamples = 0;

  for (const scenario of PARITY_SCENARIOS) {
    for (const state of scenarioStates(scenario))
      for (const dimension of state.dimensions ??
        scenario.dimensions ?? [DEFAULT_DIMENSION]) {
        /*
        一个场景一个 context，不是一个 page。

        起初两个 page 共用整条用例的 context，实测在 channels 上超时：那条场景
        靠路由覆盖换掉 providers 列表，而在一个跑了几十次导航的长命 context 里
        它偶发拿不到。取样之间必须互不影响——这跟归一化只在必要处抹信息是同一条
        纪律：样本的差异只能来自被测应用，不能来自它排在第几个跑。
      */
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

        pseudoSamples += countPseudoSamples(react, vue);
        entries[key(scenario.id, state, dimension)] = buildDiffEntry(
          react,
          vue,
        );
      }
  }

  /*
    **算出来的 0 与没算的 0 不是一回事。**

    实测这一档在整套里只被 **4** 个锚点样本碰到（技能页那颗选中的 tab 的
    `::after`，两种语言 × 两个应用）——不是取样面漏了，是**整个仓库用伪元素的
    地方就这么少**：本仓 4 份组件、上游 5 份用到 `before:` / `after:`。
    数少不等于可以不守：那 4 个样本量的正是 `line` 档选中态的全部视觉主体，
    而 wave 145 的 N2 证明过，它一塌下来别的档一行都不会报。

    这条断言挡的是「`pseudo()` 写坏了→永远返回 `none`→两边一致→台账 0 行→
    没有任何用例会红」。数字变了要**看一眼再改**，不要顺手调低。
  */
  expect(
    pseudoSamples,
    "伪元素这一档一个样本都没采到——先确认 pseudo() 还在工作，再改这个阈值",
  ).toBeGreaterThanOrEqual(4);

  mkdirSync(dirname(REPORT.pathname), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(entries, null, 2));

  if (ACCEPT) {
    const previous = existsSync(BASELINE)
      ? ((
          (await import(BASELINE.href, { with: { type: "json" } })).default as {
            entries?: Record<string, DiffEntry>;
          }
        ).entries ?? {})
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
      BASELINE,
      JSON.stringify(
        {
          $comment:
            "React 与 Vue 在每个对照场景上的双向差异。这份清单只能缩短：修好一条就从这里删一条，" +
            "新出现一条会让 e2e-parity 立刻红。空数组是目标状态，不是「还没测」。" +
            "刷新用 make parity-accept——它会逐行比对新旧，**有新增行就拒写**，" +
            "真要接受得 PARITY_ACCEPT_GROW=1 再跑一次（wave 85 之前这句「只能缩短」" +
            "没有任何机器在守，accept 是无条件覆盖）。" +
            "键是 场景/断点/主题/语言；aria* 是可访问性树的双向逐行差异，" +
            "requests* 是产品 API 请求的多重集差异，geometry 是锚点的盒模型与色板差异。",
          entries,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  expect(existsSync(BASELINE), "基线不存在：先跑一次 make parity-accept").toBe(
    true,
  );
  const baseline = (await import(BASELINE.href, { with: { type: "json" } }))
    .default as { entries: Record<string, DiffEntry> };

  expect(
    entries,
    "对照差异与 baseline/parity-diff.json 不一致：修好的从清单里删掉，" +
      "新出现的先弄清楚是真差异还是取样不稳定，再决定是修代码还是 make parity-accept。",
  ).toEqual(baseline.entries);
});

/*
  取样稳定性的**测量**，不是偏好。请求序列如果两次一致，将来就可以把判据从
  多重集收紧成顺序；不一致的话，收紧只会得到一份随机变红的门禁。
  这里如实把测量结果留在报告里，而不是先假设一个答案。
*/
test("同一应用两次取样的请求序列", async ({ browser }) => {
  test.setTimeout(180_000);
  const scenario = PARITY_SCENARIOS[0]!;
  const samples: Record<string, string[][]> = {};

  for (const [name, base] of [
    ["vue", VUE_APP],
    ["react", REACT_APP],
  ] as const) {
    samples[name] = [];
    for (let round = 0; round < 2; round++) {
      const roundContext = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await roundContext.newPage();
      const capture = await captureScenario(
        page,
        base,
        scenario,
        DEFAULT_DIMENSION,
        scenarioStates(scenario)[0]!,
      );
      samples[name]!.push(capture.requests);
      await roundContext.close();
    }
  }

  for (const [name, rounds] of Object.entries(samples)) {
    expect(
      rounds[1],
      `${name} 两次取样的请求序列不同：顺序判据在收紧之前必须先稳定。`,
    ).toEqual(rounds[0]);
  }
});

/*
  几何取样只量布局、不量滚动状态——这条判据由这里实测，不由 capture.ts 的注释保证。

  这个场景是选出来的，不是随手挑的：它的锚点在 stick-to-bottom 的会话流里，是全部
  34 个样本中取样时刻**滚动量最大**的一个——实测 React 侧那条流被滚了 32~81px 不等
  （连跑五次量到 75/76/76/75/33），Vue 侧那条流没溢出、恒为 0；其余样本里最大的
  滚动量只有 artifact 面板那 1px。用没滚动的场景写这条用例会恒绿，也就什么都没测。

  所以还要断言这次实验真的把锚点挪动过：滚到顶与滚到底的**视口**坐标必须不同。
  否则哪天两边都不再溢出，这条用例会安静地退化成一句空话，而不是红。
*/
const SCROLL_INVARIANT_SCENARIO = "thread-history-mermaid";

async function scrollEverything(page: Page, where: "top" | "bottom") {
  await page.evaluate((target) => {
    for (const node of document.querySelectorAll("*")) {
      if (node.scrollHeight > node.clientHeight)
        node.scrollTop = target === "top" ? 0 : node.scrollHeight;
      if (node.scrollWidth > node.clientWidth)
        node.scrollLeft = target === "top" ? 0 : node.scrollWidth;
    }
    globalThis.scrollTo(0, target === "top" ? 0 : document.body.scrollHeight);
  }, where);
  // 贴底的容器会在下一帧回弹，等它落定再量。
  await page.waitForTimeout(200);
}

test("锚点的几何与滚到哪里无关", async ({ browser }) => {
  test.setTimeout(180_000);
  const scenario = PARITY_SCENARIOS.find(
    (entry) => entry.id === SCROLL_INVARIANT_SCENARIO,
  );
  expect(scenario, `场景目录里没有 ${SCROLL_INVARIANT_SCENARIO}`).toBeDefined();
  const anchor = scenario!.settle.find((step) => step.kind === "visible");
  expect(anchor, "这个场景没有可见锚点，量不了几何").toBeDefined();

  let moved = false;
  for (const [name, base] of [
    ["vue", VUE_APP],
    ["react", REACT_APP],
  ] as const) {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page: Page = await context.newPage();
    const state = scenarioStates(scenario!)[0]!;
    await runScenario(page, base, scenario!, DEFAULT_DIMENSION, state);
    await page.waitForTimeout(700);

    const locator = locateTarget(page, anchor!.target).first();
    const viewportY = () =>
      locator.evaluate(
        (element) => Math.round(element.getBoundingClientRect().y * 10) / 10,
      );

    await scrollEverything(page, "top");
    const atTop = await sampleGeometry(page, scenario!, state);
    const viewportAtTop = await viewportY();

    await scrollEverything(page, "bottom");
    const atBottom = await sampleGeometry(page, scenario!, state);
    const viewportAtBottom = await viewportY();

    if (viewportAtTop !== viewportAtBottom) moved = true;
    expect(
      atBottom,
      `${name} 的锚点几何随滚动位置变了：取样量到的是滚动状态，不是布局。`,
    ).toEqual(atTop);
    await context.close();
  }

  expect(
    moved,
    `两个应用滚到顶与滚到底时锚点都没动过：${SCROLL_INVARIANT_SCENARIO} 已经不再有` +
      `被滚动的容器，这条用例现在是空的，得换一个真会滚的场景。`,
  ).toBe(true);
});
