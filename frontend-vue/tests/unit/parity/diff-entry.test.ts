/*
  【文件职责】     钉住台账判词本身——**这个工厂的尺子**。
  【架构位置】     单测
  【主要导出】     无
  【依赖关系】     tests/e2e-parity/support/diff-entry
  【边界与注意】   wave 190 把判词从 `e2e-parity/diff.spec.ts` 里抽出来共享之后补的。

                   在此之前它只有一个消费者，而那个消费者要跑满 11 分钟的浏览器套件
                   才会告诉你它坏没坏。**尺子坏掉的方式恰恰是「两边一致」**：
                   多重集退化成集合、几何容差写反、focus 比较取反——
                   每一种都让台账变短，而变短看起来正是我们想要的结果。

                   所以这里钉的都是**「坏掉时会让差异消失」**的那几条性质，
                   不是它的全部行为。
*/
import { describe, expect, it } from "vitest";

import {
  buildDiffEntry,
  countPseudoSamples,
  diffMultiset,
} from "../../e2e-parity/support/diff-entry";
import type { ParityCapture } from "../../e2e-parity/support/capture";

function capture(overrides: Partial<ParityCapture> = {}): ParityCapture {
  return {
    aria: "",
    ariaTree: [],
    requests: [],
    geometry: {},
    focus: "body",
    tabbables: [],
    ...overrides,
  } as ParityCapture;
}

describe("台账判词", () => {
  it("多重集：同一条出现三次和出现一次不是一回事", () => {
    /*
      退化成集合是这把尺子最容易坏的方式，而且坏了之后台账会**变短**
      ——wave 159 就因为把 `diff` 的输出读成「少一行」而误判过一次。
    */
    const both = diffMultiset(["GET /a", "GET /a"], ["GET /a"]);
    expect(both.onlyReact).toEqual(["GET /a"]);
    expect(both.onlyVue).toEqual([]);
  });

  it("焦点：只在两边不同的时候记一行，而且记的是双方", () => {
    const same = buildDiffEntry(
      capture({ focus: "textarea" }),
      capture({ focus: "textarea" }),
    );
    expect(same.focus).toEqual([]);

    const differs = buildDiffEntry(
      capture({ focus: "body" }),
      capture({ focus: "textarea" }),
    );
    expect(differs.focus).toEqual(["React=body Vue=textarea"]);
  });

  it("两边都没取到几何 → 不是差异；一边有一边没有 → 是", () => {
    const neither = buildDiffEntry(
      capture({ geometry: { anchor: null } }),
      capture({ geometry: { anchor: null } }),
    );
    expect(neither.geometry).toEqual([]);

    const onlyReact = buildDiffEntry(
      capture({
        geometry: {
          anchor: {
            x: 1,
            y: 2,
            width: 3,
            height: 4,
            color: "c",
            background: "b",
            fontSize: "12px",
            fontWeight: "400",
            opacity: "1",
            hit: "hit",
            before: "none",
            after: "none",
          },
        },
      }),
      capture({ geometry: { anchor: null } }),
    );
    expect(onlyReact.geometry).toEqual(["anchor 取样缺失 React=有 Vue=无"]);
  });

  it("伪元素采样计数只数真的采到的，`none` 不算", () => {
    const sample = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      color: "c",
      background: "b",
      fontSize: "12px",
      fontWeight: "400",
      opacity: "1",
      hit: "hit",
      before: "none",
      after: "none",
    };
    expect(
      countPseudoSamples(
        capture({ geometry: { a: sample } }),
        capture({ geometry: { a: sample } }),
      ),
    ).toBe(0);
    expect(
      countPseudoSamples(
        capture({ geometry: { a: { ...sample, after: '"x"' } } }),
        capture({ geometry: { a: sample } }),
      ),
    ).toBe(1);
  });
});
