/*
  【文件职责】     对照台账字段、逐行展开及新增差异检查。
  【架构位置】     对照测试支持模块
  【主要导出】     DiffEntry · DIFF_ENTRY_FIELDS · ledgerRows · addedRows
  【依赖关系】     无
  【边界与注意】   accept 比较差异行的多重集；新内容和同一差异数量增长均拒绝。
                   字段表由 parity-ledger-fields.test.ts 与报告脚本/签入台账对账。
*/

export type DiffEntry = {
  ariaOnlyReact: string[];
  ariaOnlyVue: string[];
  requestsOnlyReact: string[];
  requestsOnlyVue: string[];
  requestBodies: string[];
  requestFacts: string[];
  geometry: string[];
  focus: string[];
  order: string[];
  tabbablesOnlyReact: string[];
  tabbablesOnlyVue: string[];
  tabOrder: string[];
  depth: string[];
};

export const DIFF_ENTRY_FIELDS = [
  "ariaOnlyReact",
  "ariaOnlyVue",
  "requestsOnlyReact",
  "requestsOnlyVue",
  "requestBodies",
  "requestFacts",
  "geometry",
  "focus",
  "order",
  "tabbablesOnlyReact",
  "tabbablesOnlyVue",
  "tabOrder",
  "depth",
] as const;

export function ledgerRows(entries: Record<string, DiffEntry>): string[] {
  const rows: string[] = [];
  for (const [key, entry] of Object.entries(entries)) {
    for (const [field, lines] of Object.entries(entry)) {
      for (const line of lines) rows.push(`${key} · ${field}: ${line}`);
    }
  }
  return rows.sort();
}

export function addedRows(
  previous: Record<string, DiffEntry>,
  next: Record<string, DiffEntry>,
): string[] {
  const before = new Map<string, number>();
  for (const row of ledgerRows(previous))
    before.set(row, (before.get(row) ?? 0) + 1);
  return ledgerRows(next).filter((row) => {
    const remaining = before.get(row) ?? 0;
    if (remaining === 0) return true;
    before.set(row, remaining - 1);
    return false;
  });
}
