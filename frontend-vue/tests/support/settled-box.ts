/*
  【文件职责】     「等到元素真的停下来再量它的位置」——拖拽类用例的公共前提。
  【架构位置】     e2e 支撑代码（不进产物）
  【主要导出】     waitForSettledBox · settledBox · SETTLE_SAMPLES · SETTLE_SAMPLE_MS
  【依赖关系】     @playwright/test（仅 Locator 类型）
  【边界与注意】   **不要依赖 `hover()` 自带的可操作性等待来对准一个小目标。**

                   Playwright 判「稳定」用的是**相邻两个动画帧**的盒子相同。
                   整套并行跑（本机默认 6 个 worker）时渲染帧会被饿着，两次 rAF
                   之间可能压根没有重新排版，于是它提前判稳，而元素还在动。

                   代价有多大，wave 198 量过：artifact 面板打开时 splitpanes 给
                   窗格的是 `width .2s ease-out`，分隔条 200ms 内从 1119 滑到 787
                   （332px），而它的命中区只有 16px。探针实测——

                       面板可见后等 0ms   → 量到 x=1118 → 拖完面板仍可见
                       面板可见后等 60ms  → 量到 x=889  → 拖完面板仍可见
                       面板可见后等 110ms → 量到 x=787  → 折叠成功

                   **按在过渡途中的读数上，整个拖拽什么都不会发生**，而报出来的是
                   十秒后的「面板没关」——一条指着面板、与真正问题隔着十万八千里的
                   断言。wave 196 那次整套红留下的 trace 里量到的中心是 **801**，
                   正落在上表 889 与 787 之间。

                   **帧饥饿本身没能单独复现**（CPU 节流复现不出来），所以这里不去赌
                   那个启发式：改成用**真实时间间隔**判稳。

                   **判据是「连续 3 次、每次间隔 100ms 都不动」，不是「两次读数相同」。**
                   两次不够：面板刚可见时窗格宽度还是 0、过渡才要开始，
                   两次快读拿到的是同一个**起始**位置，当场判稳照样抓空
                   （第一版就栽在这里，按在了 1091）。三次跨度 300ms > 那 200ms 过渡。
*/

import type { Locator } from "@playwright/test";

export const SETTLE_SAMPLE_MS = 100;
export const SETTLE_SAMPLES = 3;
export const SETTLE_TIMEOUT_MS = 5_000;
/** 小于一个设备像素就算没动——`boundingBox` 会给出小数。 */
export const SETTLE_EPSILON_PX = 0.5;

export type Box = { x: number; y: number; width: number; height: number };

export function isSameBox(a: Box | null, b: Box | null): boolean {
  return (
    a !== null &&
    b !== null &&
    Math.abs(a.x - b.x) < SETTLE_EPSILON_PX &&
    Math.abs(a.y - b.y) < SETTLE_EPSILON_PX
  );
}

export async function waitForSettledBox(options: {
  readBox: () => Promise<Box | null>;
  sleep: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  label?: string;
}): Promise<Box> {
  const {
    readBox,
    sleep,
    now = Date.now,
    timeoutMs = SETTLE_TIMEOUT_MS,
    label = "元素",
  } = options;
  const deadline = now() + timeoutMs;
  let previous = await readBox();
  let unchanged = 0;
  while (now() < deadline) {
    await sleep(SETTLE_SAMPLE_MS);
    const current = await readBox();
    unchanged = isSameBox(previous, current) ? unchanged + 1 : 0;
    previous = current;
    if (unchanged >= SETTLE_SAMPLES && previous !== null) return previous;
  }
  throw new Error(
    `${label}在 ${timeoutMs}ms 内没有停下来，量不到稳定的位置——` +
      `按在动着的读数上，拖拽会静默地什么都不做`,
  );
}

export function settledBox(handle: Locator, label?: string): Promise<Box> {
  return waitForSettledBox({
    readBox: () => handle.boundingBox(),
    sleep: (ms) => handle.page().waitForTimeout(ms),
    label,
  });
}
