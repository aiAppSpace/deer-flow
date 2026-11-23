import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const python = `${repository}backend/.venv/bin/python`;
const ambientImport = join(tmpdir(), "m0-operator-import-path");

// Exercise the actual fixture/config loader in a fresh interpreter. Only the
// server bind is replaced: browser/backend suites own actual HTTP acceptance.
const probe = `
import importlib.util, json, os, sys
from pathlib import Path
import uvicorn
spec = importlib.util.spec_from_file_location("fixture", "frontend-vue/tests/support/run_m0_gateway.py")
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
def inspect_start(*args, **kwargs):
    from deerflow.config.app_config import get_app_config
    config = get_app_config()
    home = Path(os.environ["DEER_FLOW_HOME"])
    assert Path(os.environ["DEER_FLOW_PROJECT_ROOT"]) == home
    assert Path(os.environ["DEER_FLOW_CONFIG_PATH"]).parent == home
    assert Path(os.environ["DEER_FLOW_ENV_FILE"]).parent == home
    assert Path(os.environ["DEER_FLOW_ENV_FILE"]).read_text(encoding="utf-8") == ""
    assert os.environ["AUTH_JWT_SECRET"] != "ambient-operator-secret"
    assert "GATEWAY_ENABLE_DOCS" not in os.environ
    assert "PYTHON_DOTENV_DISABLED" not in os.environ
    assert all(Path(entry).resolve() != Path(${JSON.stringify(ambientImport)}).resolve() for entry in sys.path if entry)
    assert config.plugins == []
    assert config.memory.enabled is False
    assert config.scheduler.enabled == ("--scheduler" in sys.argv)
    assert config.scheduler.tool_enabled is False
    assert os.environ["DEER_FLOW_AUTH_DISABLED"] == "0"
    print("PASS: isolated M0 configuration, dotenv, plugins, JWT and real scheduler flag")
uvicorn.run = inspect_start
sys.argv = ["run_m0_gateway.py", *sys.argv[1:]]
fixture.main()
`;

describe.skipIf(!existsSync(python))("M0 Gateway isolation", () => {
  it.each([{ args: [] }, { args: ["--scheduler"] }])(
    "ignores operator runtime configuration while retaining the declared topology $args",
    ({ args }) => {
      const result = spawnSync(python, ["-c", probe, ...args], {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          DEER_FLOW_CONFIG_PATH: "/missing/operator-config.yaml",
          DEER_FLOW_PROJECT_ROOT: "/missing/operator-root",
          DEER_FLOW_EXTENSIONS_CONFIG_PATH: "/missing/operator-extensions.json",
          DEER_FLOW_ENV_FILE: "/missing/operator.env",
          PYTHON_DOTENV_DISABLED: "1",
          GATEWAY_ENABLE_DOCS: "false",
          DEER_FLOW_AUTH_DISABLED: "0",
          AUTH_JWT_SECRET: "ambient-operator-secret",
          PYTHONPATH: ambientImport,
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        "PASS: isolated M0 configuration, dotenv, plugins, JWT and real scheduler flag",
      );
    },
    30_000,
  );
});
