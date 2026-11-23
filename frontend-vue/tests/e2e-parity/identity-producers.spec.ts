import { readFile } from "node:fs/promises";
import { test as baseTest, expect, type TestInfo } from "./support/test";
import {
  captureScenario,
  describeFocus,
  sampleTabbables,
} from "./support/capture";
import { installIdentityCapture } from "./support/capture-identities";
import {
  recordNetwork,
  projectNetwork,
  type NetworkSnapshot,
} from "./support/capture-network";
import type { IdentitySnapshot } from "./support/identity-receipts";
import {
  buildIdentityRegistry,
  type IdentityExpectations,
} from "./support/identity-registry";
import { projectIdentityNetwork } from "./support/identity-projection";
import { createCapturePage, claimCapturePage } from "./support/capture-page";
import type { FreshPageSnapshot } from "./support/capture-page";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
  type ParityScenario,
  type ParityState,
  type ParityStep,
} from "./support/scenarios";

const test = baseTest.extend({
  page: async ({ browser }, use) => {
    const owned = await createCapturePage(browser);
    try {
      await use(owned.page);
    } finally {
      await owned.close();
    }
  },
});

type Evidence = {
  completed: boolean;
  freshPage: FreshPageSnapshot;
  identity: IdentitySnapshot;
  snapshot: NetworkSnapshot;
  cleanupErrors: string[];
};
async function evidence(
  info: TestInfo,
  scenario: ParityScenario,
  state: ParityState,
) {
  const attachment = info.attachments.findLast((item) =>
    item.name.startsWith(
      `parity-network-${scenario.id}-${state.id || "default"}-`,
    ),
  );
  if (!attachment)
    throw new Error("Capture did not preserve raw identity/network evidence");
  const result = JSON.parse(
    (attachment.body ?? (await readFile(attachment.path!))).toString(),
  ) as Evidence;
  expect(result.completed).toBe(true);
  expect(result.freshPage).toEqual({
    kind: "owned-fresh-page",
    ready: true,
    errors: [],
  });
  expect(result.identity.complete).toBe(true);
  expect(result.cleanupErrors).toEqual([]);
  return result;
}
function scenario(id: string) {
  const result = PARITY_SCENARIOS.find((item) => item.id === id);
  if (!result) throw new Error(`Missing actual shared scenario ${id}`);
  return result;
}
// Explicit fixture IDs make off/on bytes comparable without replacing UUIDs.
function memoryState(id: string, literalOnly = false): ParityState {
  const state = scenarioStates(scenario("settings-memory-import")).find(
    (item) => item.id === id,
  )!;
  return {
    ...state,
    steps: state.steps.map((step): ParityStep => {
      if (step.kind !== "set-input-files") return step;
      const payload = JSON.parse(
        Buffer.from(step.file.base64, "base64").toString(),
      ) as {
        facts: Array<{ id?: string; content: string; category: string }>;
      };
      if (literalOnly)
        payload.facts = payload.facts.map((fact, index) => ({
          ...fact,
          id: `literal-file-${index}`,
        }));
      payload.facts.push({
        id: "literal-existing",
        content: "Explicit existing fact",
        category: "context",
      });
      return {
        ...step,
        file: {
          ...step.file,
          base64: Buffer.from(JSON.stringify(payload)).toString("base64"),
        },
      };
    }),
  };
}
const apps = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

