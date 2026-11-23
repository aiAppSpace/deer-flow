import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CROSS_APP_BY_DESIGN } from "../../../scripts/lib/cross-app-by-design.mjs";

const source = readFileSync(
  new URL("../../../scripts/standalone-sim.mjs", import.meta.url),
  "utf8",
);
const table = readFileSync(
  new URL("../../../scripts/lib/cross-app-by-design.mjs", import.meta.url),
  "utf8",
);
const testFiles = Object.entries(CROSS_APP_BY_DESIGN)
  .filter(([, entry]) => entry.kind === "test")
  .map(([file]) => file);

function runBoundary(mode: "unhandled" | "missing" | "pass") {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), "standalone-boundary-")),
  );
  const owner = join(root, "owner");
  const scripts = join(owner, "frontend-vue/scripts");
  mkdirSync(join(scripts, "lib"), { recursive: true });
  writeFileSync(join(scripts, "standalone-sim.mjs"), source);
  writeFileSync(join(scripts, "lib/cross-app-by-design.mjs"), table);
  // Exercise the actual orchestrator; replace only its expensive command/copy
  // boundaries. This test never installs dependencies or invokes a build.
  writeFileSync(
    join(scripts, "lib/standalone-workspace.mjs"),
    `import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {CROSS_APP_BY_DESIGN} from './cross-app-by-design.mjs';
export function createStandaloneWorkspace() {
  const root=join(process.env.BOUNDARY_ROOT,'isolated');
  for (const file of Object.keys(CROSS_APP_BY_DESIGN)) {
    const target=join(root,'frontend-vue',file);
    mkdirSync(dirname(target),{recursive:true});writeFileSync(target,'fixture');
  }
  return {root,dispose:()=>rmSync(root,{recursive:true,force:true})};
}`,
  );
  const preload = join(root, "commands.cjs");
  writeFileSync(
    preload,
    `const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
cp.execFileSync=function(command,args,options) {
  fs.appendFileSync(process.env.BOUNDARY_CALLS,JSON.stringify({command,args})+'\\n');
  if (!args.includes('vitest')) return '';
  const files=JSON.parse(process.env.BOUNDARY_TEST_FILES);
  const included=process.env.BOUNDARY_MODE==='missing'?files.slice(1):files;
  const output=args.find(arg=>arg.startsWith('--outputFile=')).slice('--outputFile='.length);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify({success:true,testResults:included.map(file=>({
    name:path.join(options.cwd,file),status:'passed',assertionResults:[{status:'passed',failureMessages:[]}]
  }))}));
  if(process.env.BOUNDARY_MODE==='unhandled') {
    const error=new Error('actual child exit');error.status=1;
    error.stdout=args.includes('--reporter=default')?'Unhandled Error: boundary teardown stack\\n':'JSON report written\\n';
    error.stderr='';throw error;
  }
  return 'JSON report written\\n';
};
require('node:module').syncBuiltinESMExports();`,
  );
  const calls = join(root, "calls.jsonl");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BOUNDARY_ROOT: root,
    BOUNDARY_CALLS: calls,
    BOUNDARY_MODE: mode,
    BOUNDARY_TEST_FILES: JSON.stringify(testFiles),
  };
  // The child owns an explicit fake-command preload. Inherited observation
  // preloads from an outer standalone run must not attach to this fake owner.
  delete env.NODE_OPTIONS;
  try {
    const result = spawnSync(
      process.execPath,
      ["--require", preload, join(scripts, "standalone-sim.mjs")],
      { cwd: owner, env, encoding: "utf8" },
    );
    const commands = readFileSync(calls, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { command: string; args: string[] });
    const vitest = commands.find((command) => command.args.includes("vitest"));
    const failures = join(owner, "frontend-vue/.cache/standalone-failures");
    const failureDirectory = existsSync(failures)
      ? join(failures, readdirSync(failures)[0]!)
      : undefined;
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      args: vitest?.args,
      report: failureDirectory
        ? JSON.parse(
            readFileSync(join(failureDirectory, "vitest.json"), "utf8"),
          )
        : undefined,
      isolatedRemoved: !existsSync(join(root, "isolated")),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("standalone complete-unit failure observations", () => {
  it("keeps a fatal asynchronous child exit, visible stack and the complete JSON case list", () => {
    const result = runBoundary("unhandled");
    expect(result.status).toBe(1);
    expect(result.output).toContain("Unhandled Error: boundary teardown stack");
    expect(result.args).toContain("--reporter=default");
    expect(result.args).toContain("--reporter=json");
    expect(result.report.success).toBe(true);
    expect(result.report.testResults).toHaveLength(testFiles.length);
    expect(result.isolatedRemoved).toBe(true);
  });

  it("still rejects a missing required case even when the child exits zero", () => {
    expect(testFiles.length).toBeGreaterThan(0);
    const result = runBoundary("missing");
    expect(result.status).toBe(1);
    expect(result.output).toContain("vitest 报告里没有这个文件");
    expect(result.isolatedRemoved).toBe(true);
  });

  it("accepts the complete successful child report and disposes its isolated owner", () => {
    const result = runBoundary("pass");
    expect(result.status).toBe(0);
    expect(result.isolatedRemoved).toBe(true);
  });
});
