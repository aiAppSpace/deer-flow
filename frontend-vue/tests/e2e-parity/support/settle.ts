/*
  【文件职责】     一道等待：让页面上**有限**的动画/过渡跑完。
  【架构位置】     对照测试基础设施
  【主要导出】     waitForFiniteAnimations · waitForDomQuiet
  【依赖关系】     @playwright/test
  【边界与注意】   **它自己一层，不放在 capture.ts 里**（第三十八轮拆出来的）：
                   `runScenario`（scenarios.ts）在跑交互步骤之前也要用它，而
                   capture.ts 反过来依赖 scenarios.ts——留在 capture.ts 里就成环。
                   这一层不依赖任何别的东西，两边都能直接引。

                   它自己的行为由 animation-settle.spec.ts 钉着：会等、会放行、
                   不会在无限循环动画上挂死。
*/

import type { Page } from "@playwright/test";

/*
  等到页面上**有限**的动画/过渡都跑完，再取样。

  **它补的是健壮性，没有被证明消除了任何一行台账。** 此前取样前只有一条固定的
  `settleMs = 700`：一个写死的毫秒数，稳不稳完全取决于机器快慢，
  而那正是一条会偶发红的门禁的做法——偶发红的门会被当成噪音忽略掉，等于没有门
  （记忆 `deerflow-gate-needs-an-entrypoint` 的同一形状）。

  **⚠ 这里曾经写着「这条是 CI 上 16 行里 8 行的根因，实测」。那句话是错的，
  别再照它判。** 经过是：加上这道等待后一次 CI 复量到 16 → 8，我据此写下根因；
  **同一棵树的下一次运行又回到 16 行**。三次读数摆在一起才看清——

      run1(无等待) 16 行 | run2(有等待) 8 | run3(有等待) 16
      三次并集 17 行：稳定(3/3) 8 行，飘的 9 行

  那 8 行稳定的是真差异（`integrations` mobile 的宽度 Δ4.1–4.2、
  `artifact-table-preview` 的 y 偏移），**其余 9 行是这把尺子自己在飘**，
  run2 只是一次异常采样。

  **判据：一次运行是一个样本。** 判「修好了」要同一棵树连着量到稳定；
  判「飘」两次不一致就够。**飘和修好在单次读数上长得一模一样。**
  逐行出现模式与后续判词记在
  docs/plans/vue-parity-open-accounts.md 第三十七轮条目。

  **必须排除无限循环的动画**：子任务卡片底下那层 `.ambilight` 是自动播放、
  无限循环的装饰动画（见 sampleGeometry 里 `anim=` 那段注释），
  等它「结束」会每个场景都等满超时——156 个场景 × 2 秒在本机照样绿，
  在 CI 上就是白烧一轮 25 分钟。判据用 `getComputedTiming().iterations`
  **算**出来，不用动画名单：名单会过期，而「这条动画有没有终点」是算得出来的。

  超时了**不抛**：取样本身不该变成失败源（同 `postData()` 那处的判词）。
  真有一条无限动画漏网时，它造成的差异会在几何档上照样看得见。
*/
export async function waitForFiniteAnimations(page: Page, timeout = 2_000) {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running")
          .every(
            (animation) =>
              animation.effect?.getComputedTiming().iterations === Infinity,
          ),
      undefined,
      { timeout },
    )
    .catch(() => undefined);
}

/*
  等到 DOM **不再自己变**为止。

  **它补的是 `waitForFiniteAnimations` 补不到的那一半。** 那道等待只看动画；
  而一屏可以在没有任何动画的情况下继续变——折叠块到点自动收起、迟到的标志、
  侧栏分区等接口回来才渲染。第三十八轮逐条扫过 57 个场景键：
  `settle` 之后隔 1.5 秒再读一次页面，**3 条的文本或属性变了**
  （`showcase-public-thread` / `sidebar-collapsed` / `background-tasks#disabled`）。

  **为什么这件事必须由尺子来做，而不是逐条场景补断言：**
  取样落在一个还在变的相位上时，两个应用只要错开一点点就会一边采到变前、
  一边采到变后，**凭空报出几行**；反过来，两边一起采早了就是「一致」——
  第三十八轮实证 `streaming-reasoning-order` 的那个 0 行正是这么来的，
  **它从来不说明任何事情**。逐条补断言只覆盖有人想起来写的那几条。

  **按状态等，不按秒表等**：用 MutationObserver 数「安静了多久」，而不是睡固定毫秒。
  安静窗口取 250ms；超时 3s 之后**不抛**，取样本身不该变成失败源
  （同 `waitForFiniteAnimations` 的判词）。真有一屏永远静不下来（比如一个每秒
  自增的相对时间），它造成的差异会在别的档上照样看得见。

  ⚠ **它不是用来掩盖「一边比另一边慢」的**：那种差异是性能特征，由各自的门禁守；
  这里要的是「两个应用都停在自己的稳定态上再比」。
*/
export async function waitForDomQuiet(
  page: Page,
  quietMs = 250,
  timeout = 3_000,
) {
  await page
    .evaluate(
      ([quiet, cap]) =>
        new Promise<void>((resolve) => {
          let timer = 0;
          const done = () => {
            observer.disconnect();
            window.clearTimeout(timer);
            window.clearTimeout(hardStop);
            resolve();
          };
          const observer = new MutationObserver(() => {
            window.clearTimeout(timer);
            timer = window.setTimeout(done, quiet);
          });
          observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
          });
          timer = window.setTimeout(done, quiet);
          const hardStop = window.setTimeout(done, cap);
        }),
      [quietMs, timeout] as const,
    )
    .catch(() => undefined);
}
