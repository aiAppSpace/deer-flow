/*
  【文件职责】     打开设置对话框的**唯一入口**：导航 → 等它出现 → **等它停稳**。
  【架构位置】     e2e 支撑代码（不进产物）
  【主要导出】     openSettingsDialog
  【依赖关系】     @playwright/test · ./settled-box
  【边界与注意】   **对话框是缩放着进场的，进场期间里面的东西一直在动。**

                   `DialogContent.vue` 上挂着 `data-[state=open]:zoom-in-95` +
                   `duration-200`：从 95% 放大到 100%。wave 200 实测这段位移有多大——
                   对话框里第一个可点元素的 x 从 **119.2 走到 98.0（21.2px）**，
                   框宽 1107 → 1152，**约 170ms 停稳**：

                       0ms  x=119.2 w=190.3 框w=1107
                       52ms x=105.8 w=195.1 框w=1135
                       119ms x=99.0 w=197.6 框w=1150
                       168ms x=98.0 w=198.0 框w=1152   ← 停

                   21px 比很多按钮的半宽还大。**在这段里量一次坐标再按下去，
                   点到的是旁边**——报出来是 30 秒后的 `locator.click: Test timeout`，
                   call log 停在「done scrolling」，指不出真正的原因
                   （wave 199 那轮循环里 `integrations.spec.ts:461` 就是这么红的）。

                   **不要指望 Playwright 自带的可操作性等待兜住它**：它判「稳定」用的是
                   相邻两个动画帧的盒子相同，整套并行跑时渲染帧会被饿着，两次 rAF
                   之间可能没有重新排版，于是提前判稳（同 wave 198，那里量的是 14px）。
                   这里用 `settledBox` 按**真实时间间隔**判稳。

                   **为什么做成唯一入口而不是在出事的那几处各补一句**：
                   「开完记得等一下」是一条要靠人记住的规矩，忘一次就回到偶发红。
                   收成一个函数之后，`tests/guards/tooling-contracts.test.ts`
                   能零豁免地拦住「绕过它自己 goto 一个 ?settings= 深链」。
*/

import { expect, type Locator, type Page } from "@playwright/test";

import { settledBox } from "./settled-box";

/**
 * `name` 传 `undefined` 表示**不按名字锁**。
 *
 * **这不是可有可无的重载**：会切语言的用例（`i18n-theme.spec.ts`）切完之后，
 * 对话框的可访问名会从 "Settings" 变成「设置」——把 locator 锁在某一种语言的
 * 名字上，切语言之后它就再也匹配不上，报出来是「找不到元素」。
 * 本轮把这处改成带名字时当场红了一次，判据就是这条。
 */
export async function openSettingsDialog(
  page: Page,
  url: string,
  name?: string | RegExp,
): Promise<Locator> {
  await page.goto(url);
  const dialog =
    name === undefined
      ? page.getByRole("dialog")
      : page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await settledBox(dialog, "设置对话框");
  return dialog;
}
