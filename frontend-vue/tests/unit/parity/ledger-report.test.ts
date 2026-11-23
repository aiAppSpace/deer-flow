import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { DIFF_ENTRY_FIELDS } from "../../e2e-parity/support/ledger";

it.each([
  [1, 2, 1, 0, 1],
  [2, 1, 0, 1, 1],
  [2, 2, 0, 0, 0],
])(
  "actual report CLI counts baseline=%i and observed=%i copies",
  (beforeCount, afterCount, added, gone, exit) => {
    const dir = mkdtempSync(join(tmpdir(), "deerflow-ledger-count-"));
    try {
      for (const name of ["scripts", "baseline", "test-results/e2e-parity"])
        mkdirSync(join(dir, name), { recursive: true });
      const script = join(dir, "scripts/parity-ledger-report.mjs");
      writeFileSync(
        script,
        readFileSync(
          new URL("../../../scripts/parity-ledger-report.mjs", import.meta.url),
        ),
      );
      const entry = (count: number) => ({
        sample: {
          ...Object.fromEntries(DIFF_ENTRY_FIELDS.map((field) => [field, []])),
          requestFacts: Array.from({ length: count }, () => "React request A"),
        },
      });
      writeFileSync(
        join(dir, "baseline/parity-diff.json"),
        JSON.stringify({ entries: entry(beforeCount) }),
      );
      writeFileSync(
        join(dir, "test-results/e2e-parity/report.json"),
        JSON.stringify(entry(afterCount)),
      );
      const result = spawnSync(process.execPath, [script], {
        encoding: "utf8",
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(exit);
      expect(result.stdout).toContain(`报告   1 个场景，台账 ${afterCount} 行`);
      expect(result.stdout).toContain(
        `基线   1 个场景，台账 ${beforeCount} 行`,
      );
      expect(result.stdout).toContain(`NEW = ${added}   GONE = ${gone}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
