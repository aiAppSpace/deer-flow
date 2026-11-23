import { expect, test } from "@playwright/test";

import { SETTINGS_SECTIONS } from "../../app/core/workspace-shell/settings-query";
import { CHANNEL_PROVIDERS } from "../support/channel-providers";
import { SUBAGENTS } from "../support/settings-fixtures";
import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI } from "./utils/mock-api";

const WIDTHS = [375, 360] as const;

const SECTIONS_WITH_LISTS = new Set(["channels", "subagents"]);

for (const section of SETTINGS_SECTIONS) {
  for (const width of WIDTHS) {
    test(`${section} 分区在 ${width}px 屏上装得进对话框且有余量`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      mockLangGraphAPI(page);
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

for (const width of WIDTHS) {
  for (const tab of ["plugins", "skills", "extensions"]) {
    test(`capabilities ${tab} has real content and fits at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      mockLangGraphAPI(page);
      await page.goto(`/workspace/capabilities?tab=${tab}`);
      await expect(
        page.getByRole("heading", { name: "Capability Center", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => page.getByRole("article").count())
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          page.evaluate(() =>
            Math.max(0, document.documentElement.scrollWidth - innerWidth),
          ),
        )
        .toBe(0);
      for (const article of await page.getByRole("article").all()) {
        expect(
          await article.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
        ).toBeLessThanOrEqual(1);
      }
    });
  }
}
