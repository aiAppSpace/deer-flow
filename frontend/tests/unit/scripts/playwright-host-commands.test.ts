import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import vm from "node:vm";

import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from "@playwright/test";
import { afterEach, describe, expect, test } from "@rstest/core";
import ts from "typescript";

const frontend = resolve(__dirname, "../../..");
const cases = [
  [
    "playwright.config.ts",
    "3231",
    [
      ["exec", "next", "build"],
      ["exec", "next", "start"],
    ],
  ],
  ["playwright.auth.config.ts", "3232", [["build"], ["exec", "next", "start"]]],
  ["playwright.real-backend.config.ts", "3231", [["build"], ["start"]]],
  ["playwright.record.config.ts", "3233", [["build"], ["start"]]],
] as const;
const environment = {
  PORT: "3000",
  E2E_FRONTEND_PORT: "3231",
  E2E_AUTH_FRONTEND_PORT: "3232",
  E2E_RECORD_FRONTEND_PORT: "3233",
  E2E_GATEWAY_PORT: "8331",
  // Shell commands intentionally choose the platform executable, not a raw
  // environment interpolation that could introduce a second shell command.
  PYTHON: "do-not-interpolate; exit 7",
};

// Execute each actual config after TypeScript's ordinary CommonJS transform.
// Only the platform/environment are synthetic; defineConfig is Playwright's
// installed implementation. No global process mutation or server is involved.
function loadConfig(
  file: string,
  platform: string,
  env: Record<string, string | undefined> = environment,
): PlaywrightTestConfig {
  const filename = join(frontend, file);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const loadedModule = { exports: {} as { default: PlaywrightTestConfig } };
  vm.runInNewContext(
    compiled,
    {
      module: loadedModule,
      exports: loadedModule.exports,
      URL,
      process: { platform, env },
      require: (name: string) => {
        if (name !== "@playwright/test")
          throw new Error(`Unexpected config import: ${name}`);
        return { defineConfig, devices };
      },
    },
    { filename },
  );
  return loadedModule.exports.default;
}
function frontendServer(config: PlaywrightTestConfig) {
  const server = Array.isArray(config.webServer)
    ? config.webServer.at(-1)
    : config.webServer;
  if (!server) throw new Error("Expected an owned frontend server");
  return server;
}
const fixtures: string[] = [];
afterEach(() =>
  fixtures
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true })),
);

describe("actual Playwright host command configuration", () => {
  test.each(["darwin", "linux", "win32"])(
    "routes all four frontends through pnpm.py on %s",
    (platform) => {
      for (const [file, port, commands] of cases) {
        const config = loadConfig(file, platform);
        const server = frontendServer(config);
        const python = platform === "win32" ? "python" : "python3";
        expect(server.command).toBe(
          commands
            .map(
              (args) =>
                `${python} ../scripts/pnpm.py --dir frontend ${args.join(" ")}`,
            )
            .join(" && "),
        );
        expect(server.env!.PORT).toBe(port);
        expect(server.url).toBe(`http://localhost:${port}`);
        expect(config.use!.baseURL).toBe(server.url);
        expect(server.reuseExistingServer).toBe(false);
      }
    },
  );

  test.each([
    ["playwright.config.ts", "PLAYWRIGHT_BASE_URL"],
    ["playwright.auth.config.ts", "PLAYWRIGHT_AUTH_BASE_URL"],
  ])(
    "%s binds its explicit origin port and preserves supplied-server mode",
    (file, key) => {
      const env = { ...environment, [key]: "http://127.0.0.1:3298" };
      const config = loadConfig(file, "linux", env);
      expect(frontendServer(config).env!.PORT).toBe("3298");
      expect(frontendServer(config).url).toBe(config.use!.baseURL);
      expect(
        loadConfig(file, "linux", { ...env, PLAYWRIGHT_SKIP_WEB_SERVER: "1" })
          .webServer,
      ).toBeUndefined();
    },
  );

  // A bounded executable pnpm/Corepack double records the real Python runner's
  // cwd, argv and port. It deliberately never builds or opens a web listener.
  test.skipIf(process.platform === "win32").each(["pnpm", "corepack"])(
    "executes every actual POSIX command through %s",
    (manager) => {
      const python = spawnSync(
        "python3",
        ["-c", "import sys; print(sys.executable)"],
        { encoding: "utf8" },
      );
      expect(python.status).toBe(0);
      for (const [file, port, commands] of cases) {
        const root = realpathSync(
          mkdtempSync(join(tmpdir(), "deerflow host's [commands]-")),
        );
        fixtures.push(root);
        for (const name of ["frontend", "scripts", "bin"])
          mkdirSync(join(root, name));
        copyFileSync(
          resolve(frontend, "../scripts/pnpm.py"),
          join(root, "scripts/pnpm.py"),
        );
        writeFileSync(
          join(root, "frontend/package.json"),
          '{"packageManager":"pnpm@10.26.2"}\n',
        );
        symlinkSync(python.stdout.trim(), join(root, "bin/python3"));
        const log = join(root, "calls.jsonl");
        const executable = join(root, "bin", manager);
        writeFileSync(
          executable,
          `#!${process.execPath}\nif (process.argv[2] === '--version') { console.log('10.26.2'); process.exit(0); }\nconst fs = require('node:fs');\nfs.appendFileSync(process.env.COMMAND_FIXTURE_LOG, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2), port: process.env.PORT }) + '\\n');\nprocess.exit(Number(process.env.COMMAND_FIXTURE_EXIT || 0));\n`,
        );
        chmodSync(executable, 0o755);
        const server = frontendServer(loadConfig(file, process.platform));
        const run = (code: number) =>
          spawnSync("/bin/sh", ["-c", server.command], {
            cwd: join(root, "frontend"),
            encoding: "utf8",
            env: {
              ...process.env,
              ...server.env,
              PATH: join(root, "bin"),
              COMMAND_FIXTURE_LOG: log,
              COMMAND_FIXTURE_EXIT: String(code),
            },
          });
        const result = run(0);
        expect(result.status, result.stderr).toBe(0);
        const calls = readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        expect(calls).toEqual(
          commands.map((args) => ({
            cwd: join(root, "frontend"),
            args: manager === "corepack" ? ["pnpm", ...args] : [...args],
            port,
          })),
        );
        writeFileSync(log, "");
        expect(run(19).status).toBe(19);
        expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(1);
      }
    },
    20_000,
  );
});
