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

/*
  伪元素描述串里的 `w=` / `h=` **也是像素**，要走和 x/y/width/height 同一个容差。

  **2026-09-18 第三十八轮实测**：给 `subtask-card` 补 mobile 维之后，那一格当场报出

      selector:[data-slot="ambilight"] before
        React=content="" op=1 w=311 h=156   bg=rgba(0,0,0,0) anim=none
        Vue  =content="" op=1 w=311 h=155.9 bg=rgba(0,0,0,0) anim=none

  ——**0.1px**。常规几何有 2px 容差，而伪元素那一档是按整串精确比的，
  于是同一把尺子对同一种量用了两套判据：布局上过得去的零头，在这里变成一行台账。

  做法是把 `w=<数> h=<数>` 拆出来按容差比，**其余部分仍然逐字比**
  （`content` / `opacity` / `bg` / `anim` 都不是像素，差一点就是真差一点）。
  `none` 与任何非 `none` 仍然直接判不等。
*/
const PSEUDO_SIZE = /\bw=(-?[\d.]+) h=(-?[\d.]+)\b/;

function pseudoEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const ma = PSEUDO_SIZE.exec(a);
  const mb = PSEUDO_SIZE.exec(b);
  if (!ma || !mb) return false;
  // 抠掉尺寸之后必须逐字相同，否则不是「零头」而是真差异。
  if (a.replace(PSEUDO_SIZE, "") !== b.replace(PSEUDO_SIZE, "")) return false;
  return (
    Math.abs(Number(ma[1]) - Number(mb[1])) <= GEOMETRY_TOLERANCE_PX &&
    Math.abs(Number(ma[2]) - Number(mb[2])) <= GEOMETRY_TOLERANCE_PX
  );
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
      "fontFamily",
      "borderRadius",
      "opacity",
      "hit",
    ] as const) {
      if (r[field] !== v[field]) {
        lines.push(`${label} ${field} React=${r[field]} Vue=${v[field]}`);
      }
    }
    for (const field of ["before", "after"] as const) {
      if (!pseudoEqual(r[field], v[field])) {
        lines.push(`${label} ${field} React=${r[field]} Vue=${v[field]}`);
      }
    }
  }
  return lines;
}

/**
 * 同一个请求上，两个应用的**请求体**差异。
 *
 * **只比两边都发过的那些键。** 一边发了、另一边没发，那是 `requests` 那一档的事
 * ——在这里再报一次只会让同一处差异有两份投影，而台账的唯一行本来就已经是投影数
 * （2026-09-16 全面审查的结论）。
 *
 * **按「不同的体」的集合比，不按多重集。** 同一个键发几次是 `requestsOnly*`
 * 那一档的事——第三十轮第一跑就撞上了：`thread-list-pin#mobile-drawer` 上
 * React 把 `POST /api/threads/search` 发了两次而 Vue 一次，体**逐字相同**，
 * 于是多重集写法在 requests 与 body 两档各报一行，**同一处差异两份投影**。
 * 用集合比，那一行当场消失，而两边体真不一样时照样报。
 *
 * 体本身可能很长，所以只报**前两条**不同的，并带上总数——
 * 一屏上同一个请求体差异重复二十次，读的人只需要知道"有，且是这一条"。
 */
export function diffRequestBodies(
  react: { key: string; body: string }[],
  vue: { key: string; body: string }[],
) {
  const group = (items: { key: string; body: string }[]) => {
    const map = new Map<string, Set<string>>();
    for (const { key, body } of items)
      map.set(key, (map.get(key) ?? new Set<string>()).add(body));
    return map;
  };
  const reactByKey = group(react);
  const vueByKey = group(vue);
  const lines: string[] = [];
  for (const key of [...reactByKey.keys()].sort()) {
    const vueBodies = vueByKey.get(key);
    if (!vueBodies) continue;
    const reactBodies = reactByKey.get(key) ?? new Set<string>();
    const onlyReact = [...reactBodies].filter((b) => !vueBodies.has(b)).sort();
    const onlyVue = [...vueBodies].filter((b) => !reactBodies.has(b)).sort();
    if (!onlyReact.length && !onlyVue.length) continue;
    const show = (items: string[]) =>
      items.length > 2
        ? `${items.slice(0, 2).join(" | ")} …共 ${items.length} 条`
        : items.join(" | ");
    lines.push(`${key} body React=[${show(onlyReact)}] Vue=[${show(onlyVue)}]`);
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
    requestBodies: diffRequestBodies(
      react.requestBodies ?? [],
      vue.requestBodies ?? [],
    ),
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
 * 这一对样本里，**真的采到请求体**的请求数。
 *
 * 与 `countPseudoSamples` 同一个理由：body 那一档在干净树上也是 0 行，
 * 而 0 有两种——**算出来的 0** 和**没算的 0**。`postData()` 那段但凡写坏
 * （比如把 `raw !== ""` 写反、或者 catch 吞掉了一切），它会永远返回空数组，
 * 两边一致、台账 0 行，而且没有任何一条用例会红。
 */
export function countRequestBodySamples(
  react: ParityCapture,
  vue: ParityCapture,
): number {
  return (react.requestBodies?.length ?? 0) + (vue.requestBodies?.length ?? 0);
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
