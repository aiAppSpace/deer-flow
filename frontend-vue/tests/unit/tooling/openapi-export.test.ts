import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const python = `${repo}backend/.venv/bin/python`;

// The mandatory source freshness check also runs in CI's real-backend job.
describe.skipIf(!existsSync(python))("isolated core schema export", () => {
  it("verifies the packaged example router separately without contaminating the core snapshot", () => {
    const target = `${repo}frontend-vue/baseline/openapi.snapshot.json`;
    const before = readFileSync(target, "utf8");
    const result = spawnSync(
      python,
      ["frontend-vue/scripts/export-openapi.py", "--check-extension-fixture"],
      { cwd: repo, encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Controlled example extension contribution",
    );
    expect(readFileSync(target, "utf8")).toBe(before);
    expect(JSON.parse(before).paths).not.toHaveProperty(
      "/api/extension-example/stats",
    );
  }, 30_000);
  it("ignores ambient operator config, dotenv switches, plugins and router flags", () => {
    const result = spawnSync(
      python,
      ["frontend-vue/scripts/export-openapi.py", "--check"],
      {
        cwd: repo,
        encoding: "utf8",
        env: {
          ...process.env,
          DEER_FLOW_CONFIG_PATH: "/missing/operator-config.yaml",
          DEER_FLOW_EXTENSIONS_CONFIG_PATH: "/missing/operator-extensions.json",
          DEER_FLOW_ENV_FILE: "/missing/operator.env",
          PYTHON_DOTENV_DISABLED: "1",
          GATEWAY_ENABLE_DOCS: "false",
          DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS: "0",
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "matches the current isolated core Gateway",
    );
  }, 30_000);
});
