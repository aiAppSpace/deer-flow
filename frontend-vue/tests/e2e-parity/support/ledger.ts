/*
  【文件职责】     把对照台账摊平成「一处差异一行」，并算出一次 accept 会新增哪些行。
  【架构位置】     对照测试支持模块
  【主要导出】     DiffEntry · ledgerRows · addedRows
  【依赖关系】     无
  【边界与注意】   **抽出来是为了能被单测直接打**。这两个函数唯一的消费者是
                   `diff.spec.ts` 的 accept 分支，而那条分支只有在台账**将要变长**
                   时才会走到——台账当前是 0 行，跑真的 `make parity-accept`
                   永远走不到它。留在 spec 里就等于一段没人验过的逻辑
                   （wave 83/84 反复撞见的那一类）。

                   **判据是集合包含，不是行数。** 修好一条、同时新坏一条，
                   行数不变而台账里多了一行没人看过的东西——那正是 Makefile 里
                   那句「把回归洗白的按钮」说的样子。
*/

export type DiffEntry = {
  ariaOnlyReact: string[];
  ariaOnlyVue: string[];
  requestsOnlyReact: string[];
  requestsOnlyVue: string[];
  /** 锚点的几何与色板差异，一行一处。 */
  geometry: string[];
  /**
   * 取样时刻焦点落在哪里。差异时一行，相同时空数组。
   *
   * 台账天生看不见的第八类（wave 28 记下、wave 94 才补上）：
   * `document.activeElement` 不进 aria 快照、不是几何量、也不是请求，
   * 所以「打开这一屏之后光标在哪」在这之前只能靠临时 probe 量。
   */
  focus: string[];
  /**
   * 两边**共有**的可访问节点的相对顺序差异，最多一行（只报第一处分岔）。
   *
   * 「台账天生看不见的八类」里的第④类：`diffAriaLines` 按多重集比，
   * 顺序天然测不出来。wave 95 补上，做法见 `diffAriaOrder`。
   */
  order: string[];
  /**
   * 只在一边能用 Tab 走到的元素，双向多重集差异。
   *
   * 与 aria 那一档的区别是**「能不能 tab 到」**：节点在树里好端端待着、
   * 却因为 `tabindex="-1"` / `disabled` / 被盖住而走不到，aria 一档报不出来。
   */
  tabbablesOnlyReact: string[];
  tabbablesOnlyVue: string[];
  /** 两边**共有**的可 tab 元素的相对顺序差异，最多一行（只报第一处分岔）。 */
  tabOrder: string[];
  /**
   * 两边**都恰好出现一次**的节点，挂在树里的**深度**不同。
   *
   * 「天生看不见的八类」第④类的另一半。wave 99 做过一次、量到 0 行就撤了，
   * **而那个 0 是数据造成的**：`normalizeAriaSnapshot` 把每层缩进都塌成一个空格
   * （wave 122），层级信息在归一化那一步就没了。wave 123 在保住缩进的数据上重量
   * 得到 6 行，wave 124 查明是**划词工具条被渲染在 `role="log"` 里面**——
   * 那一处 **aria 行 / 顺序 / 几何 / tab 序 / 焦点 / 命中六档全是 0**，
   * 只有这一档看得见。wave 125 因此把它做成常驻的一档。
   */
  depth: string[];
};

/**
 * `DiffEntry` 的字段名，**运行时也能读到的那一份**。
 *
 * 存在的理由：`scripts/parity-ledger-report.mjs` 是 `.mjs`，读不到 TS 类型，
 * 只能自己抄一份字段表。实测它抄漏了——那份表停在 5 个字段，而这里已经有 11 个，
 * 于是那个报告**六档差异一行都没算进去**，还照样打印出一个像模像样的总数。
 * 它自己的文件头写着「多一个少一个都要在这里显式加」，而**当时没有任何机器在守**
 * （现在有了，见下面点名的那道门）。
 *
 * **证据是门禁不是类型**：要对的是**三方**——这份表、那个 `.mjs` 脚本自己抄的
 * 一份表、以及签入基线里真实出现的字段；脚本读不到 TS 类型，类型层断言够不着它。
 * （原文这里写的是「`tests/` 整棵树不在 `make typecheck` 的 include 里」。
 * **那句话从 2026-09-11 起是假的**——`make typecheck-tests` 已接进 `make verify`；
 * 理由换成上面那条，结论不变。门禁：tests/guards/stale-coverage-claims.test.ts。）
 * 判据落在
 * tests/guards/parity-ledger-fields.test.ts：它把这份表、那个脚本的表、
 * 以及签入基线里真实出现的字段三方对账。
 */
export const DIFF_ENTRY_FIELDS = [
  "ariaOnlyReact",
  "ariaOnlyVue",
  "requestsOnlyReact",
  "requestsOnlyVue",
  "geometry",
  "focus",
  "order",
  "tabbablesOnlyReact",
  "tabbablesOnlyVue",
  "tabOrder",
  "depth",
] as const;

/** 摊平成 `场景键 · 字段: 那一行` 的形式，排序后返回。 */
export function ledgerRows(entries: Record<string, DiffEntry>): string[] {
  const rows: string[] = [];
  for (const [key, entry] of Object.entries(entries)) {
    for (const [field, lines] of Object.entries(entry)) {
      for (const line of lines) rows.push(`${key} · ${field}: ${line}`);
    }
  }
  return rows.sort();
}

/** `next` 里有、而 `previous` 里没有的行。空数组 = 这次 accept 只让台账变短。 */
export function addedRows(
  previous: Record<string, DiffEntry>,
  next: Record<string, DiffEntry>,
): string[] {
  const before = new Set(ledgerRows(previous));
  return ledgerRows(next).filter((row) => !before.has(row));
}
