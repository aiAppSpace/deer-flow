/*
  【文件职责】     钉住取样前那道「等有限动画跑完」的等待：会等、会放行、不会挂死。
  【架构位置】     E2E 套件（对照）
  【主要导出】     无
  【依赖关系】     support/settle.ts 的 waitForFiniteAnimations
  【边界与注意】   **用 `page.setContent()`，两个应用一个都不碰。** 判据是这道等待
                   本身的行为，跟产品页面没关系；挂在真页面上反而要先把某个组件
                   的过渡时长钉死，那是给判据找一个会过期的坐标系。

                   **为什么值得单独钉**：它的失败模式是**挂死**——漏掉
                   `iterations === Infinity` 那条排除，子任务卡片那层永不停的
                   `.ambilight` 会让每个场景都等满超时。156 个场景 × 2 秒
                   在本机看不出来（照样绿），在 CI 上就是白烧一轮 25 分钟。

                   它进的是 parity 套件而不是别的：这道等待是对照取样器的一部分，
                   放到别处就要把 `support/capture.ts` 跨套件 import 进来。
                   兄弟应用缺席时整组跳过，与本套件其余 spec 一致。
*/

import { expect, test } from "@playwright/test";

import { waitForFiniteAnimations } from "./support/settle";
import { reactAppPresent } from "./support/react-preview";

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

/** 一个 400ms 的过渡，外加一条无限循环的装饰动画。 */
const PAGE = `<!doctype html><meta charset="utf-8"><style>
  @keyframes spin { from { rotate: 0deg } to { rotate: 360deg } }
  #forever { animation: spin 200ms linear infinite; }
  #fading { background: rgb(0 0 0); transition: background 400ms linear; }
  #fading.done { background: rgb(255 255 255); }
</style><div id="forever">∞</div><div id="fading">fade</div>`;

test("有限过渡跑完之前不放行，跑完之后放行", async ({ page }) => {
  await page.setContent(PAGE);
  await page.evaluate(() => document.getElementById("fading")!.offsetWidth);
  await page.evaluate(() =>
    document.getElementById("fading")!.classList.add("done"),
  );

  const startedAt = Date.now();
  await waitForFiniteAnimations(page);
  const waited = Date.now() - startedAt;

  /*
    只断言「等到了过渡结束」，不断言等了多久的上界：上界会把这条用例变成
    一条跟 runner 快慢赛跑的门。判据是**读到的是终值**——那正是 CI 上
    alpha 读成 230 而不是 255 的那件事。
  */
  expect(waited).toBeGreaterThanOrEqual(300);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          getComputedStyle(document.getElementById("fading")!).backgroundColor,
      ),
    )
    .toBe("rgb(255, 255, 255)");
});

test("只剩无限循环动画时立刻放行，不等到超时", async ({ page }) => {
  await page.setContent(PAGE);

  const startedAt = Date.now();
  await waitForFiniteAnimations(page, 5_000);
  const waited = Date.now() - startedAt;

  // 挂死是这道等待唯一的严重失败模式：漏掉 Infinity 那条排除就会等满 5 秒。
  expect(waited).toBeLessThan(2_000);
  // 形状先断言：那条无限动画得真的在跑，否则上面那条在空集上恒绿。
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running")
          .some((a) => a.effect?.getComputedTiming().iterations === Infinity),
      undefined,
    ),
  ).toBe(true);
});
