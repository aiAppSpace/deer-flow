import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, test } from "@rstest/core";

const source = resolve(__dirname, "../../..");
type Event = {
  kind: string;
  pid?: number;
  port?: number;
  args?: string[];
  staticMode?: string | null;
  url?: string;
};
const fixtures: {
  root: string;
  log: string;
  child: ChildProcess;
  finished: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stderr: string;
  }>;
}[] = [];
function events(log: string): Event[] {
  return existsSync(log)
    ? readFileSync(log, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Event)
    : [];
}
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    if (fixture.child.exitCode === null && fixture.child.signalCode === null)
      fixture.child.kill("SIGKILL");
    await fixture.finished;
    // Preserve isolation even for the deliberately failing old implementation.
    for (const event of events(fixture.log)) {
      if (event.kind === "server" && event.pid && alive(event.pid))
        process.kill(event.pid, "SIGKILL");
    }
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
function launch(mode: string) {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), "deerflow-asset-process-")),
  );
  const frontend = join(root, "frontend");
  const log = join(root, "events.jsonl");
  for (const path of [
    "scripts",
    "frontend/scripts",
    "frontend/node_modules/next/dist/bin",
    "frontend/.next/static/css",
    "frontend/.next/static/chunks",
    "bin",
  ])
    mkdirSync(join(root, path), { recursive: true });
  copyFileSync(
    join(source, "scripts/measure-route-assets.mjs"),
    join(frontend, "scripts/measure-route-assets.mjs"),
  );
  copyFileSync(
    resolve(source, "../scripts/pnpm.py"),
    join(root, "scripts/pnpm.py"),
  );
  writeFileSync(join(frontend, "package.json"), '{"type":"module"}\n');
  writeFileSync(
    join(frontend, "node_modules/next/package.json"),
    '{"type":"commonjs"}\n',
  );
  copyFileSync(
    join(__dirname, "fixtures/asset-measure-server.cjs"),
    join(frontend, "node_modules/next/dist/bin/next"),
  );
  writeFileSync(
    join(root, "bin/pnpm"),
    "#!/usr/bin/env node\n" +
      readFileSync(join(__dirname, "fixtures/asset-measure-build.cjs"), "utf8"),
  );
  chmodSync(join(root, "bin/pnpm"), 0o755);
  writeFileSync(join(frontend, ".next/static/css/app.css"), "body{}");
  writeFileSync(join(frontend, ".next/static/chunks/app.js"), "console.log(1)");
  const signalErrorFixture = join(
    __dirname,
    "fixtures/asset-measure-signal-error.cjs",
  );
  const args = mode === "term-error" ? ["--require", signalErrorFixture] : [];
  const child = spawn(
    process.execPath,
    [...args, join(frontend, "scripts/measure-route-assets.mjs")],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: [
          join(root, "bin"),
          dirname(process.execPath),
          process.env.PATH,
        ].join(delimiter),
        ASSET_FIXTURE_LOG: log,
        ASSET_FIXTURE_MODE: mode,
      },
    },
  );
  let stderr = "";
  child.stdout.resume();
  child.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  const finished = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stderr: string;
  }>((accept, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => accept({ code, signal, stderr }));
  });
  const fixture = { root, log, child, finished };
  fixtures.push(fixture);
  return fixture;
}
async function assertListenersStopped(log: string) {
  for (const event of events(log).filter((event) => event.kind === "server")) {
    expect(alive(event.pid!)).toBe(false);
    const listener = net.createServer();
    await new Promise<void>((accept, reject) => {
      listener.once("error", reject);
      listener.listen(event.port, "127.0.0.1", () =>
        listener.close((error) => (error ? reject(error) : accept())),
      );
    });
  }
}
async function waitFor(log: string, predicate: (event: Event) => boolean) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (events(log).some(predicate)) return;
    await delay(20);
  }
  throw new Error(
    "The owned fixture never reached the required interruption boundary",
  );
}

// POSIX process signals and executable fixtures; Windows interpreter selection
// belongs to the separate configuration/runner contracts.
describe.skipIf(process.platform === "win32")(
  "actual route measurement child lifetime",
  () => {
    test("builds both modes through the real pnpm runner and releases both listeners", async () => {
      const fixture = launch("normal");
      expect(await fixture.finished).toMatchObject({ code: 0, signal: null });
      expect(
        events(fixture.log)
          .filter((event) => event.kind === "build")
          .map(({ args, staticMode }) => ({ args, staticMode })),
      ).toEqual([
        { args: ["exec", "next", "build"], staticMode: null },
        { args: ["exec", "next", "build"], staticMode: "true" },
      ]);
      expect(
        events(fixture.log).filter((event) => event.kind === "server"),
      ).toHaveLength(2);
      expect(
        events(fixture.log).filter((event) => event.kind === "term-cleanup"),
      ).toHaveLength(2);
      await assertListenersStopped(fixture.log);
    }, 15_000);
    test.each([
      ["http-error", "HTTP 503"],
      ["missing-asset", "ENOENT"],
      ["exit-code", "17"],
      ["exit-143", "143"],
      ["exit-signal", "SIGTERM"],
      ["spawn-error", "ENOENT"],
      ["term-error", "fixture signal delivery failed after spawn"],
    ])(
      "preserves %s failure and stops before another build",
      async (mode, message) => {
        const fixture = launch(mode);
        const result = await fixture.finished;
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain(message);
        expect(
          events(fixture.log).filter((event) => event.kind === "build"),
        ).toHaveLength(1);
        await assertListenersStopped(fixture.log);
      },
      15_000,
    );
    test.each(["hang-ready", "hang-headers", "hang-body"])(
      "bounds a real %s HTTP operation and releases its listener",
      async (mode) => {
        const fixture = launch(mode);
        const result = await fixture.finished;
        expect(result.code).not.toBe(0);
        expect(result.stderr).toMatch(/timed out|timeout/i);
        expect(
          events(fixture.log).filter((event) => event.kind === "build"),
        ).toHaveLength(1);
        await assertListenersStopped(fixture.log);
      },
      40_000,
    );
    test.each([
      ["SIGINT", 130],
      ["SIGTERM", 143],
    ] as const)(
      "forwards parent-only %s interruption through awaited cleanup",
      async (signal, code) => {
        const fixture = launch("hang-headers");
        await waitFor(
          fixture.log,
          (event) => event.kind === "request" && event.url === "/login",
        );
        fixture.child.kill(signal);
        expect(await fixture.finished).toMatchObject({ code, signal: null });
        expect(
          events(fixture.log).filter((event) => event.kind === "build"),
        ).toHaveLength(1);
        await assertListenersStopped(fixture.log);
      },
      15_000,
    );
    test("an interruption during slow shutdown cannot start the next build", async () => {
      const fixture = launch("ignore-term");
      await waitFor(fixture.log, (event) => event.kind === "term-ignored");
      fixture.child.kill("SIGTERM");
      expect(await fixture.finished).toMatchObject({ code: 143, signal: null });
      expect(
        events(fixture.log).filter((event) => event.kind === "build"),
      ).toHaveLength(1);
      expect(
        events(fixture.log).filter((event) => event.kind === "server"),
      ).toHaveLength(1);
      await assertListenersStopped(fixture.log);
    }, 15_000);
  },
);