async function checkMemoryAdmission(
  info: TestInfo,
  base: string,
  data: Pick<Evidence, "snapshot" | "identity" | "freshPage">,
  entry: ParityScenario,
  state: ParityState,
  mode: "import" | "preview" | "cancel" | "retry" | "literal",
  label: string,
) {
  // Independent table next to its original file fixture. Do not infer expected
  // generated IDs or source branches from the observed receipt or HTTP body.
  const file = state.steps.find((step) => step.kind === "set-input-files");
  if (!file || file.kind !== "set-input-files")
    throw new Error("Memory fixture has no file action");
  expect(state.steps.indexOf(file)).toBe(0);
  const payload = JSON.parse(
    Buffer.from(file.file.base64, "base64").toString(),
  ) as { facts: { id?: string }[] };
  expect(payload.facts.map((fact) => fact.id ?? null)).toEqual([
    mode === "literal" ? "literal-file-0" : null,
    "literal-existing",
  ]);
  const path = new URL(entry.path, base).pathname;
  const expectations: IdentityExpectations = {
    scenario: entry.id,
    state: state.id,
    dimension: [
      DEFAULT_DIMENSION.viewport,
      DEFAULT_DIMENSION.theme,
      DEFAULT_DIMENSION.locale,
    ],
    threads: [
      {
        slot: "initial-entry",
        producer: "thread:main",
        account: "default",
        projectIntent: null,
        agent: null,
        path,
        source:
          mode === "literal"
            ? {
                kind: "literal",
                raw: "00000000-0000-0000-0000-000000000001",
                draft: false,
                mock: false,
              }
            : {
                kind: "allocation",
                reason: "initial",
                actions: ["entry", "settle:0"],
              },
        requireUploadsLimits: true,
      },
    ],
    memory: {
      account: "default",
      stableAccount: true,
      file: {
        slot: "selected-file",
        choiceActions: ["steps:0"],
        facts: [
          {
            index: 0,
            source:
              mode === "literal"
                ? { kind: "literal", raw: "literal-file-0" }
                : { kind: "generated" },
          },
          { index: 1, source: { kind: "literal", raw: "literal-existing" } },
        ],
      },
      dispatchActions:
        mode === "preview" || mode === "cancel"
          ? []
          : mode === "retry"
            ? ["confirm-1", "confirm-2"]
            : ["steps:1"],
      terminal: mode === "preview" ? "active" : "retired",
    },
  };
  const registry = buildIdentityRegistry({
    appBase: base,
    network: data.snapshot,
    identity: data.identity,
    freshPage: data.freshPage,
    expectations,
  });
  const projection = projectIdentityNetwork(data.snapshot, base, registry);
  await info.attach(`actual-memory-admission-${label}`, {
    contentType: "application/json",
    body: JSON.stringify({
      scope:
        "SINGLE_STABLE_ACCOUNT_FILE_SOURCE_CONSISTENCY_NOT_GENERAL_HTTP_CAUSAL_OWNERSHIP",
      expectations,
      registryErrors: registry.errors,
      memory: registry.memory,
      entities: registry.entities,
      decisions: [...registry.requestDecisions],
      projection,
    }),
  });
  expect(registry.errors).toEqual([]);
  expect(projection.observationErrors).toEqual([]);
  expect(registry.memory!.requests).toHaveLength(
    expectations.memory!.dispatchActions.length,
  );
  for (const sequence of registry.memory!.requests) {
    const at = data.snapshot.requests.findIndex(
      (row) => row.sequence === sequence,
    );
    if (mode === "literal") {
      expect(registry.requestDecisions.has(sequence)).toBe(false);
      expect(projection.requestFacts[at]).toBe(
        projectNetwork(data.snapshot, base).requestFacts[at],
      );
    } else
      expect(registry.requestDecisions.get(sequence)).toEqual([
        {
          slot: { kind: "body", path: ["facts", 0, "id"], role: "import-fact" },
          raw: registry.memory!.facts[0]!.raw,
          identity: registry.memory!.facts[0]!.identity,
        },
      ]);
  }
}

