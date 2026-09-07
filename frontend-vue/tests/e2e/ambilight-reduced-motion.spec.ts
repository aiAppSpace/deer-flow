/*
  【文件职责】     钉住子任务卡片那层环境光在减动偏好下停住、但不消失。
  【架构位置】     产品合同套件（tests/e2e，无需 route mock）
  【主要导出】     无；Playwright 用例
  【边界与注意】   与上游 `frontend/tests/e2e/ambilight-reduced-motion.spec.ts` 是同一份
                   合同的两侧，**wave 161 两边同改**：这是一条自动播放、无限循环、
                   纯装饰的动画（WCAG 2.2.2，A 级），此前两个应用都不理会
                   `prefers-reduced-motion`；`main.css` 里那段注释当时写的正是
                   「刻意不加：上游没有，要改得两边同改」。

                   核的是**浏览器解析出来的计算样式**，不是 CSS 源文本——整个机制
                   就是一条媒体查询，读源文件证明不了浏览器会怎么算。

                   元素是注入的：要摸到真正在跑的子任务得起一条真流，而这里要测的
                   是那条规则本身，不是那张卡片。

                   偏好用 `page.emulateMedia()` 显式设，不用 `test.use({ reducedMotion })`
                   ——上游那份实测 describe 级的选项没传到页面上（探针读回
                   `matchMedia(...).matches === false`），而页面看不见的偏好会让两个
                   用例断言同一件事。
*/

import { expect, test, type Page } from "@playwright/test";

async function probe(page: Page, reducedMotion: "reduce" | "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  return page.evaluate(() => {
    const node = globalThis.document.createElement("div");
    node.className = "ambilight enabled";
    globalThis.document.body.append(node);
    const before = globalThis.getComputedStyle(node, "::before");
    const result = {
      reduce: globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationName: before.animationName,
      backgroundImage: before.backgroundImage.slice(0, 16),
      position: before.backgroundPosition,
    };
    node.remove();
    return result;
  });
}

test("减动偏好下环境光停住，但那一层还在", async ({ page }) => {
  const seen = await probe(page, "reduce");
  expect(seen.reduce).toBe(true);
  expect(seen.animationName).toBe("none");
  expect(seen.backgroundImage).toContain("gradient");
  // keyframes 的首尾与 CSS 初始值都是这里，所以两边停在同一处，谁也不用钉停车位。
  expect(seen.position).toBe("0px 0px");
});

test("没有表达偏好时环境光照常游走", async ({ page }) => {
  const seen = await probe(page, "no-preference");
  expect(seen.reduce).toBe(false);
  // 形状断言：上面那个 none 必须是「被收住了」，不能是「压根没这条规则」。
  expect(seen.animationName).toBe("ambilight");
});
