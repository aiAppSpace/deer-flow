/*
  Wave 67 三轴交叉门禁：每个终态先按自己的原始维度走到位，再同时施加
  360px 窄宽、360px 低高度与 32px 根字号（200% 文本）。宽度、低高度、
  文本放大和「窄宽 × 文本」已有各自常驻门禁；这把尺子只负责三者交集，
  不能拿任意单轴或双轴的绿灯替代。

  两个应用共用 Wave 66 的同一套可达性量具。61 个终态、对话框生命周期、
  页面横滚、交互控件滚动恢复和裁切内容的合法滚动路径都必须逐一验证。
*/

import { expect, test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
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

const WIDTH = 360;
const HEIGHT = 360;
const ROOT_PX = 32;
const ONLY = new Set(
  (process.env.TRIPLE_REFLOW_ONLY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const SCENARIOS = ONLY.size
  ? PARITY_SCENARIOS.filter((scenario) => ONLY.has(scenario.id))
  : PARITY_SCENARIOS;
const EXPECTED_STATES = SCENARIOS.reduce(
  (count, scenario) => count + scenarioStates(scenario).length,
  0,
);
/*
  Mutation-only input. At 12px the width×height pair's deliberate 16px sample
  becomes a false positive, so the seven non-triple assertions below must fail.
  Default runs always use the production 24px cutoff from surveyReflow.
*/
const CLIP_THRESHOLD = process.env.TRIPLE_REFLOW_MUTATE === "1" ? 12 : 24;

test("三轴量具只在 360px × 360px × 200% 三者交集命中裁切", async ({ page }) => {
  const probe = async (width: number, height: number, rootPx: number) => {
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<style>
        html{font-size:${rootPx}px}
        .outer{width:calc(100vw - 20px);height:4rem;overflow:hidden}
        .inner{width:100%;height:2rem}
        @media(max-width:${WIDTH}px) and (max-height:${HEIGHT}px){
          .inner{width:calc(100% + 1rem)}
        }
      </style>` +
        '<div class="outer"><div class="inner">triple-axis positive control</div></div>',
    );
    return page.evaluate(surveyReflow, CLIP_THRESHOLD);
  };

  const results = {
    baseline: await probe(1280, 720, 16),
    width: await probe(WIDTH, 720, 16),
    height: await probe(1280, HEIGHT, 16),
    text: await probe(1280, 720, ROOT_PX),
    widthHeight: await probe(WIDTH, HEIGHT, 16),
    widthText: await probe(WIDTH, 720, ROOT_PX),
    heightText: await probe(1280, HEIGHT, ROOT_PX),
    triple: await probe(WIDTH, HEIGHT, ROOT_PX),
  };

  for (const [name, result] of Object.entries(results)) {
    if (name === "triple") continue;
    expect(result.unreachableClips, `${name} 不应触发三轴阳性样本`).toEqual([]);
  }
  expect(results.triple.unreachableClips.length).toBeGreaterThan(0);
});

for (const [name, base] of APPS) {
  test(`${name}: 61 个终态在 360px × 360px × 200% 下仍完整可达`, async ({
    browser,
  }) => {
    test.setTimeout(2_700_000);
    const failed: string[] = [];
    const horizontal: string[] = [];
    const lost: string[] = [];
    const clipped: string[] = [];
    const droppedDialogs: string[] = [];
    const widths = new Set<number>();
    const heights = new Set<number>();
    const rootSizes = new Set<number>();
    let scanned = 0;
    let initialOutside = 0;
    let routesSeen = 0;
    let routesMoved = 0;
    let recovered = 0;
    let oversizedRecovered = 0;
    let clippingBoxes = 0;
    let clippedAwaySkips = 0;
    let nativeTextInputSkips = 0;

    expect(
      SCENARIOS.length,
      `TRIPLE_REFLOW_ONLY=${[...ONLY].join(",")} 没有匹配到任何场景`,
    ).toBeGreaterThan(0);
    expect(
      SCENARIOS.length,
      "TRIPLE_REFLOW_ONLY 中至少一个场景 id 没有匹配",
    ).toBe(ONLY.size || PARITY_SCENARIOS.length);

    for (const scenario of SCENARIOS)
      for (const state of scenarioStates(scenario)) {
        const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
        const dimension =
          state.dimensions?.[0] ??
          scenario.dimensions?.[0] ??
          DEFAULT_DIMENSION;
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        try {
          await runScenario(page, base, scenario, dimension, state, 30_000);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const dialogsBefore = await page
            .locator('[role="dialog"],[role="alertdialog"]')
            .count();
          await page.setViewportSize({ width: WIDTH, height: HEIGHT });
          await page.addStyleTag({
            content: `html{font-size:${ROOT_PX}px !important}`,
          });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const dialogsAfter = await page
            .locator('[role="dialog"],[role="alertdialog"]')
            .count();
          if (dialogsAfter < dialogsBefore)
            droppedDialogs.push(`${key}: ${dialogsBefore}→${dialogsAfter}`);

          const survey = await page.evaluate(surveyReflow, CLIP_THRESHOLD);
          widths.add(survey.width);
          heights.add(survey.height);
          rootSizes.add(survey.rootPx);
          initialOutside += survey.initialOutside;
          routesSeen += survey.routesSeen;
          routesMoved += survey.routesMoved;
          recovered += survey.recovered;
          oversizedRecovered += survey.oversizedRecovered;
          clippingBoxes += survey.clippingBoxes;
          clippedAwaySkips += survey.clippedAwaySkips;
          nativeTextInputSkips += survey.nativeTextInputSkips;
          if (survey.documentOverflowX > 1)
            horizontal.push(
              `${key}: document 横向溢出 ${survey.documentOverflowX}px`,
            );
          for (const row of survey.nonDeliberateHorizontalScrollers)
            horizontal.push(`${key}: 非预期横滚 ${row}`);
          for (const row of survey.lostControls) lost.push(`${key}: ${row}`);
          for (const row of survey.unreachableClips)
            clipped.push(`${key}: ${row}`);
          scanned += 1;
        } catch (error) {
          failed.push(`${key}: ${String(error).split("\n")[0]?.slice(0, 120)}`);
        } finally {
          await context.close();
        }
      }

    console.info(
      `[triple-reflow] ${name} scanned=${scanned} initialOutside=${initialOutside} ` +
        `recovered=${recovered} oversizedRecovered=${oversizedRecovered} ` +
        `routesSeen=${routesSeen} routesMoved=${routesMoved} ` +
        `clippingBoxes=${clippingBoxes} clippedAwaySkips=${clippedAwaySkips} ` +
        `nativeTextInputSkips=${nativeTextInputSkips} ` +
        `horizontal=${horizontal.length} lost=${lost.length} clipped=${clipped.length} ` +
        `droppedDialogs=${JSON.stringify(droppedDialogs)}`,
    );
    console.info(`[triple-horizontal] ${name} ${JSON.stringify(horizontal)}`);
    console.info(`[triple-lost] ${name} ${JSON.stringify(lost)}`);
    console.info(`[triple-clipped] ${name} ${JSON.stringify(clipped)}`);
    expect(failed, "这些终态没有走到位，三轴探针空转").toEqual([]);
    expect(scanned).toBe(EXPECTED_STATES);
    if (!ONLY.size) expect(scanned).toBe(61);
    expect([...widths], "360px 宽度没有稳定落地").toEqual([WIDTH]);
    expect([...heights], "360px 高度没有稳定落地").toEqual([HEIGHT]);
    expect([...rootSizes], "200% 根字号没有稳定落地").toEqual([ROOT_PX]);
    /*
      这些是全量量具的反空转样本；`TRIPLE_REFLOW_ONLY` 只用于定位单个场景，
      不能要求每个任意子集都恰好包含所有分支。默认 61 终态仍逐条强制命中。
    */
    if (!ONLY.size) {
      expect(initialOutside, "没有命中任何需要滚动恢复的控件").toBeGreaterThan(
        0,
      );
      expect(routesSeen, "没有找到任何合法滚动路径").toBeGreaterThan(0);
      expect(routesMoved, "合法滚动路径一次都没有移动").toBeGreaterThan(0);
      expect(
        recovered,
        "没有控件被滚回视口，量具缺少真实阳性样本",
      ).toBeGreaterThan(0);
      expect(
        oversizedRecovered,
        "没有命中任何需要分别滚到首尾的大尺寸控件",
      ).toBeGreaterThan(0);
      expect(clippingBoxes, "没有命中任何裁剪盒，量具空转").toBeGreaterThan(0);
      expect(
        clippedAwaySkips,
        "读屏器专用裁剪分支一次都没命中",
      ).toBeGreaterThan(0);
      expect(
        nativeTextInputSkips,
        "原生单行输入值视口分支一次都没命中",
      ).toBeGreaterThan(0);
    }
    expect(droppedDialogs, "三轴切换导致已打开的对话框消失").toEqual([]);
    expect(
      horizontal,
      "三轴交集出现页面横滚或非预期内层横滚；表格与 pre 已按既有契约排除",
    ).toEqual([]);
    expect(lost, "三轴交集下这些交互控件无法完整滚进视口").toEqual([]);
    expect(clipped, "三轴交集下这些被裁内容没有合法滚动路径").toEqual([]);
  });
}
