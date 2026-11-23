import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Node loads the package's published CJS/ESM directly, outside the test bundler.
describe("published Dialog entries mount and close", () => {
  for (const format of ["cjs", "esm"]) {
    it(`${format} executes real mounted ownership lifecycle`, () => {
      const result = execFileSync(
        process.execPath,
        [resolve("tests/primitive-entry/dialog-close.mjs"), format],
        { encoding: "utf8", timeout: 15000 },
      );
      expect(result).toContain(`PASS ${format}`);
    }, 20000);
  }
});
