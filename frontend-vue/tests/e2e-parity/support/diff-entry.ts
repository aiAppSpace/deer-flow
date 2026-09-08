/*
  【文件职责】     把一对样本（React / Vue）折成台账的一行组——**判词只有这一处定义**。
  【架构位置】     对照套件的支撑代码
  【主要导出】     buildDiffEntry · countPseudoSamples
  【依赖关系】     scripts/lib/aria-parity.mjs · support/capture
  【边界与注意】   wave 190 从 e2e-parity/diff.spec.ts 里原样抽出来，**一个字都没改**，
                   目的只有一个：开鉴权那套对照（e2e-parity-auth）要用同一套判词。

                   为什么不复制一份：这一整段（wave 181~187）反复撞见的正是
                   「同一份东西存在多份拷贝，其中一份悄悄落后」——三份 nginx 配置、
                   两份守卫各写一份名单。**判词是这个工厂的尺子**，尺子有两把、
                   而两把不一样，比没有尺子更糟：两套结论会互相印证地错下去。

                   抽出来之后原来那份 spec 的行为必须**逐字不变**，判据是签入的
                   baseline/parity-diff.json 一行都不动——wave 190 跑过一次全套确认。
*/
import {
  diffAriaDepth,
  diffAriaLines,
  diffAriaOrder,
  diffSequenceOrder,
} from "../../../scripts/lib/aria-parity.mjs";
import type { GeometrySample, ParityCapture } from "./capture";

const GEOMETRY_TOLERANCE_PX = 2;

/** 多重集差异，与 aria 用同一套办法：同一条出现三次和出现一次不是一回事。 */
export function diffMultiset(react: string[], vue: string[]) {
  const count = (items: string[]) => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return map;
  };
  const reactCount = count(react);
  const vueCount = count(vue);
  const onlyReact: string[] = [];
  const onlyVue: string[] = [];
  for (const [item, n] of reactCount) {
    for (let i = 0; i < n - (vueCount.get(item) ?? 0); i++)
      onlyReact.push(item);
  }
  for (const [item, n] of vueCount) {
    for (let i = 0; i < n - (reactCount.get(item) ?? 0); i++)
      onlyVue.push(item);
  }
  return { onlyReact: onlyReact.sort(), onlyVue: onlyVue.sort() };
}

export function diffGeometry(
  react: Record<string, GeometrySample | null>,
  vue: Record<string, GeometrySample | null>,
) {
  const lines: string[] = [];
  for (const label of [
    ...new Set([...Object.keys(react), ...Object.keys(vue)]),
  ].sort()) {
    const r = react[label] ?? null;
    const v = vue[label] ?? null;
    /*
      两边都没取到 → 跳过，不是差异。

      wave 76 把 `steps` 里的 `visible` 也接成了锚点，而那些锚点到取样时
      可能已经被后续步骤换掉了（`artifact-batched-stream` 一路点过好几个文件）。
      **两个应用同时没有它，就没有可比的几何**；一边有一边没有仍然要报。
    */
    if (!r && !v) continue;
    if (!r || !v) {
      lines.push(
        `${label} 取样缺失 React=${r ? "有" : "无"} Vue=${v ? "有" : "无"}`,
      );
      continue;
    }
    for (const field of ["x", "y", "width", "height"] as const) {
      const delta = Math.round((v[field] - r[field]) * 10) / 10;
      if (Math.abs(delta) > GEOMETRY_TOLERANCE_PX) {
        lines.push(
          `${label} ${field} React=${r[field]} Vue=${v[field]} Δ${delta}`,
        );
      }
    }
    for (const field of [
      "color",
      "background",
      "fontSize",
      "fontWeight",
      "opacity",
      "hit",
      "before",
      "after",
    ] as const) {
      if (r[field] !== v[field]) {
        lines.push(`${label} ${field} React=${r[field]} Vue=${v[field]}`);
      }
    }
  }
  return lines;
}

/** 一个取样点上，两个应用之间所有档的差异。 */
export function buildDiffEntry(react: ParityCapture, vue: ParityCapture) {
  const aria = diffAriaLines(react.aria, vue.aria);
  const requests = diffMultiset(react.requests, vue.requests);
  const tabbables = diffMultiset(react.tabbables, vue.tabbables);
  return {
    ariaOnlyReact: aria.onlyReact,
    ariaOnlyVue: aria.onlyVue,
    requestsOnlyReact: requests.onlyReact,
    requestsOnlyVue: requests.onlyVue,
    geometry: diffGeometry(react.geometry, vue.geometry),
    focus:
      react.focus === vue.focus
        ? []
        : [`React=${react.focus} Vue=${vue.focus}`],
    order: diffAriaOrder(react.aria, vue.aria),
    depth: diffAriaDepth(react.ariaTree, vue.ariaTree),
    tabbablesOnlyReact: tabbables.onlyReact,
    tabbablesOnlyVue: tabbables.onlyVue,
    tabOrder: diffSequenceOrder(
      react.tabbables,
      vue.tabbables,
      "公共可 tab 元素",
    ),
  };
}

/**
 * 这一对样本里，伪元素那一档**真的采到东西**的锚点数。
 *
 * 这一档在干净树上是 0 行——而 0 行有两种：**算出来的 0** 和**没算的 0**。
 * `pseudo()` 里但凡写错一句，它会永远返回 `none`，两边一致、台账 0 行，
 * 而且没有任何一条用例会红（线索 131 的形状：尺子坏了会让它守的那件事静默全绿）。
 */
export function countPseudoSamples(
  react: ParityCapture,
  vue: ParityCapture,
): number {
  let found = 0;
  for (const sample of [
    ...Object.values(react.geometry),
    ...Object.values(vue.geometry),
  ]) {
    if (!sample) continue;
    if (sample.before !== "none") found += 1;
    if (sample.after !== "none") found += 1;
  }
  return found;
}