// Actual production frontends, installed SDK/adapters and original shared
// actions. API routes are the scenario's declared fixtures. These assertions
// establish producer delivery and raw relations. Initial-query cases also check
// the initial registry/projection increment, not the complete T06/T01–T18 matrix.
for (const [app, base] of apps) {
  for (const surface of ["main", "agent"] as const) {
    test(`${app} ${surface} actual new-chat selection and initial query are observed`, async ({
      page,
    }, info) => {
      const entry = scenario(surface === "main" ? "chat" : "agent-chat");
      const state = scenarioStates(entry)[0]!;
      await captureScenario(page, base, entry, DEFAULT_DIMENSION, state);
      const result = await evidence(info, entry, state);
      const packets = result.identity.receipts.flatMap((row) =>
        row.packet ? [row.packet] : [],
      );
      const selections = packets.filter(
        (packet) =>
          packet.producer === `thread:${surface}` &&
          packet.event === "thread.select" &&
          packet.values.draft === true,
      );
      expect(selections.length).toBeGreaterThan(0);
      for (const packet of selections) {
        expect(packet.values.agent).toBe(
          surface === "agent" ? "test-agent" : null,
        );
        expect(packet.values.path).toBe(entry.path);
      }
      const ids = new Set(selections.map((packet) => packet.values.raw));
      const allocations = packets.filter(
        (packet) =>
          packet.event === "thread.allocate" && ids.has(packet.values.raw),
      );
      expect(allocations.length).toBeGreaterThan(0);
      const limits = result.snapshot.requests.filter((request) =>
        /\/api\/threads\/[^/]+\/uploads\/limits$/.test(
          new URL(request.url).pathname,
        ),
      );
      expect(limits.length).toBeGreaterThan(0);
      for (const request of limits)
        expect(
          ids.has(
            decodeURIComponent(new URL(request.url).pathname.split("/")[3]!),
          ),
        ).toBe(true);
      const consumers = packets.filter(
        (packet) => packet.event === "uploads.limits",
      );
      expect(consumers).toHaveLength(limits.length);
      expect(
        packets.filter((packet) => packet.event === "uploads.unowned"),
      ).toEqual([]);
      for (const consumer of consumers) {
        expect(consumer.producer).toBe(`thread:${surface}`);
        expect(ids.has(consumer.values.raw)).toBe(true);
        const lease = packets.find(
          (packet) =>
            packet.producer === consumer.producer &&
            packet.instance === consumer.instance &&
            packet.event === "lease.select" &&
            packet.values.lease === consumer.values.lease &&
            packet.values.epoch ===
              (consumer.values.state === "candidate"
                ? 1
                : consumer.values.epoch),
        );
        expect(lease?.values.raw).toBe(consumer.values.raw);
        expect(
          allocations.some(
            (packet) =>
              packet.instance === consumer.instance &&
              packet.values.allocation === lease?.values.allocation &&
              packet.values.raw === consumer.values.raw,
          ),
        ).toBe(true);
        expect(consumer.values.state).not.toBe("retired");
      }
      if (app === "vue")
        expect(
          consumers.some((packet) => packet.values.state === "candidate"),
        ).toBe(true);
      await info.attach(`actual-initial-query-${app}-${surface}`, {
        body: JSON.stringify({
          scope: "RAW_NATIVE_PRODUCER_DELIVERY_NOT_T06_REGISTRY_ACCEPTANCE",
          publicStartTimes: limits.map((request) => request.startedAt),
          producerOrigins: allocations.map((packet) => packet.at),
          selectionOrigins: selections.map((packet) => packet.at),
          missingPublicTiming: limits.some(
            (request) => request.startedAt === null,
          ),
        }),
        contentType: "application/json",
      });
      const registry = buildIdentityRegistry({
        appBase: base,
        network: result.snapshot,
        identity: result.identity,
        freshPage: result.freshPage,
        expectations: {
          scenario: entry.id,
          state: state.id,
          dimension: [
            DEFAULT_DIMENSION.viewport,
            DEFAULT_DIMENSION.theme,
            DEFAULT_DIMENSION.locale,
          ],
          threads: [
            {
              slot: "initial-entry",
              producer: `thread:${surface}`,
              account: "default",
              projectIntent: null,
              agent: surface === "agent" ? "test-agent" : null,
              path: entry.path,
              source: {
                kind: "allocation",
                reason: "initial",
                actions: ["entry", "settle:0"],
              },
              requireUploadsLimits: true,
            },
          ],
        },
      });
      const projection = projectIdentityNetwork(
        result.snapshot,
        base,
        registry,
      );
      // Keep diagnostic evidence even if any admission assertion below fails.
      await info.attach(`actual-initial-projection-${app}-${surface}`, {
        body: JSON.stringify({
          scope: "INITIAL_THREAD_LIMITS_ONLY_NOT_FULL_T06_ACCEPTANCE",
          errors: registry.errors,
          decisions: [...registry.requestDecisions],
          projection,
        }),
        contentType: "application/json",
      });
      expect(registry.errors).toEqual([]);
      expect(registry.entities).toHaveLength(1);
      expect(registry.requestDecisions.size).toBe(limits.length);
      expect(projection.observationErrors).toEqual([]);
      for (const request of limits) {
        const index = result.snapshot.requests.indexOf(request);
        const fact = JSON.parse(projection.requestFacts[index]!);
        expect(fact.url.path[3]).toEqual(registry.entities[0]!.identity);
        expect(projection.requests[index]).toBe(
          JSON.stringify([fact.method, fact.url]),
        );
      }
    });

    test(`${app} ${surface} actual first send preserves generated human and submission target`, async ({
      page,
    }, info) => {
      const main = scenario("chat-thread-init-ordering");
      const entry =
        surface === "main"
          ? main
          : { ...scenario("agent-chat"), id: "identity-agent-first-send" };
      const state = { ...scenarioStates(main)[0]!, id: "observed-first-send" };
      await captureScenario(page, base, entry, DEFAULT_DIMENSION, state);
      const result = await evidence(info, entry, state);
      const packets = result.identity.receipts.flatMap((row) =>
        row.packet ? [row.packet] : [],
      );
      const humans = packets.filter(
        (packet) => packet.event === "human.allocate",
      );
      expect(humans.length).toBeGreaterThan(0);
      const ids = new Set(humans.map((packet) => packet.values.raw));
      expect(ids.size).toBe(1);
      for (const packet of humans) expect(packet.action).toBe("steps:1");
      const runs = result.snapshot.requests.filter(
        (request) =>
          request.method === "POST" &&
          /\/api\/langgraph\/threads\/[^/]+\/runs\/stream$/.test(
            new URL(request.url).pathname,
          ),
      );
      expect(runs).toHaveLength(1);
      const request = runs[0]!;
      if (request.bodyBase64 === null)
        throw new Error("Actual run request has no observable body");
      const body = JSON.parse(
        Buffer.from(request.bodyBase64, "base64").toString(),
      ) as {
        input?: {
          messages?: Array<{ id?: string; type?: string; role?: string }>;
        };
      };
      const sent =
        body.input?.messages?.filter((message) => ids.has(message.id!)) ?? [];
      expect(sent).toHaveLength(1);
      const thread = decodeURIComponent(
        new URL(request.url).pathname.split("/")[4]!,
      );
      for (const packet of humans) expect(packet.values.thread).toBe(thread);
      const submissions = packets.filter(
        (packet) => packet.event === "human.submission",
      );
      expect(submissions).toHaveLength(1);
      const submission = submissions[0]!;
      expect(submission.producer).toBe("human:send");
      expect(submission.values).toEqual({
        raw: sent[0]!.id,
        thread,
        index: body.input!.messages!.length - 1,
        messageCount: body.input!.messages!.length,
        keySource: app === "vue" ? "default" : "none",
        key: app === "vue" ? sent[0]!.id : null,
      });
      expect(
        body.input!.messages![Number(submission.values.index)],
      ).toMatchObject({
        type: "human",
        id: submission.values.raw,
      });
      const source = packets.filter(
        (packet) =>
          packet.producer === "human:send" &&
          packet.instance === submission.instance &&
          (packet.event === "human.allocate" || packet.event === "human.reuse"),
      );
      expect(source).toHaveLength(1);
      expect(source[0]!.values).toEqual({ raw: sent[0]!.id, thread });
      expect(submission.action).toBe(source[0]!.action);
      if (app === "vue")
        expect(request.headers["idempotency-key"]).toBe(sent[0]!.id);
      else expect(request.headers["idempotency-key"]).toBeNull();
      const registry = buildIdentityRegistry({
        appBase: base,
        network: result.snapshot,
        identity: result.identity,
        freshPage: result.freshPage,
        expectations: {
          scenario: entry.id,
          state: state.id,
          dimension: [
            DEFAULT_DIMENSION.viewport,
            DEFAULT_DIMENSION.theme,
            DEFAULT_DIMENSION.locale,
          ],
          threads: [
            {
              slot: "initial-entry",
              producer: `thread:${surface}`,
              account: "default",
              projectIntent: null,
              agent: surface === "agent" ? "test-agent" : null,
              path: entry.path,
              source: {
                kind: "allocation",
                reason: "initial",
                actions: ["entry", "settle:0"],
              },
              requireUploadsLimits: true,
              adoption: "same-raw",
            },
          ],
          runObservation: app === "vue" ? "adapter" : "sdk",
          runs: [
            {
              slot: "created-run",
              submission: { kind: "human", slot: "first-human" },
            },
          ],
          humans: [
            {
              slot: "first-human",
              threadSlot: "initial-entry",
              assistant: surface === "agent" ? "test-agent" : "lead_agent",
              source: {
                producer: app === "vue" ? "human:composer" : "human:send",
                actions: ["steps:1"],
              },
              submission: {
                slot: "first-send",
                // Vue's real ensureThread may finish during Enter or while
                // waiting for that same reply. Neither phase rewrites origin.
                actions: app === "vue" ? ["steps:1", "steps:2"] : ["steps:1"],
                keySource: app === "vue" ? "default" : "none",
              },
            },
          ],
        },
      });
      const projection = projectIdentityNetwork(
        result.snapshot,
        base,
        registry,
      );
      await info.attach(`actual-human-admission-${app}-${surface}`, {
        body: JSON.stringify({
          scope:
            "SINGLE_FIRST_SEND_NOT_GENERAL_TRANSPORT_OWNERSHIP_OR_T06_ACCEPTANCE",
          entities: registry.entities,
          humans: registry.humans,
          runAdoptions: registry.runAdoptions,
          decisions: [...registry.requestDecisions],
          registryErrors: registry.errors,
          projection,
        }),
        contentType: "application/json",
      });
      expect(registry.errors).toEqual([]);
      expect(registry.humans).toHaveLength(1);
      expect(registry.runAdoptions).toHaveLength(1);
      expect(registry.runAdoptions[0]!.run.candidate.request).toBe(request);
      expect(registry.runAdoptions[0]!.received.packet.values).toEqual({
        thread: registry.entities[0]!.raw,
        run: "00000000-0000-0000-0000-000000000099",
        state: "active",
      });
      expect(registry.runAdoptions[0]!.delivered.packet.values).toEqual(
        registry.runAdoptions[0]!.received.packet.values,
      );
      expect(projection.observationErrors).toEqual([]);
      const projectedRequest = JSON.parse(
        projection.requestFacts[result.snapshot.requests.indexOf(request)]!,
      );
      expect(projectedRequest.url.path[4]).toEqual(
        registry.entities[0]!.identity,
      );
      expect(projectedRequest.headers["idempotency-key"]).toEqual(
        app === "vue" ? registry.humans[0]!.identity : null,
      );
      expect(
        registry.requestDecisions
          .get(request.sequence)!
          .filter((decision) => decision.slot.kind === "body"),
      ).toEqual([
        {
          slot: {
            kind: "body",
            path: ["input", "messages", body.input!.messages!.length - 1, "id"],
            role: "input-message",
          },
          raw: sent[0]!.id,
          identity: registry.humans[0]!.identity,
        },
      ]);
    });
  }

  test(`${app} actual memory confirmation preserves the selected file's provenance`, async ({
    page,
  }, info) => {
    const entry = scenario("settings-memory-import");
    const state = memoryState("imported");
    await captureScenario(page, base, entry, DEFAULT_DIMENSION, state);
    const result = await evidence(info, entry, state);
    const packets = result.identity.receipts.flatMap((row) =>
      row.packet ? [row.packet] : [],
    );
    const selected = packets.filter(
      (packet) => packet.event === "memory.select",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]!.action).toBe("steps:0");
    const facts = packets.filter((packet) => packet.event === "memory.fact");
    expect(facts.map((fact) => fact.values.generated)).toEqual([true, false]);
    const dispatch = packets.filter(
      (packet) => packet.event === "memory.dispatch",
    );
    expect(dispatch).toHaveLength(1);
    expect(dispatch[0]!.values).toEqual({
      state: "selected",
      preAborted: false,
    });
    expect(dispatch[0]!.action).toBe("steps:1");
    expect(dispatch[0]!.instance).toBe(selected[0]!.instance);
    const imports = result.snapshot.requests.filter(
      (request) =>
        request.method === "POST" &&
        new URL(request.url).pathname === "/api/memory/import",
    );
    expect(imports).toHaveLength(1);
    if (!imports[0]!.bodyBase64)
      throw new Error("Actual memory import has no observable body");
    const body = JSON.parse(
      Buffer.from(imports[0]!.bodyBase64, "base64").toString(),
    ) as { facts: Array<{ id: string }> };
    for (const fact of facts) {
      expect(fact.action).toBe("steps:0");
      expect(body.facts[Number(fact.values.index)]!.id).toBe(fact.values.raw);
    }
    await checkMemoryAdmission(
      info,
      base,
      result,
      entry,
      state,
      "import",
      `${app}-import`,
    );
  });

  for (const terminal of ["preview", "cancel"] as const) {
    test(`${app} Memory ${terminal} does not claim a native import attempt`, async ({
      page,
    }, info) => {
      const entry = scenario("settings-memory-import");
      const preview = memoryState("legacy-confirmation");
      const state: ParityState = {
        ...preview,
        id: `source-${terminal}`,
        steps:
          terminal === "preview"
            ? preview.steps
            : [
                ...preview.steps,
                {
                  kind: "click",
                  target: { role: "button", name: "Cancel", exact: true },
                },
                {
                  kind: "hidden",
                  target: {
                    role: "dialog",
                    name: "Import memory?",
                    exact: true,
                  },
                },
              ],
      };
      await captureScenario(page, base, entry, DEFAULT_DIMENSION, state);
      const result = await evidence(info, entry, state);
      const packets = result.identity.receipts.flatMap((row) =>
        row.packet ? [row.packet] : [],
      );
      expect(
        packets.filter((packet) => packet.event === "memory.choice"),
      ).toHaveLength(1);
      expect(
        packets.filter((packet) => packet.event === "memory.dispatch"),
      ).toEqual([]);
      expect(
        packets.filter((packet) => packet.event === "memory.retire"),
      ).toHaveLength(terminal === "cancel" ? 1 : 0);
      expect(
        result.snapshot.requests.filter(
          (request) => new URL(request.url).pathname === "/api/memory/import",
        ),
      ).toEqual([]);
      await checkMemoryAdmission(
        info,
        base,
        result,
        entry,
        state,
        terminal,
        `${app}-${terminal}`,
      );
    });
  }

  test(`${app} actual Memory failed native attempt and retry keep one selected source`, async ({
    page,
  }, info) => {
    const freshPage = claimCapturePage(page);
    const network = recordNetwork(page, base);
    const owner = await installIdentityCapture(page, base);
    let completed = false;
    let attempts = 0;
    let snapshot: NetworkSnapshot | undefined;
    let identity: IdentitySnapshot | undefined;
    try {
      freshPage.activate();
      await runScenario(
        page,
        base,
        scenario("settings-memory-import"),
        DEFAULT_DIMENSION,
        memoryState("legacy-confirmation"),
        30_000,
        owner.beginAction,
      );
      await page.route("**/api/memory/import", async (route) => {
        attempts += 1;
        if (attempts === 1)
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Memory dispatch retry" }),
          });
        else await route.fallback();
      });
      const child = page.getByRole("dialog", {
        name: "Import memory?",
        exact: true,
      });
      await owner.beginAction("confirm-1");
      await child.getByRole("button", { name: "Import", exact: true }).click();
      await expect(
        page.getByText("Memory dispatch retry", { exact: true }),
      ).toBeVisible();
      await expect(
        child.getByRole("button", { name: "Import", exact: true }),
      ).toBeEnabled();
      await owner.beginAction("confirm-2");
      await child.getByRole("button", { name: "Import", exact: true }).click();
      await expect(child).toHaveCount(0);
      await waitForFiniteAnimations(page);
      await waitForDomQuiet(page);
      completed = true;
    } finally {
      try {
        identity = await owner.seal(() => {
          snapshot = network.stop();
        });
        await info.attach(`actual-memory-retry-${app}`, {
          contentType: "application/json",
          body: JSON.stringify({
            completed,
            identity,
            snapshot,
            freshPage: freshPage.snapshot(),
          }),
        });
      } finally {
        network.stop();
        try {
          expect(await owner.dispose()).toEqual([]);
        } finally {
          freshPage.dispose();
        }
      }
    }
    expect(identity!.complete).toBe(true);
    expect(identity!.errors).toEqual([]);
    const packets = identity!.receipts.flatMap((row) =>
      row.packet ? [row.packet] : [],
    );
    const source = packets.filter((packet) => packet.event === "memory.fact");
    const calls = packets.filter(
      (packet) => packet.event === "memory.dispatch",
    );
    expect(source).toHaveLength(2);
    expect(calls.map((packet) => packet.values)).toEqual([
      { state: "selected", preAborted: false },
      { state: "selected", preAborted: false },
    ]);
    expect(calls.map((packet) => packet.action)).toEqual([
      "confirm-1",
      "confirm-2",
    ]);
    expect(
      calls.every((packet) => packet.instance === source[0]!.instance),
    ).toBe(true);
    const requests = snapshot!.requests.filter(
      (request) => new URL(request.url).pathname === "/api/memory/import",
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]!.bodyBase64).toBe(requests[1]!.bodyBase64);
    expect(requests.map((request) => request.response?.status)).toEqual([
      503, 200,
    ]);
    await checkMemoryAdmission(
      info,
      base,
      {
        snapshot: snapshot!,
        identity: identity!,
        freshPage: freshPage.snapshot(),
      },
      scenario("settings-memory-import"),
      memoryState("legacy-confirmation"),
      "retry",
      `${app}-retry`,
    );
  });

  for (const surface of ["agent", "memory"] as const) {
    test(`${app} ${surface} observation on/off leaves exact wire UI focus and storage unchanged`, async ({
      browser,
    }, info) => {
      const entry =
        surface === "agent"
          ? scenario("agent-chat")
          : {
              ...scenario("settings-memory-import"),
              path: "/workspace/chats/00000000-0000-0000-0000-000000000001?settings=memory",
              mock: {
                ...scenario("settings-memory-import").mock,
                threads: [
                  {
                    thread_id: "00000000-0000-0000-0000-000000000001",
                    title: "Memory observation",
                  },
                ],
              },
            };
      const state =
        surface === "agent"
          ? scenarioStates(entry).find((item) => item.id === "completed-turn")!
          : memoryState("imported", true);
      const samples = [];
      for (const enabled of [false, true]) {
        const owned = await createCapturePage(browser);
        const { page } = owned;
        const freshPage = claimCapturePage(page);
        let network: ReturnType<typeof recordNetwork> | undefined;
        let owner:
          Awaited<ReturnType<typeof installIdentityCapture>> | undefined;
        const failures: unknown[] = [];
        try {
          network = recordNetwork(page, base);
          if (enabled) owner = await installIdentityCapture(page, base);
          freshPage.activate();
          await runScenario(
            page,
            base,
            entry,
            DEFAULT_DIMENSION,
            state,
            30_000,
            owner?.beginAction,
          );
          await page.waitForTimeout(700);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const sample = {
            aria: await page.locator("body").ariaSnapshot(),
            focus: await describeFocus(page),
            tabbables: await sampleTabbables(page),
            inputs: await page
              .locator("textarea")
              .evaluateAll((elements) =>
                elements.map(
                  (element) => (element as HTMLTextAreaElement).value,
                ),
              ),
            storage: await page.evaluate(() => ({
              local: { ...localStorage },
              session: { ...sessionStorage },
            })),
            path: new URL(page.url()).pathname,
          };
          let snapshot: NetworkSnapshot | undefined;
          const identity = await owner?.seal(() => {
            snapshot = network!.stop();
          });
          snapshot ??= network.stop();
          if (identity) expect(identity.complete).toBe(true);
          const projection = projectNetwork(snapshot, base);
          expect(projection.observationErrors).toEqual([]);
          samples.push({
            ...sample,
            wire: [...projection.requestFacts].sort(),
          });
          await info.attach(`actual-observation-${app}-${enabled}`, {
            body: JSON.stringify({
              enabled,
              snapshot,
              identity: identity ?? null,
              freshPage: freshPage.snapshot(),
              sample,
            }),
            contentType: "application/json",
          });
          if (surface === "memory") {
            const imports = snapshot.requests.filter(
              (request) =>
                request.method === "POST" &&
                new URL(request.url).pathname === "/api/memory/import",
            );
            expect(imports).toHaveLength(1);
            expect(imports[0]!.bodyBase64).not.toBeNull();
            const body = JSON.parse(
              Buffer.from(imports[0]!.bodyBase64!, "base64").toString(),
            ) as { facts: { id: string }[] };
            expect(body.facts.map((fact) => fact.id)).toEqual([
              "literal-file-0",
              "literal-existing",
            ]);
            if (identity) {
              const packets = identity.receipts.flatMap((row) =>
                row.packet ? [row.packet] : [],
              );
              const facts = packets.filter(
                (packet) => packet.event === "memory.fact",
              );
              const dispatch = packets.filter(
                (packet) => packet.event === "memory.dispatch",
              );
              expect(facts.map((packet) => packet.values.generated)).toEqual([
                false,
                false,
              ]);
              expect(dispatch).toHaveLength(1);
              expect(dispatch[0]!.values).toEqual({
                state: "selected",
                preAborted: false,
              });
              expect(dispatch[0]!.instance).toBe(facts[0]!.instance);
              await checkMemoryAdmission(
                info,
                base,
                { snapshot, identity, freshPage: freshPage.snapshot() },
                entry,
                state,
                "literal",
                `${app}-literal`,
              );
            }
          }
        } catch (error) {
          failures.push(error);
        } finally {
          try {
            network?.stop();
          } catch (error) {
            failures.push(error);
          }
          try {
            if (owner) expect(await owner.dispose()).toEqual([]);
          } catch (error) {
            failures.push(error);
          }
          try {
            freshPage.dispose();
          } catch (error) {
            failures.push(error);
          }
          try {
            await owned.close();
          } catch (error) {
            failures.push(error);
          }
        }
        if (failures.length === 1) throw failures[0];
        if (failures.length)
          throw new AggregateError(
            failures,
            "Observation comparison and cleanup failed",
            { cause: failures[0] },
          );
      }
      expect(samples[1]).toEqual(samples[0]);
    });
  }
}
