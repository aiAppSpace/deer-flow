import { expect, type Page } from "@playwright/test";

/** Width includes the shell border; the inner native scroller fills its content box. */
export async function expectDesktopSidebarWidth(page: Page, width: number) {
  const frame = page.locator('[data-slot="sidebar-container"]');
  await expect(frame).toHaveCSS("width", `${width}px`);
  const geometry = await frame.evaluate((element) => {
    const inner = element.querySelector('[data-slot="sidebar-inner"]');
    if (!inner) throw new Error("Desktop sidebar has no inner scroll owner");
    const style = getComputedStyle(element);
    return {
      inner: inner.getBoundingClientRect().width,
      borders:
        parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth),
    };
  });
  expect(geometry.borders).toBe(1);
  expect(geometry.inner + geometry.borders).toBe(width);
}
