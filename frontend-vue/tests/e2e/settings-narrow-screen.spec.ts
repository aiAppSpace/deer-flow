/*
  【文件职责】     **每一个**设置分区在最窄的受支持屏上都装得进对话框，而且有余量。
  【架构位置】     E2E（mock 后端）
  【主要导出】     无；Playwright 用例
  【依赖关系】     tests/support/settings-dialog.ts · e2e/utils/mock-api.ts ·
                   app/core/workspace-shell/settings-query.ts 的 SETTINGS_SECTIONS
  【边界与注意】   **这一条是把一类已经出过三次的缺陷从一个分区推广到全部十个。**

                   `integrations` 那一个分区此前单独有这条门禁，而它出过事的方式是
                   两边共有的：某个不给换行机会的字面量、或某颗 `whitespace-nowrap`
                   的按钮，把整块面板的 min-content 顶到比它那格还宽。
                   第二十一轮（375px 下 macOS 恰好装下、Linux 溢出 9px）、
                   第二十七轮（内边距在窄屏不降档）、第三十八轮（scope 字面量 192.2px
                   + 「在浏览器重新注册」按钮 191.1px）各出过一次。
                   **一个分区有这条门禁，另外九个没有**——那九个不是没问题，是没人看。

                   **`panelSlack` 不是锦上添花**：只断言「溢出为 0」抓不到
                   「余量为 0」，而后者和「守住了」长得一模一样——上面那三次里有两次
                   就是栽在这上面。门限取 12px：第二十一轮实测同一张卡 Linux 比 macOS
                   宽约 9px，12 盖得过那个平台差；而任何一处重新钉住 min-content 的
                   改动一次吃掉 30–50px，不会卡在门限附近。

                   **分区用 `SETTINGS_SECTIONS` 反查，不另抄一份名单**：抄一份的话，
                   新增分区默认不在门禁里，而那正是这条门禁要防的形状。

                   ⚠ **「每个分区都覆盖到了」不等于「每个分区都量到了东西」**
                   （2026-09-18 第三十九轮）。这条门禁十轮以来对 `channels` 分区一直是绿的，
                   而共享 mock 的 `/api/channels/providers` 返回
                   `{ enabled: false, providers: [] }`——**它量的是一块空面板**。
                   装上 `CHANNEL_PROVIDERS` 之后同一条断言当场红：

                       panelOverflow  本仓 +19   上游 +222
                       面板右边界     本仓 338   上游 541（对话框右边界 344）

                   上游那块面板**直接冲出对话框和视口 181px**。根因有三层，都已按两边同改修掉：
                   设置对话框的栅格在 md 以下没有显式列模板（隐式列 `auto` + `min-width:auto`
                   被内容撑开）、上游 `ItemActions` 缺 `flex-wrap`、以及
                   「移除 provider 配置」那颗按钮的 `whitespace-nowrap`（229px）。

                   **所以夹具是这条门禁的一部分，不是背景**：装了内容才叫量过。
                   仍然量的是空面板的分区（按共享 mock 的默认值）：
                   `account` / `appearance` / `notification` / `memory` / `about` 本来就没有列表，
                   `tools` / `subagents` / `skills` / `integrations` 有列表但共享 mock 给空
                   ——**那四个分区的这条门禁目前只证明了空态**，是下一笔账。
*/

import { expect, test } from "@playwright/test";

import { SETTINGS_SECTIONS } from "../../app/core/workspace-shell/settings-query";
import { CHANNEL_PROVIDERS } from "../support/channel-providers";
import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI } from "./utils/mock-api";

/** 最窄的两档受支持宽度。360 是常见的 Android 宽度。 */
const WIDTHS = [375, 360] as const;

for (const section of SETTINGS_SECTIONS) {
  for (const width of WIDTHS) {
    test(`${section} 分区在 ${width}px 屏上装得进对话框且有余量`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      mockLangGraphAPI(page);
      // 见文件头：共享 mock 给的是空 provider 列表，那样量的是一块空面板。
      await page.route("**/api/channels/providers", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                enabled: true,
                providers: CHANNEL_PROVIDERS,
              }),
            })
          : route.fallback(),
      );

      const dialog = await openSettingsDialog(
        page,
        `/workspace/chats/new?settings=${section}`,
      );
      await expect(dialog).toBeVisible();

      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const dialogEl = document.querySelector("[role=dialog]");
              const panel = dialogEl?.querySelector<HTMLElement>(
                '[data-slot="scroll-area"]',
              );
              if (!panel?.parentElement) return { missing: true };
              const over = (value: number) => Math.max(0, Math.round(value));
              const cell = panel.parentElement.clientWidth;
              // 固有最小宽度：读完立刻还原内联样式，页面不留痕。
              const before = panel.style.cssText;
              panel.style.width = "min-content";
              panel.style.maxWidth = "none";
              const minContent = panel.getBoundingClientRect().width;
              panel.style.cssText = before;
              return {
                panelOverflow: over(panel.getBoundingClientRect().width - cell),
                panelSlack: Math.round(cell - minContent),
              };
            }),
          {
            message:
              `设置分区「${section}」在 ${width}px 上装不下：` +
              "panelOverflow>0 = 面板撑出了栅格格子；" +
              "panelSlack<12 = 还没溢出但余量已经不到 12px（见文件头的判词）",
          },
        )
        .toEqual(
          expect.objectContaining({
            panelOverflow: 0,
          }),
        );

      const slack = await page.evaluate(() => {
        const panel = document
          .querySelector("[role=dialog]")
          ?.querySelector<HTMLElement>('[data-slot="scroll-area"]');
        if (!panel?.parentElement) throw new Error("对话框里没有可滚动的面板");
        const cell = panel.parentElement.clientWidth;
        const before = panel.style.cssText;
        panel.style.width = "min-content";
        panel.style.maxWidth = "none";
        const minContent = panel.getBoundingClientRect().width;
        panel.style.cssText = before;
        return Math.round(cell - minContent);
      });
      expect(
        slack,
        `设置分区「${section}」在 ${width}px 上的余量只有 ${slack}px（门限 12）`,
      ).toBeGreaterThanOrEqual(12);
    });
  }
}
