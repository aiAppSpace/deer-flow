import { expect, it } from "vitest";
import { projectBody } from "../../e2e-parity/support/wire-values";

it.each([undefined, "text/plain", "application/octet-stream"])(
  "preserves JSON-looking text when media type is %s",
  (contentType) => {
    expect(projectBody(Buffer.from('{"a":1,"b":2}'), contentType)).not.toEqual(
      projectBody(Buffer.from('{"b":2,"a":1}'), contentType),
    );
    expect(projectBody(Buffer.from('"\\u0061"'), contentType)).not.toEqual(
      projectBody(Buffer.from('"a"'), contentType),
    );
  },
);

it.each(["application/json", "application/problem+json; charset=utf-8"])(
  "only canonicalizes JSON explicitly declared as %s",
  (contentType) => {
    expect(projectBody(Buffer.from('{"a":1,"b":2}'), contentType)).toEqual(
      projectBody(Buffer.from('{"b":2,"a":1}'), contentType),
    );
  },
);
