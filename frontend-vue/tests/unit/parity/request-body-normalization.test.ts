/** Lossless tagged request bodies: only JSON key order and observed multipart
 * delimiters may differ. Literal IDs, numbers and payload bytes remain data. */
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
      normalizeRequestBody('{"x":[{"a":2,"b":1},{"a":3}]}', KNOWN),
    );
    // 数组顺序是语义的一部分，不许排。
    expect(normalizeRequestBody('{"x":[2,1]}', KNOWN)).not.toBe(
      normalizeRequestBody('{"x":[1,2]}', KNOWN),
    );
  });

  it("UUID 形状和固定夹具都保留字面内容，来源由 typed registry 另验", () => {
    const body = JSON.stringify({
      known: "00000000-0000-0000-0000-000000000001",
      generated: "8f14e45f-ceea-467a-9b0e-ec5b0f1b1b1b",
    });

    const encoded = normalizeRequestBody(body, KNOWN);
    expect(encoded).toContain("8f14e45f-ceea-467a-9b0e-ec5b0f1b1b1b");
    expect(encoded).toContain("00000000-0000-0000-0000-000000000001");
    expect(encoded).not.toContain("«generated»");
  });

  /*
    **不认识的体原样留着。** 静默丢掉它与 wave 120 那三个夹具 id 是同一类失效：
    两个应用发了不同的东西，而归一化把差异吃掉了。
  */
  it("解析不了 JSON 就原样返回", () => {
    const encoded = JSON.parse(normalizeRequestBody("not json at all", KNOWN));
    expect(encoded[0]).toBe("bytes");
    expect(Buffer.from(encoded[1], "base64").toString("utf8")).toBe(
      "not json at all",
    );
  });

  it("时间戳这类**不抹**——要加规则得先有读数", () => {
    const body = '{"created_at":"2026-05-24T04:46:42.565307+00:00"}';

    expect(normalizeRequestBody(body, KNOWN)).toContain(
      "2026-05-24T04:46:42.565307+00:00",
    );
  });

  it("canonicalJson 对标量原样返回", () => {
    expect(canonicalJson(1, KNOWN)).toBe(1);
    expect(canonicalJson(null, KNOWN)).toBe(null);
    expect(canonicalJson(true, KNOWN)).toBe(true);
  });
});

describe("observed browser multipart boundaries", () => {
  const part = (
    boundary: string,
    value = "hello shelf",
    name = "file",
    filename = "notes.txt",
    mime = "text/plain",
  ) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n${value}\r\n--${boundary}--\r\n`;
  const normalized = (boundary: string, body = part(boundary)) =>
    normalizeRequestBody(
      body,
      KNOWN,
      `multipart/form-data; boundary=${boundary}`,
    );
  it("ignores only the boundary declared by Content-Type", () => {
    expect(normalized("WebKitOne")).toBe(normalized("WebKitTwo"));
    expect(
      normalizeRequestBody(
        part("WebKitOne"),
        KNOWN,
        'multipart/form-data; boundary="WebKitOne"',
      ),
    ).toBe(normalized("WebKitTwo"));
  });
  it.each([
    ["content", part("WebKitTwo", "changed shelf")],
    ["field", part("WebKitTwo", "hello shelf", "other")],
    ["filename", part("WebKitTwo", "hello shelf", "file", "other.txt")],
    [
      "media type",
      part(
        "WebKitTwo",
        "hello shelf",
        "file",
        "notes.txt",
        "application/octet-stream",
      ),
    ],
  ])("preserves differing %s", (_name, changed) => {
    expect(normalized("WebKitOne")).not.toBe(normalized("WebKitTwo", changed));
  });
  it("retains boundary-shaped text inside the payload", () => {
    expect(
      normalized("WebKitOne", part("WebKitOne", "literal WebKitOne")),
    ).not.toBe(normalized("WebKitTwo", part("WebKitTwo", "literal WebKitTwo")));
  });
  it("retains field order and duplicate fields", () => {
    const a =
      part("WebKitOne", "first").replace("--WebKitOne--\r\n", "") +
      part("WebKitOne", "second");
    const b =
      part("WebKitTwo", "second").replace("--WebKitTwo--\r\n", "") +
      part("WebKitTwo", "first");
    expect(normalized("WebKitOne", a)).not.toBe(normalized("WebKitTwo", b));
    expect(normalized("WebKitOne", a)).not.toBe(
      normalized("WebKitOne", part("WebKitOne", "first")),
    );
  });
  it("does not guess a boundary for unknown or malformed bodies", () => {
    const body = part("WebKitOne");
    const raw = (value: string) =>
      JSON.stringify(["bytes", Buffer.from(value).toString("base64")]);
    expect(normalizeRequestBody(body, KNOWN)).toBe(raw(body));
    expect(
      normalizeRequestBody(body, KNOWN, "text/plain; boundary=WebKitOne"),
    ).toBe(raw(body));
    expect(normalized("Wrong", body)).toBe(raw(body));
    expect(normalized("WebKitOne", body.slice(0, -12))).toBe(
      raw(body.slice(0, -12)),
    );
  });
  it("compares exact binary file bytes without UTF-8 replacement loss", () => {
    const binary = (boundary: string, bytes: number[]) =>
      Buffer.concat([
        Buffer.from(part(boundary, "BINARY").split("BINARY")[0]!),
        Buffer.from(bytes),
        Buffer.from(part(boundary, "BINARY").split("BINARY")[1]!),
      ]);
    const a = normalizeRequestBody(
      binary("WebKitOne", [0, 255, 128]),
      KNOWN,
      "multipart/form-data; boundary=WebKitOne",
    );
    expect(a).toBe(
      normalizeRequestBody(
        binary("WebKitTwo", [0, 255, 128]),
        KNOWN,
        "multipart/form-data; boundary=WebKitTwo",
      ),
    );
    expect(a).not.toBe(
      normalizeRequestBody(
        binary("WebKitTwo", [0, 254, 128]),
        KNOWN,
        "multipart/form-data; boundary=WebKitTwo",
      ),
    );
  });
});
