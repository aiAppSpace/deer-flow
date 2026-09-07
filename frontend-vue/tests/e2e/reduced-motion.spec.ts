/*
  【文件职责】     钉住两条装饰动画在减动偏好下停住、但都不消失：子任务卡片那层
                   环境光（ambilight）与「还在跑」文字上的高光（shimmer）。
  【架构位置】     产品合同套件（tests/e2e，无需 route mock）
  【主要导出】     无；Playwright 用例
  【边界与注意】   与上游 `frontend/tests/e2e/reduced-motion.spec.ts` 是同一份合同的两侧。
                   **ambilight 是 wave 161 两边同改的**：自动播放、无限循环、纯装饰
                   （WCAG 2.2.2，A 级），此前两个应用都不理会 `prefers-reduced-motion`；
                   `main.css` 里那段注释当时写的正是「刻意不加：上游没有，要改得两边同改」。
                   **shimmer 是 wave 162 两边同改的**——上游那份 spec 只覆盖 ambilight，
                   因为它的 Shimmer 由 motion/react 驱动、jsdom 里就能观察到位移，钉在
                   `frontend/tests/unit/components/ui/reduced-motion.dom.test.tsx`；
                   本仓的 Shimmer 是 scoped CSS，只能在真浏览器里核。

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

/*
  Shimmer 那条同理，只是它的样式是 **scoped** 的：编译产物里选择器长成
  `.shimmer[data-v-xxxxxxxx]`。所以先从浏览器解析好的 CSSOM 里把那个 data 属性名捞
  出来，再造一个带同样属性的元素——核的仍然是 `getComputedStyle` 算出来的东西，
  不是 CSS 源文本。

  停住的位置是 `100% center`，也就是这条动画自己的起始帧：那一帧里高光带在元素左
  边界之外，文字整段由底下那层实心 `--color-muted-foreground` 画出来，读得清。
  「还在跑」这几个字不会消失，只是不再有光扫过。上游 `ai-elements/shimmer.tsx` 用
  motion/react（默认不理会这个媒体特性），wave 162 两边同改成同一个停车位。
*/
async function probeShimmer(
  page: Page,
  reducedMotion: "reduce" | "no-preference",
) {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/workspace/chats/new");
  return page.evaluate(() => {
    // scoped 属性名只能从编译产物里拿：源文件里没有它。
    let scopeAttribute: string | null = null;
    for (const sheet of Array.from(globalThis.document.styleSheets)) {
      let rules: CSSRule[];
      try {
        rules = Array.from(sheet.cssRules);
      } catch {
        continue;
      }
      const walk = (list: CSSRule[]) => {
        for (const rule of list) {
          const nested = (rule as CSSGroupingRule).cssRules;
          if (nested) walk(Array.from(nested));
          const selector = (rule as CSSStyleRule).selectorText;
          const found = selector?.match(/\.shimmer\[(data-v-[0-9a-f]+)\]/);
          if (found?.[1]) scopeAttribute = found[1];
        }
      };
      walk(rules);
    }
    if (!scopeAttribute) return { scopeAttribute, animationName: null };
    const node = globalThis.document.createElement("p");
    node.className = "shimmer";
    node.setAttribute(scopeAttribute, "");
    // 组件把时长写成内联变量；缺了它 `animation: shimmer var(--shimmer-duration) …`
    // 整条声明作废，computed 会读回 `none` —— 那个 none 与「被减动收住」长得一样。
    node.style.setProperty("--shimmer-duration", "2s");
    globalThis.document.body.append(node);
    const animationName = globalThis.getComputedStyle(node).animationName;
    const position = globalThis.getComputedStyle(node).backgroundPosition;
    node.remove();
    return { scopeAttribute, animationName, position };
  });
}

test("减动偏好下高光不再扫，文字停在读得清的那一帧", async ({ page }) => {
  const seen = await probeShimmer(page, "reduce");
  // 形状断言：没捞到 scoped 属性就说明这条规则压根没进样式表，下面的 none 是假的。
  expect(seen.scopeAttribute).toMatch(/^data-v-/);
  expect(seen.animationName).toBe("none");
  expect(seen.position).toBe("100% 50%");
});

test("没有表达偏好时高光照常扫", async ({ page }) => {
  const seen = await probeShimmer(page, "no-preference");
  expect(seen.scopeAttribute).toMatch(/^data-v-/);
  // scoped 样式里的 @keyframes 会被改名（实测 `shimmer-b57f278c`），所以按前缀匹配：
  // 钉死那串哈希等于让一次无关的样式改动把这条门禁弄红。
  expect(seen.animationName).toMatch(/^shimmer(-[0-9a-f]+)?$/);
});
