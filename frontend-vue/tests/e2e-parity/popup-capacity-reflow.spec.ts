import { expect, test, type Locator, type Page } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;
const STATES = [
  ["agent-chat", "model-picker"],
  ["model-favorites", "catalog"],
  ["model-favorites", "favorite-without-selecting"],
  ["extension-mentions", "coexisting-candidates"],
  ["extension-mentions", "search-failure-isolated"],
  ["mentions", "all-reference-kinds"],
] as const;
async function assertComplete(page: Page) {
  const survey = await page.evaluate(surveyReflow, 24);
  expect([survey.width, survey.height, survey.rootPx]).toEqual([360, 360, 32]);
  expect(survey.documentOverflowX).toBeLessThanOrEqual(1);
  expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
  expect(survey.lostControls).toEqual([]);
  expect(survey.unreachableClips).toEqual([]);
}
async function wheel(page: Page, port: Locator, delta: number) {
  const box = await port.boundingBox();
  expect(box).not.toBeNull();
  const top = Math.max(0, box!.y),
    bottom = Math.min(360, box!.y + box!.height);
  expect(bottom - top).toBeGreaterThan(0);
  await page.mouse.move(box!.x + box!.width / 2, (top + bottom) / 2);
  await page.mouse.wheel(0, delta);
}
async function nativeGeometry(control: Locator) {
  return control.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const viewport = window.visualViewport;
    const clip = {
      left: viewport?.offsetLeft ?? 0,
      top: viewport?.offsetTop ?? 0,
      right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth),
      bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight),
    };
    const ancestors = [];
    for (
      let parent = node.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (style.display === "inline" || style.display === "contents") continue;
      const bounds = parent.getBoundingClientRect();
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
        clip.left = Math.max(clip.left, bounds.left + parent.clientLeft);
        clip.right = Math.min(
          clip.right,
          bounds.left + parent.clientLeft + parent.clientWidth,
        );
      }
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {
        clip.top = Math.max(clip.top, bounds.top + parent.clientTop);
        clip.bottom = Math.min(
          clip.bottom,
          bounds.top + parent.clientTop + parent.clientHeight,
        );
      }
      ancestors.push({
        tag: parent.tagName,
        overflow: style.overflow,
        clip: { ...clip },
      });
    }
    const intersection =
      Math.max(
        0,
        Math.min(box.right, clip.right) - Math.max(box.left, clip.left),
      ) *
      Math.max(
        0,
        Math.min(box.bottom, clip.bottom) - Math.max(box.top, clip.top),
      );
    return {
      label: node.getAttribute("aria-label") ?? node.textContent,
      rect: {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      },
      clip,
      ancestors,
      ratio:
        box.width * box.height ? intersection / (box.width * box.height) : 0,
      complete:
        box.width > 0 &&
        box.height > 0 &&
        box.left >= clip.left - 0.5 &&
        box.right <= clip.right + 0.5 &&
        box.top >= clip.top - 0.5 &&
        box.bottom <= clip.bottom + 0.5,
    };
  });
}
async function assertNativeControl(control: Locator, geometry: unknown[]) {
  // Match surveyReflow's existing native geometry boundary, including 1/64px
  // scroll rounding; retain the exact intersection ratio for diagnosis.
  try {
    await expect
      .poll(async () => (await nativeGeometry(control)).complete)
      .toBe(true);
  } finally {
    geometry.push(await nativeGeometry(control));
  }
}
for (const [app, base] of APPS)
  for (const [id, stateId] of STATES)
    test(`${app}: ${id}#${stateId} retains complete popup controls after native scroll-owner reflow`, async ({
      browser,
    }) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      const unmatched: string[] = [];
      const native: unknown[] = [];
      await page.route("**/api/**", async (route) => {
        unmatched.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        await route.abort("blockedbyclient");
      });
      try {
        const scenario = PARITY_SCENARIOS.find((item) => item.id === id)!;
        const state = scenarioStates(scenario).find(
          (item) => item.id === stateId,
        )!;
        await runScenario(
          page,
          base,
          scenario,
          state.dimensions?.[0] ??
            scenario.dimensions?.[0] ??
            DEFAULT_DIMENSION,
          state,
          30_000,
        );
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const isModel = id === "agent-chat" || id === "model-favorites";
        const controls = isModel
          ? page.locator("[data-model-picker-option]")
          : page.getByTestId("mention-picker").getByRole("option");
        const inventory = await controls.evaluateAll((nodes) =>
          nodes.map((node) => ({
            id: node.id,
            label: node.getAttribute("aria-label") ?? node.textContent,
            selected:
              node.getAttribute("aria-current") ??
              node.getAttribute("aria-selected"),
          })),
        );
        expect(inventory.length).toBeGreaterThan(1);
        const favorites = isModel
          ? await page.locator("[data-model-favorite]").evaluateAll((nodes) =>
              nodes.map((node) => ({
                label: node.getAttribute("aria-label"),
                pressed: node.getAttribute("aria-pressed"),
              })),
            )
          : [];
        const dialogs = await page.getByRole("dialog").count();
        // The popup opens before the breakpoint creates the native main scroller.
        await page.setViewportSize({ width: 360, height: 360 });
        await page.addStyleTag({ content: "html{font-size:32px!important}" });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        expect(await page.getByRole("dialog").count()).toBe(dialogs);
        expect(
          await controls.evaluateAll((nodes) =>
            nodes.map((node) => ({
              id: node.id,
              label: node.getAttribute("aria-label") ?? node.textContent,
              selected:
                node.getAttribute("aria-current") ??
                node.getAttribute("aria-selected"),
            })),
          ),
        ).toEqual(inventory);
        if (isModel)
          expect(
            await page.locator("[data-model-favorite]").evaluateAll((nodes) =>
              nodes.map((node) => ({
                label: node.getAttribute("aria-label"),
                pressed: node.getAttribute("aria-pressed"),
              })),
            ),
          ).toEqual(favorites);
        await assertComplete(page);
        if (isModel) {
          const dialog = page.getByRole("dialog", {
            name: /^(Choose a model|选择模型)$/,
          });
          await assertNativeControl(dialog, native);
          // Native arrows retain the selection and traverse every model row.
          for (let i = 0; i < inventory.length; i++) {
            await page.keyboard.press("ArrowDown");
            const active = await page.evaluate(() =>
              document.activeElement?.getAttribute("data-model-picker-option"),
            );
            expect(active).toBe("true");
            await assertNativeControl(
              page.locator("[data-model-picker-option]:focus"),
              native,
            );
          }
          const port = dialog.locator("div.min-h-0").first();
          const scrollable = await port.evaluate(
            (node) => node.scrollHeight > node.clientHeight + 1,
          );
          await wheel(page, port, -1000);
          if (scrollable)
            await expect
              .poll(() => port.evaluate((node) => node.scrollTop))
              .toBe(0);
          await assertNativeControl(controls.first(), native);
          await wheel(page, port, 1000);
          if (scrollable)
            await expect
              .poll(() => port.evaluate((node) => node.scrollTop))
              .toBeGreaterThan(0);
          await assertNativeControl(controls.last(), native);
        } else {
          const picker = page.getByTestId("mention-picker");
          const popup = picker.locator("..");
          // Wheel reaches the actual outer picker boundaries; the footer follows
          // Upload, so reaching the bottom does not imply Upload stays visible.
          await wheel(page, popup, -1000);
          await expect
            .poll(() => popup.evaluate((node) => node.scrollTop))
            .toBe(0);
          await wheel(page, popup, 1000);
          await expect
            .poll(() => popup.evaluate((node) => node.scrollTop))
            .toBeGreaterThan(0);
          // Caret/combobox arrows must reveal complete options, including the
          // fixed Upload command, without changing the draft or selection.
          const enabledIds = await controls.evaluateAll((nodes) =>
            nodes
              .filter(
                (node) => node instanceof HTMLButtonElement && !node.disabled,
              )
              .map((node) => node.id),
          );
          const controller = page.locator("[aria-activedescendant]");
          await expect(controller).toHaveCount(1);
          let activeId = await controller.getAttribute("aria-activedescendant");
          expect(enabledIds).toContain(activeId);
          const visited = new Set<string>();
          for (let i = 0; i < enabledIds.length; i++) {
            const nextId =
              enabledIds[
                (enabledIds.indexOf(activeId!) + 1) % enabledIds.length
              ]!;
            await page.keyboard.press("ArrowDown");
            // React commits asynchronously. Confirm the intended next option,
            // not a stale ID or whichever hovered option happens to win.
            await expect(controller).toHaveAttribute(
              "aria-activedescendant",
              nextId,
            );
            await assertNativeControl(
              page.locator(`[id=${JSON.stringify(nextId)}]`),
              native,
            );
            visited.add(nextId);
            activeId = nextId;
          }
          expect([...visited].sort()).toEqual([...enabledIds].sort());
        }
        await assertComplete(page);
      } finally {
        await test.info().attach("native-popup-geometry", {
          body: JSON.stringify(native, null, 2),
          contentType: "application/json",
        });
        await context.close();
        expect(
          unmatched,
          "registered fixtures must own every API request",
        ).toEqual([]);
      }
    });
