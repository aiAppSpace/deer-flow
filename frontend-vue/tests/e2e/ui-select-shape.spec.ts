/*
  【文件职责】     钉住 Select primitive 展开之后的**渲染形状**：弹层定位方式、勾选标记
                   在哪一侧、选项多到溢出时的滚动按钮、触发器的默认高度。
  【架构位置】     E2E 产品合同（mock Gateway）
  【主要导出】     Playwright scenarios
  【依赖关系】     tests/e2e/utils/mock-api · app/components/ui/select/**
  【边界与注意】   与 ui-primitives-a11y.spec.ts 分开是因为两者的判据不同：那个文件明写
                   只断言**可观察行为**（角色、焦点顺序、Escape、aria 状态），而这里断言的
                   恰恰是它排除掉的东西——展开之后长什么样。

                   为什么非得在本仓钉：**e2e-parity 结构上看不见这一层**。Select 一展开，
                   Reka/Radix 就把页面其余部分挡在可访问性树之外，整棵树只剩一个 `listbox`；
                   两个滚动按钮又是 aria-hidden 的。也就是说「弹层贴在触发器下方还是把选中项
                   叠在触发器上」「勾选在左还是在右」「有没有滚动按钮」这三处，无论怎么加
                   场景步骤，台账都报不出来。2026-08-30 逐项实测过一次两个应用展开后的
                   计算样式与几何（content/viewport/item/indicator/滚动按钮/选项数），
                   除 z-index 外完全一致；这个文件就是那次实测的固化。

                   z-index **有意**不同（本仓 z-80，React z-50）：本仓有一套明写的层级
                   约定，见 app/components/ui/dialog/DialogOverlay.vue 的文件头。
*/

import { expect, test, type Page } from "@playwright/test";

import { settledBox } from "../support/settled-box";

import { mockLangGraphAPI } from "./utils/mock-api";

const TASK = {
  id: "task-1",
  thread_id: null,
  title: "Daily summary",
  prompt: "Summarize thread",
  schedule_type: "cron" as const,
  schedule_spec: { cron: "0 9 * * *" },
  timezone: "UTC",
  status: "enabled" as const,
  next_run_at: "2026-07-02T01:00:00+00:00",
  last_run_at: null,
  last_run_id: null,
  last_error: null,
  run_count: 0,
  created_at: "2026-07-01T00:00:00+00:00",
  updated_at: "2026-07-01T00:00:00+00:00",
};

async function openSelect(page: Page, testId: string) {
  mockLangGraphAPI(page, { threads: [], scheduledTasks: [TASK] });
  await page.goto("/workspace/scheduled-tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const trigger = page.getByTestId(testId);
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await settledBox(page.getByRole("dialog"), "scheduled task dialog");
  await trigger.click();
  await expect(page.locator('[data-slot="select-content"]')).toBeVisible();
  await settledBox(
    page.locator('[data-slot="select-content"]'),
    "select content",
  );
  return (await trigger.boundingBox())!;
}

test.describe("select primitive shape", () => {
  test("opens item-aligned: the selected option covers the trigger", async ({
    page,
  }) => {
    const trigger = await openSelect(page, "schedule-preset");
    const selected = page.locator(
      '[data-slot="select-item"][data-state="checked"]',
    );
    await expect(selected).toBeVisible();
    const box = (await selected.boundingBox())!;
    /*
      item-aligned 的定义就是「把选中项叠在触发器上」。popper 模式下弹层整体贴在触发器
      **下方**，选中项的中心会落在触发器下缘之外——两种模式在这一条上分得很开，所以用
      中心距而不是 class 判定。
    */
    const triggerCenter = trigger.y + trigger.height / 2;
    const selectedCenter = box.y + box.height / 2;
    expect(Math.abs(selectedCenter - triggerCenter)).toBeLessThan(
      trigger.height,
    );
  });

  test("puts the check on the right, not the left", async ({ page }) => {
    await openSelect(page, "schedule-preset");
    const item = page.locator('[data-slot="select-item"]').first();
    const indicator = page
      .locator('[data-slot="select-item-indicator"]')
      .first();
    const itemBox = (await item.boundingBox())!;
    const indicatorBox = (await indicator.boundingBox())!;
    /*
      钉的是「勾选靠在选项的右端」，不是某个具体的像素数：它是绝对定位的，右缘会因为
      亚像素与 overflow 裁剪超出选项盒（实测 -1.6px），拿距右缘的间距当判据会假红。
      用起点占宽度的比例：右置时 >0.8，改回左置（原来是 `absolute left-1.5` + `pl-7`）
      会掉到 0.01 附近。
    */
    const startedAt = (indicatorBox.x - itemBox.x) / itemBox.width;
    expect(startedAt).toBeGreaterThan(0.8);
  });

  test("shows a scroll button once the option list overflows", async ({
    page,
  }) => {
    // 时区那个下拉是 Intl 的全量时区，几百项，必然溢出。
    await openSelect(page, "schedule-timezone");
    await expect(
      page.locator('[data-slot="select-item"]').first(),
    ).toBeVisible();
    expect(
      await page.locator('[data-slot="select-item"]').count(),
    ).toBeGreaterThan(50);
    /*
      两颗滚动按钮此前在本仓**根本不存在**（React 的 SelectContent 里一直有）。
      钉「向下那颗看得见」：它只在列表真的还能往下滚时才显示，所以这一条同时证明了
      按钮被挂上去、且接到了 Reka 的滚动状态上。向上那颗停在顶部时是挂着但不显示的，
      所以不拿它当判据。
    */
    await expect(
      page.locator('[data-slot="select-scroll-down-button"]'),
    ).toBeVisible();
  });

  test("keeps the default trigger height and lets the caller take the width", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { threads: [], scheduledTasks: [TASK] });
    await page.goto("/workspace/scheduled-tasks");
    await page.getByRole("button", { name: "New task", exact: true }).click();
    const trigger = page.getByTestId("schedule-preset");
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await expect(trigger).toHaveAttribute("data-size", "default");
    await settledBox(page.getByRole("dialog"), "scheduled task dialog");
    await settledBox(trigger, "schedule preset trigger");
    // data-size=default 就是 h-9。
    expect(Math.round((await trigger.boundingBox())!.height)).toBe(36);
    // 这两处调用方都传了 w-full，宽度应当跟随所在列而不是内容。
    await settledBox(page.getByRole("dialog"), "scheduled task dialog");
    const form = page.getByTestId("schedule-input");
    const formBox = (await form.boundingBox())!;
    const triggerBox = (await trigger.boundingBox())!;
    expect(Math.abs(formBox.width - triggerBox.width)).toBeLessThan(1);
  });
});
