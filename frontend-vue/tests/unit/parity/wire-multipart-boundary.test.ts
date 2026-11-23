import { expect, it } from "vitest";
import { projectBody } from "../../e2e-parity/support/wire-values";

it("does not canonicalize boundary-shaped epilogue bytes after the first closing delimiter", () => {
  const envelope = (boundary: string) =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"\r\n\r\nvalue\r\n--${boundary}--\r\nepilogue\r\n--${boundary}--\r\n`,
    );
  expect(
    projectBody(envelope("A"), "multipart/form-data; boundary=A"),
  ).not.toEqual(projectBody(envelope("B"), "multipart/form-data; boundary=B"));
});
