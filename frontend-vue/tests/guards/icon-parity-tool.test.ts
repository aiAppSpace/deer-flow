/*
  【文件职责】     钉 scripts/icon-parity.mjs 自己的形状：三处解析都不能静默给 0。
  【架构位置】     测试（守卫）
  【主要导出】     无
  【依赖关系】     scripts/icon-parity.mjs
  【边界与注意】   **这条守的是工具，不是产品。**

                   wave 68 一轮内，同一把新尺子踩了三次「算出来的 0 和没算的 0
                   长得一样」（线索 176/195）：`dom-parity` 不报连上几个元素、
                   超时后静默返回空数据、不校验落地 URL。`icon-parity` 同源——
                   它的结论全部建立在两张别名表和两棵源码树上，任何一处解析不出来，
                   报告都会变成一句轻飘飘的「无差异」。

                   所以它自己内置了 exit 2 的形状断言；这条守卫钉的是
                   **那些断言还在**，而不是重跑一遍它。缺了上游时它退出 0，
                   本条也随之只检查源码，不执行。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/icon-parity.mjs", "utf8");

describe("icon-parity 自己的形状断言", () => {
  it("别名表解析不出来时退出，不是继续跑出「无差异」", () => {
    expect(source).toContain("别名表没解析出来");
    // 探针是两个**已知答案**的别名：这两条一旦对不上，整张表就不可信。
    expect(source).toContain('"CheckCircleIcon", "CircleCheckBig"');
    expect(source).toContain('"CheckCircle2", "CircleCheck"');
    expect(source).toContain("process.exit(2)");
  });

  it("图标集合解析不出来时退出", () => {
    expect(source).toContain("图标集合没解析出来");
    expect(source).toMatch(/ri\.size < \d+ \|\| vi\.size < \d+/);
  });

  /*
    **尺子换过一次（2026-09-12 第十七轮）。** 原来这一条断言的是源码里含有
    「这是顾问工具，不进任何门禁」这句话——而 `icon-parity.mjs` 自己的文件头
    **专门标注过那句话从 wave 111 起就是假的**（豁免表过期或形状断言不成立时
    它会红，它就是一道门禁）。也就是说这道门在**钉住一句仓库已经宣布作废的话**：
    它今天能过，只因为脚本把那句假话引在了纠正段里；谁把纠正段整理掉，它就红，
    而红的原因与它想守的事毫无关系。

    判据换成**真正要守的那件事**：缺上游时走的是「打印一行 + `exit(0)`」，
    而不是让任何入口变红。钉三样——分支条件、那句提示、以及 `exit(0)` 本身。
  */
  it("上游缺席时退出 0，不让任何入口变红", () => {
    expect(source).toMatch(
      /if\s*\(!existsSync\(reactRoot\)\s*\|\|\s*!existsSync\(REACT_DTS\)\)/,
    );
    expect(source).toContain("跳过：找不到上游");
    expect(source).toContain("process.exit(0)");
  });

  it("字形那一档从 import 收集，不从写了尺寸的那些收集", () => {
    /*
      第一版拿 `icons()`（只记写了尺寸的）当「用没用过这颗」，
      把 composer 明明在用的 `Zap` 报成「只有 React 用」。
    */
    expect(source).toContain("lucide-(?:react|vue-next)");
  });

  it("拿字符当图标那一档，上游解析不出来时退出", () => {
    /*
      这一档的信号是「Vue 有、React 没有」。React 那边解析成 0 会让本仓
      每一个符号字符都变成线索（假阳性洪水），而它又和「上游真的一个都不用」
      长得一模一样。上游 message-list.tsx 的 × 是一条已知真样本，拿它当探针。
    */
    expect(source).toContain("字符档没解析出来");
    expect(source).toContain('rg.has("\\u00D7")');
  });

  it("字符档按全仓比，且排除 emoji", () => {
    // 按文件问全是噪声（线索 200 ④）；emoji 是正文内容不是图标替身。
    expect(source).toContain("拿字符当图标（全仓）");
    expect(source).toContain("GLYPH_RE");
    expect(source).not.toMatch(/GLYPH_RE\s*=[\s\S]{0,200}1F300/);
  });

  it("豁免面不进报告", () => {
    // 落地页 / docs / blog 双向豁免，它们独占的图标会把真信号淹掉。
    expect(source).toMatch(/EXEMPT = new Set\(\[[^\]]*"landing"/);
  });
});
