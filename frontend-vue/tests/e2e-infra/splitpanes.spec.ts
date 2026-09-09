/*
  【文件职责】     用真实浏览器手势验证 splitpanes H1/H2/H6 可行性。
  【架构位置】     测试
  【主要导出】     @splitpanes case
  【依赖关系】     使用 /__m0/splitpanes
  【边界与注意】   不能退化为源码字符串搜索。
*/

import { expect, test } from "@playwright/test";
import { settledBox } from "../support/settled-box";

test("@splitpanes one group supports three right panes, declarative collapse and release event", async ({
  page,
}) => {
  await page.goto("/__m0/splitpanes");
  await expect(page.locator("[data-pane^=right-]")).toHaveCount(3);
  await expect(page.locator("[data-pane-group] .splitpanes__pane")).toHaveCount(
    4,
  );

  await page.locator("[data-collapse]").click();
  await expect
    .poll(() =>
      page
        .locator("[data-pane^=right-]")
        .evaluateAll((nodes) =>
          nodes.map((node) =>
            Math.round(node.parentElement?.getBoundingClientRect().width ?? -1),
          ),
        ),
    )
    .toEqual([0, 0, 0]);

  await page.locator("[data-restore]").click();
  await expect
    .poll(() =>
      page
        .locator("[data-pane^=right-]")
        .evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              (node.parentElement?.getBoundingClientRect().width ?? 0) > 0,
          ),
        ),
    )
    .toBe(true);

  const splitter = page.locator(".splitpanes__splitter").first();
  /*
    Restore animates the layout back, so the box has to be read **after** it
    stops moving.

    这里原来写的是「`hover()` 的可操作性等待包含『元素已停止移动』」——
    **wave 198 证伪了这句话**：那条等待判的是**相邻两个动画帧**的盒子相同，
    整套并行跑时渲染帧会被饿着，两次 rAF 之间可能没有重新排版，于是提前判稳。
    改用按真实时间间隔判稳的 `settledBox`，理由与实测读数见它的文件头。
  */
  const box = await settledBox(splitter, "splitter");
  const resizedBefore = Number(
    await page.locator("[data-resized-count]").textContent(),
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 5 });
  await expect
    .poll(async () =>
      Number(await page.locator("[data-resize-count]").textContent()),
    )
    .toBeGreaterThan(0);
  expect(Number(await page.locator("[data-resized-count]").textContent())).toBe(
    resizedBefore,
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.locator("[data-resized-count]").textContent()),
    )
    .toBeGreaterThan(resizedBefore);
});
