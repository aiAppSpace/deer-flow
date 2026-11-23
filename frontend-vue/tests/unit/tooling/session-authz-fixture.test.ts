import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const python = `${repository}backend/.venv/bin/python`;

// Portable frontend checks do not install Python. The mandatory cross-app CI
// job runs this same real fixture while executing the full browser suite.
describe.skipIf(!existsSync(python))(
  "real session authorization fixture",
  () => {
    it("ignores ambient bypass/config and exercises first boot, SQL ownership and actual role changes", () => {
      const result = spawnSync(
        python,
        ["frontend-vue/tests/support/run_authz_gateway.py", "--check"],
        {
          cwd: repository,
          encoding: "utf8",
          env: {
            ...process.env,
            DEER_FLOW_AUTH_DISABLED: "1",
            DEER_FLOW_CONFIG_PATH: "/missing/operator-config.yaml",
            DEER_FLOW_EXTENSIONS_CONFIG_PATH:
              "/missing/operator-extensions.json",
            DEER_FLOW_ENV_FILE: "/missing/operator.env",
          },
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        "PASS: isolated first-boot session, SQL preferences, CSRF, expected-owner, real role revocation and re-grant",
      );
    }, 30_000);

    it("removes startup PYTHONPATH before importing the server and retains trusted fixture imports", () => {
      const ambient = mkdtempSync(join(tmpdir(), "session-ambient-import-"));
      try {
        writeFileSync(
          join(ambient, "uvicorn.py"),
          'raise RuntimeError("ambient uvicorn must never import")\n',
          "utf8",
        );
        const result = spawnSync(
          python,
          [
            "-c",
            `import os, runpy, sys
ambient = os.environ["PYTHONPATH"]
runner = sys.argv[1]
sys.argv = [runner, "--check"]
try:
    runpy.run_path(runner, run_name="__main__")
except SystemExit as result:
    assert result.code == 0
assert ambient not in sys.path
import uvicorn
assert hasattr(uvicorn, "run")
`,
            "frontend-vue/tests/support/run_authz_gateway.py",
          ],
          {
            cwd: repository,
            encoding: "utf8",
            env: { ...process.env, PYTHONPATH: ambient },
          },
        );
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain("PASS: isolated first-boot session");
      } finally {
        rmSync(ambient, { recursive: true, force: true });
      }
    }, 30_000);
  },
);
