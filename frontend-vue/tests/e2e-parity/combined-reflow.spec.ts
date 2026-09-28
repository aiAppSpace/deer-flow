/*
  Wave 66 组合回流门禁：每个终态先按自己的原始维度走到位，再同时施加
  360px 窄宽与 32px 根字号（200% 文本）。单轴门禁已经分别常驻；这把尺子
  专门量交集，不能用“窄屏绿 + 文本放大绿”代替。

  两个应用共用同一把尺：61 个终态、对话框生命周期、水平滚动、控件可达性与
  裁切内容的合法滚动路径都要逐一验证，并用下方的交集阳性样本防止量具空转。
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
const ROOT_PX = 32;
test("组合轴量具能命中仅在 360px × 200% 交集出现的裁切", async ({ page }) => {
  const probe = async (width: number, rootPx: number) => {
    await page.setViewportSize({ width, height: 720 });
    await page.setContent(
      `<style>html{font-size:${rootPx}px}.outer{width:calc(100vw - 20px);height:4rem;overflow:hidden}.inner{width:20rem;height:2rem}</style>` +
        '<div class="outer"><div class="inner">positive control</div></div>',
    );
    return page.evaluate(surveyReflow, 24);
  };

  const narrowOnly = await probe(WIDTH, 16);
  const textOnly = await probe(1280, ROOT_PX);
  const combined = await probe(WIDTH, ROOT_PX);

  expect(narrowOnly.unreachableClips).toEqual([]);
  expect(textOnly.unreachableClips).toEqual([]);
  expect(combined.unreachableClips.length).toBeGreaterThan(0);
});
for (const [name, base] of APPS) {
  test(`${name}: 61 个终态在 360px × 200% 文本下仍可达且无需页面横滚`, async ({
    browser,
  }) => {
    test.setTimeout(2_700_000);
    const failed: string[] = [];
    const horizontal: string[] = [];
    const lost: string[] = [];
    const clipped: string[] = [];
    const droppedDialogs: string[] = [];
    const widths = new Set<number>();
    const rootSizes = new Set<number>();
    let scanned = 0;
    let initialOutside = 0;
    let routesSeen = 0;
    let routesMoved = 0;
    let recovered = 0;
    let clippingBoxes = 0;
    let clippedAwaySkips = 0;
    let nativeTextInputSkips = 0;

    for (const scenario of PARITY_SCENARIOS)
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
          const height = page.viewportSize()!.height;
          await page.setViewportSize({ width: WIDTH, height });
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

          const survey = await page.evaluate(surveyReflow, 24);
          widths.add(survey.width);
          rootSizes.add(survey.rootPx);
          initialOutside += survey.initialOutside;
          routesSeen += survey.routesSeen;
          routesMoved += survey.routesMoved;
          recovered += survey.recovered;
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
      `[combined-reflow] ${name} scanned=${scanned} initialOutside=${initialOutside} ` +
        `recovered=${recovered} routesSeen=${routesSeen} routesMoved=${routesMoved} ` +
        `clippingBoxes=${clippingBoxes} clippedAwaySkips=${clippedAwaySkips} ` +
        `nativeTextInputSkips=${nativeTextInputSkips} ` +
        `horizontal=${horizontal.length} lost=${lost.length} clipped=${clipped.length} ` +
        `droppedDialogs=${JSON.stringify(droppedDialogs)}`,
    );
    console.info(`[combined-horizontal] ${name} ${JSON.stringify(horizontal)}`);
    console.info(`[combined-lost] ${name} ${JSON.stringify(lost)}`);
    console.info(`[combined-clipped] ${name} ${JSON.stringify(clipped)}`);
    expect(failed, "这些终态没有走到位，组合轴探针空转").toEqual([]);
    expect(scanned).toBe(61);
    expect([...widths], "360px 没有稳定落地").toEqual([WIDTH]);
    expect([...rootSizes], "200% 根字号没有稳定落地").toEqual([ROOT_PX]);
    expect(initialOutside, "没有命中任何需要滚动恢复的控件").toBeGreaterThan(0);
    expect(routesSeen, "没有找到任何合法滚动路径").toBeGreaterThan(0);
    expect(routesMoved, "合法滚动路径一次都没有移动").toBeGreaterThan(0);
    expect(
      recovered,
      "没有控件被滚回视口，量具缺少真实阳性样本",
    ).toBeGreaterThan(0);
    expect(clippingBoxes, "没有命中任何裁剪盒，量具空转").toBeGreaterThan(0);
    expect(clippedAwaySkips, "读屏器专用裁剪分支一次都没命中").toBeGreaterThan(
      0,
    );
    expect(
      nativeTextInputSkips,
      "原生单行输入值视口分支一次都没命中",
    ).toBeGreaterThan(0);
    expect(droppedDialogs, "组合轴切换导致已打开的对话框消失").toEqual([]);
    expect(
      horizontal,
      "组合轴出现页面横滚或非预期内层横滚；表格与 pre 已按既有契约排除",
    ).toEqual([]);
    expect(lost, "组合轴下这些交互控件无法完整滚进视口").toEqual([]);
    expect(clipped, "组合轴下这些被裁内容没有合法滚动路径").toEqual([]);
  });
}
