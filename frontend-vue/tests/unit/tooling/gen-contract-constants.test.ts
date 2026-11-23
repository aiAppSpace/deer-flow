import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const contractDirectory = resolve(workspace, "../contracts");
const generatedPath = resolve(workspace, "app/core/contracts/backend.gen.ts");
const temporaryDirectories: string[] = [];

type GoalContract = {
  agent_stop_last_error_prefix: string;
  auto_pause_last_error: string;
  check_failure_codes: string[];
  unmet_reason_codes: string[];
  host_run_errors: Record<string, string>;
  scheduled_origin_key: string;
  lifecycle_events: string[];
  lifecycle_reasons: Record<string, string[]>;
};

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "deerflow-contract-generator-"));
  temporaryDirectories.push(root);
  const script = resolve(
    root,
    "frontend-vue/scripts/gen-contract-constants.mjs",
  );
  const contracts = resolve(root, "contracts");
  const output = resolve(
    root,
    "frontend-vue/app/core/contracts/backend.gen.ts",
  );
  mkdirSync(dirname(script), { recursive: true });
  mkdirSync(contracts);
  copyFileSync(
    resolve(workspace, "scripts/gen-contract-constants.mjs"),
    script,
  );
  for (const file of readdirSync(contractDirectory).filter((name) =>
    name.endsWith(".json"),
  )) {
    copyFileSync(resolve(contractDirectory, file), resolve(contracts, file));
  }
  return {
    output,
    generate(check = false) {
      return spawnSync(
        process.execPath,
        [script, ...(check ? ["--check"] : [])],
        {
          encoding: "utf8",
        },
      );
    },
    mutate<Contract>(name: string, update: (contract: Contract) => void) {
      const path = resolve(contracts, name);
      const contract = JSON.parse(readFileSync(path, "utf8")) as Contract;
      update(contract);
      writeFileSync(path, JSON.stringify(contract), "utf8");
    },
  };
}

function generatedNamespace(source: string): Record<string, unknown> {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(output, { exports });
  return exports;
}

/** Check the actual consumers against successive generated contract revisions. */
function createConsumerChecker() {
  const consumers = ["goal-outcome", "run-error", "events", "errors"].map(
    (name) => resolve(workspace, `app/core/scheduled-tasks/${name}.ts`),
  );
  const options: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowSyntheticDefaultImports: true,
    types: [],
    paths: { "@/*": [resolve(workspace, "app/*")] },
  };
  const host = ts.createCompilerHost(options);
  const readSource = host.getSourceFile.bind(host);
  const unchangedSources = new Map<string, ts.SourceFile>();
  let generated = "";
  let previous: ts.Program | undefined;
  host.getSourceFile = (file, languageVersion, onError) => {
    // The changed input must be reparsed for every real generator run. Only
    // unchanged production/library files share their parsed SourceFiles.
    if (file === generatedPath)
      return ts.createSourceFile(file, generated, languageVersion, true);
    const existing = unchangedSources.get(file);
    if (existing) return existing;
    const source = readSource(file, languageVersion, onError);
    if (source) unchangedSources.set(file, source);
    return source;
  };
  return (source: string) => {
    generated = source;
    const program = ts.createProgram({
      rootNames: consumers,
      options,
      host,
      oldProgram: previous,
    });
    previous = program;
    // The old checker computed diagnostics for the entire dependency graph,
    // then discarded every diagnostic outside these four consumers. Ask the
    // compiler for the identical target set directly, without rechecking
    // unrelated imported implementations on all three contract revisions.
    return consumers.flatMap((file) => {
      const consumer = program.getSourceFile(file);
      if (!consumer) throw new Error(`Missing production consumer: ${file}`);
      return [
        ...program.getSyntacticDiagnostics(consumer),
        ...program.getSemanticDiagnostics(consumer),
      ].map((diagnostic) => ({
        file,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      }));
    });
  };
}

