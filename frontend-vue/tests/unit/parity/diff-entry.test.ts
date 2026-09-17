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
            fontFamily: "ui-sans-serif",
            borderRadius: "0px",
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

  /*
    **伪元素的 `w=` / `h=` 也是像素，要走和 x/y/width/height 同一个容差。**

    第三十八轮给 `subtask-card` 补 mobile 维之后当场报出 0.1px 的一行：

        [data-slot="ambilight"] before  React=… w=311 h=156  Vue=… w=311 h=155.9

    常规几何有 2px 容差，而伪元素那一档此前按整串精确比——同一把尺子对同一种量
    用了两套判据。下面三条钉的是修完之后的性质：**零头放过、真差异照报、
    非像素字段仍然逐字比**。
  */
  it("伪元素：尺寸零头走几何容差，不再报成一行", () => {
    const sample = (h: number) => ({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      color: "c",
      background: "b",
      fontSize: "12px",
      fontWeight: "400",
      fontFamily: "ui-sans-serif",
      borderRadius: "0px",
      opacity: "1",
      hit: "hit",
      before: `content="" op=1 w=311 h=${h} bg=rgba(0,0,0,0) anim=none`,
      after: "none",
    });
    expect(
      buildDiffEntry(
        capture({ geometry: { a: sample(156) } }),
        capture({ geometry: { a: sample(155.9) } }),
      ).geometry,
    ).toEqual([]);

    // 超出容差仍然报。
    expect(
      buildDiffEntry(
        capture({ geometry: { a: sample(156) } }),
        capture({ geometry: { a: sample(150) } }),
      ).geometry,
    ).toHaveLength(1);
  });

  it("伪元素：非像素字段差一点就是真差一点，不吃容差", () => {
    const sample = (anim: string) => ({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      color: "c",
      background: "b",
      fontSize: "12px",
      fontWeight: "400",
      fontFamily: "ui-sans-serif",
      borderRadius: "0px",
      opacity: "1",
      hit: "hit",
      before: `content="" op=1 w=311 h=156 bg=rgba(0,0,0,0) anim=${anim}`,
      after: "none",
    });
    expect(
      buildDiffEntry(
        capture({ geometry: { a: sample("none") } }),
        capture({ geometry: { a: sample("ambilight") } }),
      ).geometry,
    ).toHaveLength(1);
  });

  it("伪元素：`none` 与真的有一个，永远算差异", () => {
    const base = {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      color: "c",
      background: "b",
      fontSize: "12px",
      fontWeight: "400",
      fontFamily: "ui-sans-serif",
      borderRadius: "0px",
      opacity: "1",
      hit: "hit",
      after: "none",
    };
    expect(
      buildDiffEntry(
        capture({
          geometry: {
            a: { ...base, before: 'content="" op=1 w=1 h=1 bg=x anim=none' },
          },
        }),
        capture({ geometry: { a: { ...base, before: "none" } } }),
      ).geometry,
    ).toHaveLength(1);
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
      fontFamily: "ui-sans-serif",
      borderRadius: "0px",
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

/*
  **一把新尺子最先要量的是它自己**（坑 213 / 186）。`borderRadius` 这一档加进来的
  理由是「现有各档都看不见形状」，那就得证明两件事：它在形状变了的时候**会响**，
  以及它在别的什么都没变的时候**不会响**——否则它只是往台账里灌噪声。
*/
describe("borderRadius 这一档", () => {
  const base = {
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    color: "c",
    background: "b",
    fontSize: "12px",
    fontWeight: "400",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    borderRadius: "16px",
    opacity: "1",
    hit: "self",
    before: "none",
    after: "none",
  };

  it("只改圆角时它响，而其余各档一条都不响", () => {
    const entry = buildDiffEntry(
      capture({ geometry: { panel: base } }),
      capture({ geometry: { panel: { ...base, borderRadius: "6px" } } }),
    );
    expect(entry.geometry).toEqual(["panel borderRadius React=16px Vue=6px"]);
    // 其余各档必须是空的：这一行就是「现有的档看不见形状」那句话的机器版本。
    for (const lane of [
      entry.ariaOnlyReact,
      entry.ariaOnlyVue,
      entry.order,
      entry.tabOrder,
      entry.requestsOnlyReact,
      entry.requestsOnlyVue,
    ])
      expect(lane).toEqual([]);
  });

  it("圆角相同时不报（四段写法逐字比，不做归一）", () => {
    const corners = { ...base, borderRadius: "8px 8px 0px 0px" };
    const entry = buildDiffEntry(
      capture({ geometry: { panel: corners } }),
      capture({ geometry: { panel: { ...corners } } }),
    );
    expect(entry.geometry).toEqual([]);
  });

  /*
    字体栈这一档与圆角那一条同形：**它是最后一处「文本量得出来、各档都看不见」
    的盲区**。宽度由文本撑出来时（grid/flex 子项卡在 min-content 上，本仓好几处
    就是这样），换一套字体宽度就变，而位置/尺寸之外的每一档都不响。

    判据照坑 258 那句：**有没有一种变异能让它响、而现有的档都不响**——
    这里就是现成答案：只改 `fontFamily`，其余各档一行不动。
  */
  it("只改字体栈时它响，而其余各档一条都不响", () => {
    const entry = buildDiffEntry(
      capture({ geometry: { panel: base } }),
      capture({
        geometry: {
          panel: { ...base, fontFamily: "ui-sans-serif, system-ui" },
        },
      }),
    );
    expect(entry.geometry).toEqual([
      "panel fontFamily React=ui-sans-serif, system-ui, sans-serif Vue=ui-sans-serif, system-ui",
    ]);
    for (const lane of [
      entry.ariaOnlyReact,
      entry.ariaOnlyVue,
      entry.order,
      entry.tabOrder,
      entry.requestsOnlyReact,
      entry.requestsOnlyVue,
    ])
      expect(lane).toEqual([]);
  });

  it("字体栈相同时不报", () => {
    const entry = buildDiffEntry(
      capture({ geometry: { panel: base } }),
      capture({ geometry: { panel: { ...base } } }),
    );
    expect(entry.geometry).toEqual([]);
  });
});
