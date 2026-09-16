/*
  【文件职责】     钉「兄弟应用缺席时，开发机跳过、CI 炸」这条分岔。
  【架构位置】     单测（对照测试基础设施）
  【主要导出】     无
  【依赖关系】     tests/e2e-parity/support/react-preview.ts
  【边界与注意】   **参数全部显式传**，不读真实的 `existsSync` 与 `process.env`：
                   这四种组合里有三种在本机根本构造不出来（`../frontend` 一直在），
                   而真正要钉的那一格恰好就是构造不出来的那一格
                   ——「缺席 + CI」。靠环境去测它，等于只测得到「在场」那两格，
                   而那两格无论逻辑写成什么样都是绿的。

                   模块加载时那次无参调用不在这里测：它的判据是**整个套件退出码**，
                   由 CI 上那条 job 给（工作流里的 PARITY_REQUIRE_REACT=1），
                   而 `tests/guards/tooling-contracts.test.ts` 钉那个变量还在。
*/

import { describe, expect, it } from "vitest";

import { assertReactAppPresentIfRequired } from "../../e2e-parity/support/react-preview";

describe("对照套件对兄弟应用的在场要求", () => {
  it("开发机（没开要求）：在场与缺席都不抛", () => {
    expect(() => assertReactAppPresentIfRequired(true, false)).not.toThrow();
    expect(() => assertReactAppPresentIfRequired(false, false)).not.toThrow();
  });

  it("CI（开了要求）：在场不抛", () => {
    expect(() => assertReactAppPresentIfRequired(true, true)).not.toThrow();
  });

  it("CI（开了要求）：缺席时抛，而不是安静跳过", () => {
    expect(() => assertReactAppPresentIfRequired(false, true)).toThrow(
      /PARITY_REQUIRE_REACT=1/,
    );
    // 错误信息要说出「那会是一条假绿」，否则读到它的人会以为只是少装了东西。
    expect(() => assertReactAppPresentIfRequired(false, true)).toThrow(
      /量不到任何东西的绿/,
    );
  });
});