afterEach(() => {
  vi.doUnmock("@/core/contracts/backend.gen");
  vi.resetModules();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("generated scheduled-task contract consumers", () => {
  it("detects changes to both migrated contracts and regenerates their actual fields", () => {
    const isolated = fixture();
    expect(isolated.generate().status).toBe(0);
    expect(readFileSync(isolated.output, "utf8")).toBe(
      readFileSync(generatedPath, "utf8"),
    );
    isolated.mutate<GoalContract>(
      "scheduled_goal_notes_contract.json",
      (goal) => {
        goal.agent_stop_last_error_prefix = "contract-owned stop: ";
      },
    );
    const staleGoal = isolated.generate(true);
    expect(staleGoal.status, staleGoal.stdout + staleGoal.stderr).toBe(1);
    expect(isolated.generate().status).toBe(0);
    expect(readFileSync(isolated.output, "utf8")).toContain(
      "contract-owned stop: ",
    );
    isolated.mutate<{ ui_codes: string[] }>(
      "scheduled_task_errors_contract.json",
      (errors) => {
        errors.ui_codes.push("future_api_code");
      },
    );
    expect(isolated.generate(true).status).toBe(1);
    expect(isolated.generate().status).toBe(0);
    expect(readFileSync(isolated.output, "utf8")).toContain("future_api_code");
    expect(isolated.generate(true).status).toBe(0);
  });

  it("uses regenerated host notes, check classification and message origin in real consumers", async () => {
    const isolated = fixture();
    isolated.mutate<GoalContract>(
      "scheduled_goal_notes_contract.json",
      (goal) => {
        goal.agent_stop_last_error_prefix = "contract-owned stop: ";
        goal.auto_pause_last_error = "contract-owned auto pause";
        goal.host_run_errors.queue_timeout = "contract-owned queue timeout";
        goal.check_failure_codes = ["no_verdict"];
        goal.scheduled_origin_key = "contract_owned_scheduled_origin";
      },
    );
    expect(isolated.generate().status).toBe(0);
    const generated = generatedNamespace(readFileSync(isolated.output, "utf8"));
    vi.resetModules();
    vi.doMock("@/core/contracts/backend.gen", () => generated);
    const goal = await import("@/core/scheduled-tasks/goal-outcome");
    const run = await import("@/core/scheduled-tasks/run-error");
    const messages = await import("@/core/scheduled-tasks/messages");
    expect(goal.parseStopRunId("contract-owned stop: run-17")).toBe("run-17");
    expect(
      goal.parseStopRunId("stopped by the agent in run run-17"),
    ).toBeNull();
    expect(goal.describeTaskLastError("contract-owned auto pause")).toEqual({
      kind: "autoPause",
    });
    expect(
      goal.describeTaskLastError("paused after 3 unmet scheduled goal runs"),
    ).toBeNull();
    expect(
      goal.describeGoalOutcome({ status: "unmet", error: "no_verdict" })?.kind,
    ).toBe("unchecked");
    expect(
      goal.describeGoalOutcome({ status: "unmet", error: "evaluator_failed" })
        ?.kind,
    ).toBe("unmet");
    expect(
      run.describeRunError({
        status: "failed",
        error: "contract-owned queue timeout",
        run_id: null,
      }),
    ).toEqual({ key: "queueTimeout", raw: null });
    const origin = {
      task_id: "task-17",
      instructions: "Inspect the current release",
    };
    expect(
      messages.scheduledOriginOf({
        type: "human",
        content: "run",
        additional_kwargs: { contract_owned_scheduled_origin: origin },
      })?.task_id,
    ).toBe("task-17");
    expect(
      messages.scheduledOriginOf({
        type: "human",
        content: "run",
        additional_kwargs: { deerflow_scheduled_origin: origin },
      }),
    ).toBeNull();
  });

  it("rejects newly generated codes missing from the actual production maps", () => {
    const isolated = fixture();
    expect(isolated.generate().status).toBe(0);
    const consumerDiagnostics = createConsumerChecker();
    expect(consumerDiagnostics(readFileSync(isolated.output, "utf8"))).toEqual(
      [],
    );
    isolated.mutate<GoalContract>(
      "scheduled_goal_notes_contract.json",
      (goal) => {
        goal.unmet_reason_codes.push("blocked:future_unmet");
        goal.host_run_errors.future_host = "future host failure";
        goal.lifecycle_events.push("task_archived");
        goal.lifecycle_reasons.task_archived = ["archived"];
      },
    );
    isolated.mutate<{ ui_codes: string[] }>(
      "scheduled_task_errors_contract.json",
      (errors) => {
        errors.ui_codes.push("future_api_code");
      },
    );
    expect(isolated.generate().status).toBe(0);
    const diagnostics = consumerDiagnostics(
      readFileSync(isolated.output, "utf8"),
    );
    for (const [file, missing] of [
      ["goal-outcome", "future_unmet"],
      ["run-error", "future host failure"],
      ["events", "task_archived"],
      ["errors", "future_api_code"],
    ]) {
      expect(
        diagnostics.some(
          (entry) =>
            entry.file.endsWith(`/${file}.ts`) &&
            entry.message.includes(missing!),
        ),
        JSON.stringify(diagnostics),
      ).toBe(true);
    }

    // Nested property errors can mask TypeScript's outer missing-property
    // diagnostic, so check new reasons independently of the new event.
    isolated.mutate<GoalContract>(
      "scheduled_goal_notes_contract.json",
      (goal) => {
        goal.lifecycle_events = goal.lifecycle_events.filter(
          (event) => event !== "task_archived",
        );
        delete goal.lifecycle_reasons.task_archived;
        goal.lifecycle_reasons.task_finished!.push("future_finish");
        goal.lifecycle_reasons.task_paused!.push("future_pause");
      },
    );
    expect(isolated.generate().status).toBe(0);
    const reasonDiagnostics = consumerDiagnostics(
      readFileSync(isolated.output, "utf8"),
    );
    for (const reason of ["future_finish", "future_pause"]) {
      expect(
        reasonDiagnostics.some(
          (entry) =>
            entry.file.endsWith("/events.ts") && entry.message.includes(reason),
        ),
        JSON.stringify(reasonDiagnostics),
      ).toBe(true);
    }
  });
});
