/*
  【文件职责】     钉住「台账只能缩短」那条判据的算法。
  【架构位置】     单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/e2e-parity/support/ledger.ts
  【边界与注意】   **它的消费者只有 `diff.spec.ts` 的 accept 分支，而那条分支在
                   台账是 0 行时永远走不到**——跑真的 `make parity-accept`
                   验不了它。所以判据在这里打：一行一行地喂，不靠跑三台服务器。

                   **最要紧的是「等长但换了内容」那一条**：修好一条、同时新坏一条，
                   行数不变。按行数判会放过它，按集合包含判不会。
*/

import { describe, expect, it } from "vitest";

import {
  type DiffEntry,
  DIFF_ENTRY_FIELDS,
  addedRows,
  ledgerRows,
} from "../../e2e-parity/support/ledger";

/*
  从字段表生成，不手抄。手抄那份漏了第 11 个字段 `depth`——而这组用例正是
  台账摊平逻辑的守卫，夹具少一个字段等于那一档从来没被摊平过。
*/
const empty = (): DiffEntry =>
  Object.fromEntries(
    DIFF_ENTRY_FIELDS.map((field) => [field, [] as string[]]),
  ) as DiffEntry;

const entry = (patch: Partial<DiffEntry>): DiffEntry => ({
  ...empty(),
  ...patch,
});

describe("对照台账的摊平", () => {
  it("五个字段都算一行一处，并按字典序排好", () => {
    expect(
      ledgerRows({
        "chat/desktop": entry({
          geometry: ["composer y Δ-7.5"],
          ariaOnlyVue: ["button 保存"],
        }),
        "login/mobile": entry({ requestsOnlyReact: ["GET /api/features"] }),
      }),
    ).toEqual([
      "chat/desktop · ariaOnlyVue: button 保存",
      "chat/desktop · geometry: composer y Δ-7.5",
      "login/mobile · requestsOnlyReact: GET /api/features",
    ]);
  });

  it("空台账摊平成空数组", () => {
    expect(ledgerRows({})).toEqual([]);
    expect(ledgerRows({ "chat/desktop": empty() })).toEqual([]);
  });
});

describe("一次 accept 会不会让台账变长", () => {
  it("只删不加 —— 放行", () => {
    const before = { a: entry({ geometry: ["x", "y"] }) };
    const after = { a: entry({ geometry: ["x"] }) };
    expect(addedRows(before, after)).toEqual([]);
  });

  it("加了新的一行 —— 报出来", () => {
    const before = { a: entry({ geometry: ["x"] }) };
    const after = { a: entry({ geometry: ["x", "z"] }) };
    expect(addedRows(before, after)).toEqual(["a · geometry: z"]);
  });

  it("**行数不变、内容换了** —— 照样报出来", () => {
    const before = { a: entry({ geometry: ["x"] }) };
    const after = { a: entry({ geometry: ["z"] }) };
    expect(addedRows(before, after)).toEqual(["a · geometry: z"]);
  });

  it("同一行挪到别的场景键下 —— 算新增（那是另一处差异）", () => {
    const before = { a: entry({ geometry: ["x"] }) };
    const after = { b: entry({ geometry: ["x"] }) };
    expect(addedRows(before, after)).toEqual(["b · geometry: x"]);
  });

  it("同一行挪到别的字段下 —— 算新增", () => {
    const before = { a: entry({ ariaOnlyVue: ["x"] }) };
    const after = { a: entry({ ariaOnlyReact: ["x"] }) };
    expect(addedRows(before, after)).toEqual(["a · ariaOnlyReact: x"]);
  });

  it("基线本来就是空的 —— 新增的每一行都要报出来", () => {
    expect(addedRows({}, { a: entry({ geometry: ["x", "y"] }) })).toEqual([
      "a · geometry: x",
      "a · geometry: y",
    ]);
  });

  it("两边都空 —— 放行（台账 0 行时 accept 是空操作）", () => {
    expect(addedRows({}, {})).toEqual([]);
  });
});
