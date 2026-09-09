/*
  【文件职责】     钉住「等元素停稳」的判据：**三次跨度要盖过那段过渡**。
  【架构位置】     单元测试
  【依赖关系】     tests/support/settled-box.ts
  【边界与注意】   这里不测 Playwright，只测判据本身——因为出错的方式恰恰在判据上：
                   「两次读数相同」在**过渡开始之前**就成立，于是量到起点、按空。
*/

import { describe, expect, it } from "vitest";

import {
  SETTLE_SAMPLES,
  isSameBox,
  waitForSettledBox,
} from "../../support/settled-box";

const box = (x: number) => ({ x, y: 0, width: 1, height: 100 });

/** 按脚本一次一个地给出读数；`sleep` 不真的等。 */
function scriptedReader(sequence: (number | null)[]) {
  let index = 0;
  const seen: number[] = [];
  return {
    readBox: async () => {
      const value = sequence[Math.min(index, sequence.length - 1)] ?? null;
      index += 1;
      if (value !== null) seen.push(value);
      return value === null ? null : box(value);
    },
    sleep: async () => {},
    reads: () => index,
    seen,
  };
}

describe("等元素停稳", () => {
  it("过渡还在走的时候不返回", async () => {
    // 起点重复一次（过渡尚未开始），随后一路移动，最后停在 787。
    const reader = scriptedReader([
      1119, 1119, 889, 810, 792, 787, 787, 787, 787,
    ]);
    const settled = await waitForSettledBox(reader);
    expect(settled.x, "在起点上凑够两次相同就返回，量到的会是 1119").toBe(787);
  });

  it("连续相同的次数不够就继续等", async () => {
    const reader = scriptedReader([100, 100, 100, 200, 200, 200, 200]);
    const settled = await waitForSettledBox(reader);
    expect(settled.x).toBe(200);
    // 第一段只连着相同 2 次（SETTLE_SAMPLES 是 3），不该在那里返回。
    expect(SETTLE_SAMPLES).toBeGreaterThan(2);
  });

  it("一直动就抛错，而不是返回一个动着的读数", async () => {
    let x = 0;
    await expect(
      waitForSettledBox({
        readBox: async () => box((x += 10)),
        sleep: async () => {},
        now: (() => {
          let t = 0;
          return () => (t += 400);
        })(),
        timeoutMs: 1_000,
        label: "分隔条",
      }),
    ).rejects.toThrow(/分隔条.*没有停下来/);
  });

  it("读不到盒子不算「没动」", () => {
    expect(isSameBox(null, null)).toBe(false);
    expect(isSameBox(box(1), null)).toBe(false);
  });

  it("小于一个设备像素的抖动算没动", () => {
    expect(isSameBox(box(787), box(787.4))).toBe(true);
    expect(isSameBox(box(787), box(787.6))).toBe(false);
  });
});
