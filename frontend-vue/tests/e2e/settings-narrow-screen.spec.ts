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

                   ⚠ **第四十一轮逐个分区量了一遍，订正了上面那句话里点名的分区**：
                   `integrations`（正文 827 字符、min-content 241）与
                   `skills`（3 个 item、min-content 172）**本来就有内容**；
                   真正空着的只有 `tools`（正文 373 字符、一颗按钮）与
                   `subagents`（615 字符、一颗按钮），已经接上共享夹具。
                   装满之后实测 `tools` 余量 98、`subagents` 余量 106——**没有缺陷**，
                   但那条断言从此不再是空转。
                   十个分区的余量（360px）：about 210 · memory 154 · tools 98 ·
                   subagents 106 · skills 106 · notification 132 · account 74 ·
                   integrations 37 · appearance 24 · **channels 22（最紧）**。

                   **光补夹具只修了一半。** 这条门禁此前是**空转**的：面板里没东西时
                   「装得下」永远成立。所以下面还断言**该有列表的分区真的有行**
                   （`SECTIONS_WITH_LISTS`），并**反向**断言其余分区一行都没有——
                   哪天 mock 不作答、端点改名、或者新增一个带列表的分区，
                   它会直接红，而不是悄悄退回空转。
*/

import { expect, test } from "@playwright/test";

import { SETTINGS_SECTIONS } from "../../app/core/workspace-shell/settings-query";
import { CHANNEL_PROVIDERS } from "../support/channel-providers";
import { MCP_CONFIG, SUBAGENTS } from "../support/settings-fixtures";
import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI } from "./utils/mock-api";

/** 最窄的两档受支持宽度。360 是常见的 Android 宽度。 */
const WIDTHS = [375, 360] as const;

/*
  **画列表的分区**，用来防止这条门禁退回空转（见文件头）。

  写成「哪些分区有列表」而不是「每个分区有几行」：行数是夹具的实现细节，
  会随夹具改；**「这个分区该有行」是产品事实**，只有它变了才该让人回来改这里。
  两张表恰好划分 `SETTINGS_SECTIONS`：新增分区无处可去，必须显式选一边。
*/
const SECTIONS_WITH_LISTS = new Set([
  "channels",
  "tools",
  "subagents",
  "skills",
]);

for (const section of SETTINGS_SECTIONS) {
  for (const width of WIDTHS) {
    test(`${section} 分区在 ${width}px 屏上装得进对话框且有余量`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      mockLangGraphAPI(page);
      /*
        见文件头：共享 mock 对这三个端点要么给空、要么不作答，那样量的是空面板。
        这三条必须在 `openSettingsDialog` 之前注册——它第一件事就是 `goto`。
      */
      const json = (body: unknown) => ({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      await page.route("**/api/channels/providers", (route) =>
        route.request().method() === "GET"
          ? route.fulfill(json({ enabled: true, providers: CHANNEL_PROVIDERS }))
          : route.fallback(),
      );
      await page.route("**/api/mcp/config", (route) =>
        route.request().method() === "GET"
          ? route.fulfill(json(MCP_CONFIG))
          : route.fallback(),
      );
      await page.route("**/api/subagents", (route) =>
        route.request().method() === "GET"
          ? route.fulfill(json({ subagents: SUBAGENTS }))
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

      /*
        **反空转**：该有列表的分区必须真的画出行，其余分区必须一行都没有。
        见文件头——这条门禁十轮以来对 channels 一直是绿的，而它量的是空面板。

        ⚠ **放在余量断言之后、而且用 `poll`**：列表是异步取来的，紧接着对话框
        可见就读，`tools` 与 `subagents` 会稳定读到 0 行（第四十一轮实测四条红，
        是断言的时序问题，不是应用的问题）。反向那一支不用 poll——它要证明的是
        「这里不该长出列表」，而此时列表若要出现早该出现了。
      */
      const rowsOf = () =>
        page.evaluate(
          () =>
            document
              .querySelector("[role=dialog]")
              ?.querySelectorAll('[data-slot="item"]').length ?? 0,
        );
      if (SECTIONS_WITH_LISTS.has(section)) {
        await expect
          .poll(rowsOf, {
            message: `设置分区「${section}」一行都没画出来——夹具没生效的话，「装得下」是空转的`,
          })
          .toBeGreaterThan(0);
      } else {
        expect(
          await rowsOf(),
          `设置分区「${section}」画出了列表行，但它不在 SECTIONS_WITH_LISTS 里：` +
            "要么它现在有列表了（补进那张表，并给它喂夹具），要么这几行是别的东西",
        ).toBe(0);
      }
    });
  }
}
