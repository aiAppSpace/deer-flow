/*
  【文件职责】     请求体归一化的两条规则，逐条钉住。
  【架构位置】     单测
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/e2e-parity/support/capture.ts
  【边界与注意】   这两个函数只在 e2e-parity 的取样里跑，而那套要十几分钟——
                   **归一化规则写错的代价是「两边一致」这个结论本身不可信**，
                   所以在这里用纯函数把规则钉住。

                   **规则只有两条，第三条要靠实测才能加**（硬规则 2）：
                   排序 + 抹掉客户端生成的 UUID。时间戳、nonce 一律不抹——
                   `normalizeRequest` 里那张 `VOLATILE_QUERY_KEYS` 表就是这么被量掉的。
*/

import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  normalizeRequestBody,
} from "../../e2e-parity/support/capture";

/** 夹具 id：必须**留着**，抹掉它两个应用请求不同夹具也会看起来一样（wave 120）。 */
const KNOWN = new Set(["00000000-0000-0000-0000-000000000001"]);

describe("请求体归一化", () => {
  it("对象按 key 排序——字段顺序不是差异", () => {
    expect(normalizeRequestBody('{"b":1,"a":2}', KNOWN)).toBe(
      normalizeRequestBody('{"a":2,"b":1}', KNOWN),
    );
  });

  it("嵌套与数组里也排，而数组自己的顺序留着", () => {
    expect(normalizeRequestBody('{"x":[{"b":1,"a":2},{"a":3}]}', KNOWN)).toBe(
      '{"x":[{"a":2,"b":1},{"a":3}]}',
    );
    // 数组顺序是语义的一部分，不许排。
    expect(normalizeRequestBody('{"x":[2,1]}', KNOWN)).toBe('{"x":[2,1]}');
  });

  it("客户端生成的 UUID 抹掉，夹具 id 留着", () => {
    const body = JSON.stringify({
      known: "00000000-0000-0000-0000-000000000001",
      generated: "8f14e45f-ceea-467a-9b0e-ec5b0f1b1b1b",
    });

    expect(normalizeRequestBody(body, KNOWN)).toBe(
      '{"generated":"«generated»","known":"00000000-0000-0000-0000-000000000001"}',
    );
  });

  /*
    **不认识的体原样留着。** 静默丢掉它与 wave 120 那三个夹具 id 是同一类失效：
    两个应用发了不同的东西，而归一化把差异吃掉了。
  */
  it("解析不了 JSON 就原样返回", () => {
    expect(normalizeRequestBody("not json at all", KNOWN)).toBe(
      "not json at all",
    );
  });

  it("时间戳这类**不抹**——要加规则得先有读数", () => {
    const body = '{"created_at":"2026-05-24T04:46:42.565307+00:00"}';

    expect(normalizeRequestBody(body, KNOWN)).toBe(body);
  });

  it("canonicalJson 对标量原样返回", () => {
    expect(canonicalJson(1, KNOWN)).toBe(1);
    expect(canonicalJson(null, KNOWN)).toBe(null);
    expect(canonicalJson(true, KNOWN)).toBe(true);
  });
});
