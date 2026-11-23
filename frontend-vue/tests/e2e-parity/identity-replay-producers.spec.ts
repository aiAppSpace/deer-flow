import { test, expect } from "./support/test";
import { createCapturePage, claimCapturePage } from "./support/capture-page";
import { installIdentityCapture } from "./support/capture-identities";
import { recordNetwork, type NetworkSnapshot } from "./support/capture-network";
import type { IdentitySnapshot } from "./support/identity-receipts";
import { expectedRunProjection } from "../support/run-projection-oracle";
import type { RunIdentity } from "./support/identity-run-admission";
import { expectedReplayProjection } from "../support/replay-projection-oracle";
import {
  buildIdentityRegistry,
  type IdentityNode,
} from "./support/identity-registry";
import { projectIdentityNetwork } from "./support/identity-projection";
import { projectNetwork } from "./support/capture-network";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  createPreparedReplayFixture,
  installPreparedReplayFixture,
} from "../support/prepared-replay-fixture";

const apps = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

for (const [app, base] of apps)
  for (const surface of ["main", "agent"] as const)
    for (const kind of ["edit", "regenerate"] as const)
      test(`${app} ${surface} actual ${kind} retains prepared sources and independent key`, async ({
        browser,
      }, info) => {
        const fixture = createPreparedReplayFixture(surface, kind);
        const owned = await createCapturePage(browser);
        let fresh: ReturnType<typeof claimCapturePage> | undefined;
        let network: ReturnType<typeof recordNetwork> | undefined;
        let owner:
          Awaited<ReturnType<typeof installIdentityCapture>> | undefined;
        let snapshot: NetworkSnapshot | undefined;
        let identity: IdentitySnapshot | undefined;
        let serverState: unknown;
        let completed = false;
        const failures: unknown[] = [];
        const cleanupErrors: string[] = [];
        const cleanup = async (work: () => unknown | Promise<unknown>) => {
          try {
            await work();
          } catch (error) {
            failures.push(error);
            cleanupErrors.push(
              error instanceof Error ? error.message : String(error),
            );
          }
        };
        try {
          fresh = claimCapturePage(owned.page);
          network = recordNetwork(owned.page, base);
          owner = await installIdentityCapture(owned.page, base);
          fresh.activate();
          const page = owned.page;
          await page.setViewportSize({ width: 1280, height: 800 });
          const server = await installPreparedReplayFixture(page, fixture);
          await owner.beginAction("entry");
          await page.goto(new URL(fixture.path, base).href);
          await expect(
            page.getByText(fixture.human.content, { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText(fixture.assistant.content, { exact: true }),
          ).toBeVisible();
          await owner.beginAction("hover-source");
          if (kind === "edit") {
            await page
              .getByText(fixture.human.content, { exact: true })
              .hover();
            await owner.beginAction("open-edit");
            await page
              .getByRole("button", { name: "Edit and rerun", exact: true })
              .click();
            const editor = page.locator(".is-user textarea");
            await expect(editor).toHaveValue(fixture.human.content);
            await expect(editor).toBeFocused();
            await owner.beginAction("fill-edit");
            await editor.fill(fixture.replacement.content);
            await owner.beginAction("submit-replay");
            await page
              .getByRole("button", { name: "Update and rerun", exact: true })
              .click();
          } else {
            await page.locator("[data-assistant-turn]").last().hover();
            await owner.beginAction("submit-replay");
            await page
              .getByRole("button", { name: "Regenerate", exact: true })
              .click();
          }
          await expect(
            page.getByText(fixture.reply.content, { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText(fixture.assistant.content, { exact: true }),
          ).toHaveCount(0);
          if (kind === "edit") {
            await expect(
              page.getByText(fixture.replacement.content, { exact: true }),
            ).toBeVisible();
            await expect(
              page.getByText(fixture.human.content, { exact: true }),
            ).toHaveCount(0);
          }
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          serverState = server.snapshot();
          expect(serverState).toEqual({ submitted: true, violations: [] });
          completed = true;
        } catch (error) {
          failures.push(error);
        } finally {
          const installed = owner;
          if (installed)
            await cleanup(async () => {
              identity = await installed.seal(() => {
                snapshot = network?.stop();
              });
            });
          await cleanup(() => {
            snapshot ??= network?.stop();
          });
          if (installed)
            await cleanup(async () => {
              const errors = await installed.dispose();
              if (errors.length) throw new Error(errors.join("; "));
            });
          await cleanup(() => fresh?.dispose());
          await cleanup(() => owned.close());
          await cleanup(() =>
            info.attach(`actual-replay-${app}-${surface}-${kind}`, {
              contentType: "application/json",
              body: JSON.stringify({
                completed,
                fixture,
                serverState,
                freshPage: fresh?.snapshot(),
                identity,
                snapshot,
                cleanupErrors,
                operationErrors: failures.map((error) =>
                  error instanceof Error ? error.message : String(error),
                ),
              }),
            }),
          );
        }
        if (failures.length)
          throw new AggregateError(failures, "Prepared replay capture failed", {
            cause: failures[0],
          });
        expect(fresh!.snapshot()).toEqual({
          kind: "owned-fresh-page",
          ready: true,
          errors: [],
        });
        expect(identity!.complete).toBe(true);
        expect(identity!.errors).toEqual([]);
        expect(snapshot!.errors).toEqual([]);
        const registry = buildIdentityRegistry({
          appBase: base,
          network: snapshot!,
          identity: identity!,
          freshPage: fresh!.snapshot(),
          expectations: {
            scenario: "prepared-replay",
            state: `${surface}-${kind}`,
            dimension: ["desktop", "light", "en-US"],
            threads: [
              {
                slot: "persisted-replay",
                producer: surface === "agent" ? "thread:agent" : "thread:main",
                account: "default",
                projectIntent: null,
                agent: fixture.agent,
                path: fixture.path,
                source: {
                  kind: "literal",
                  raw: fixture.thread,
                  draft: false,
                  mock: false,
                },
                requireUploadsLimits: true,
              },
            ],
            replay: {
              slot: "selected-turn",
              threadSlot: "persisted-replay",
              account: "default",
              stableAccount: true,
              replacementText:
                kind === "edit" ? fixture.replacement.content : null,
              source: {
                kind,
                assistant: fixture.agent ?? "lead_agent",
                actions: ["submit-replay"],
                sourceHuman: fixture.human.id,
                wireHuman: fixture.human.id,
                sourceAssistant: fixture.assistant.id,
                oldRun: fixture.oldRun,
                checkpoint: fixture.prepared.checkpoint.checkpoint_id,
                versionGroup: kind === "edit" ? "existing-version-group" : null,
                sources:
                  kind === "edit"
                    ? {
                        type: "array",
                        ids: [fixture.human.id, fixture.assistant.id],
                      }
                    : { type: "absent" },
                key: app === "vue" ? "generated" : "none",
              },
            },
            runObservation: app === "vue" ? "adapter" : "sdk",
            runs: [
              {
                slot: "created-run",
                submission: { kind: "replay", slot: "selected-turn" },
              },
            ],
          },
        });
        expect(registry.errors).toEqual([]);
        expect(registry.replayCandidate).not.toBeNull();
        expect(registry.replay).not.toBeNull();
        expect(registry.runAdoptions).toHaveLength(1);
        expect(registry.runAdoptions[0]!.run.candidate.request).toBe(
          registry.replay!.candidate.run,
        );
        expect(registry.runAdoptions[0]!.received.packet.values).toEqual({
          thread: fixture.thread,
          run: fixture.newRun,
          state: "active",
        });
        expect(registry.runAdoptions[0]!.delivered.packet.values).toEqual(
          registry.runAdoptions[0]!.received.packet.values,
        );
        const semantic = (role: "replacement" | "key"): IdentityNode => [
          "identity",
          role === "replacement" ? "human" : "submission-key",
          JSON.stringify([
            registry.entities[0]!.identity[2],
            "selected-turn",
            role,
          ]),
        ];
        const expectedIdentities = {
          replacement: kind === "edit" ? semantic("replacement") : null,
          key: app === "vue" ? semantic("key") : null,
        };
        expect(registry.replay!.replacement?.identity ?? null).toEqual(
          expectedIdentities.replacement,
        );
        expect(registry.replay!.key?.identity ?? null).toEqual(
          expectedIdentities.key,
        );
        expect(registry.requestDecisions.size).toBe(1);
        expect(
          registry.requestDecisions.get(registry.replay!.candidate.run.sequence)
            ?.length ?? 0,
        ).toBe((kind === "edit" ? 2 : 0) + (app === "vue" ? 1 : 0) + 1);
        const projected = projectIdentityNetwork(snapshot!, base, registry);
        const independentRuns = snapshot!.requests.filter(
          (row) =>
            row.method === "POST" &&
            row.url ===
              new URL(
                `/api/langgraph/threads/${fixture.thread}/runs/stream`,
                base,
              ).href,
        );
        expect(independentRuns).toHaveLength(1);
        expect(registry.runs).toHaveLength(1);
        expect(registry.runs[0]!.candidate.request).toBe(independentRuns[0]);
        expect(registry.runs[0]!.raw).toBe(fixture.newRun);
        const runIdentity: RunIdentity = [
          "identity",
          "run",
          JSON.stringify([
            registry.entities[0]!.identity[2],
            ["replay", "selected-turn"],
            "created-run",
          ]),
        ];
        expect(registry.runs[0]!.identity).toEqual(runIdentity);
        const replayViews = expectedReplayProjection(
          snapshot!,
          base,
          independentRuns[0]!.sequence,
          expectedIdentities,
        );
        const expectedViews = expectedRunProjection(
          replayViews,
          snapshot!.requests.indexOf(independentRuns[0]!),
          [
            "run-location",
            "/api/threads/",
            ["string", fixture.thread],
            "/runs/",
            runIdentity,
            "",
          ],
        );
        const describeEntity = (
          entity: NonNullable<typeof registry.replay>["replacement"],
        ) =>
          entity && {
            raw: entity.raw,
            identity: entity.identity,
            source: entity.source,
            definitionSequence: entity.definition.sequence,
          };
        await info.attach(
          `actual-replay-projection-${app}-${surface}-${kind}`,
          {
            contentType: "application/json",
            body: JSON.stringify({
              scope:
                "Stable persisted-thread basic replay; exact replacement/key slots plus one created-run Content-Location composite; no consumer permission",
              prepareSequence: registry.replay!.candidate.prepare.sequence,
              runSequence: registry.replay!.candidate.run.sequence,
              replacement: describeEntity(registry.replay!.replacement),
              key: describeEntity(registry.replay!.key),
              runAdoptions: registry.runAdoptions,
              createdRun: {
                raw: registry.runs[0]!.raw,
                identity: registry.runs[0]!.identity,
                source: registry.runs[0]!.source,
                ownerBinding: registry.runs[0]!.ownerBinding,
                location: registry.runs[0]!.candidate.location,
              },
              decisions: [...registry.requestDecisions],
              literal: projectNetwork(snapshot!, base),
              projected,
              expectedViews,
            }),
          },
        );
        expect(projected.observationErrors).toEqual([]);
        expect(projected).toEqual(expectedViews);
        const packets = identity!.receipts.flatMap((row) =>
          row.packet?.producer === "replay" ? [row.packet] : [],
        );
        expect(new Set(packets.map((packet) => packet.instance)).size).toBe(1);
        expect(
          packets.every((packet) => packet.action === "submit-replay"),
        ).toBe(true);
        expect(
          packets
            .filter((packet) => packet.event === "replay.begin")
            .map((packet) => packet.values),
        ).toEqual([
          {
            kind,
            thread: fixture.thread,
            source: kind === "edit" ? fixture.human.id : fixture.assistant.id,
            agent: fixture.agent,
          },
        ]);
        for (const event of [
          "replay.adopt",
          "replay.submission",
          "replay.finish",
        ])
          expect(
            packets.filter((packet) => packet.event === event),
          ).toHaveLength(1);
        expect(
          packets.filter((packet) =>
            ["invalid", "replay.retire", "replay.failure"].includes(
              packet.event,
            ),
          ),
        ).toEqual([]);
        expect(
          packets
            .filter((packet) => packet.event === "replay.snapshot")
            .map((packet) => packet.values),
        ).toEqual(
          ["response", "attempt"].map((phase) => ({
            phase,
            complete: true,
            messageCount: 1,
            sourceCount: kind === "edit" ? 2 : 0,
            sourcesType: kind === "edit" ? "array" : "absent",
          })),
        );
        for (const phase of ["response", "attempt"]) {
          const references: Record<string, string | undefined> = {
            target_run_id: fixture.oldRun,
            replacement_human_message_id:
              kind === "edit" ? fixture.replacement.id : undefined,
            "checkpoint.checkpoint_id":
              fixture.prepared.checkpoint.checkpoint_id,
            "metadata.edit_message_id":
              kind === "edit" ? fixture.replacement.id : undefined,
            "metadata.edit_from_message_id":
              kind === "edit" ? fixture.human.id : undefined,
            "metadata.edit_version_group_id":
              kind === "edit" ? "existing-version-group" : undefined,
            "metadata.regenerate_from_run_id": fixture.oldRun,
            "metadata.regenerate_from_message_id": fixture.assistant.id,
            "metadata.regenerate_checkpoint_id":
              fixture.prepared.checkpoint.checkpoint_id,
          };
          expect(
            packets
              .filter(
                (packet) =>
                  packet.event === "replay.reference" &&
                  packet.values.phase === phase,
              )
              .map((packet) => packet.values),
          ).toEqual(
            Object.entries(references).map(([slot, raw]) => ({
              phase,
              slot,
              raw: raw ?? null,
              valueType: raw === undefined ? "absent" : "string",
            })),
          );
          expect(
            packets
              .filter(
                (packet) =>
                  packet.event === "replay.source" &&
                  packet.values.phase === phase,
              )
              .map((packet) => packet.values),
          ).toEqual(
            kind === "edit"
              ? [fixture.human.id, fixture.assistant.id].map((raw, index) => ({
                  phase,
                  index,
                  raw,
                }))
              : [],
          );
          expect(
            packets
              .filter(
                (packet) =>
                  packet.event === "replay.message" &&
                  packet.values.phase === phase,
              )
              .map((packet) => packet.values),
          ).toEqual([
            {
              phase,
              index: 0,
              type: "human",
              role: null,
              idPresent: true,
              raw: fixture.finalMessages[0]!.id,
            },
          ]);
        }
        const prepares = snapshot!.requests.filter((row) =>
          new URL(row.url).pathname.endsWith("/prepare"),
        );
        const runs = snapshot!.requests.filter((row) =>
          new URL(row.url).pathname.endsWith("/runs/stream"),
        );
        expect(prepares).toHaveLength(1);
        expect(prepares[0]!.method).toBe("POST");
        expect(prepares[0]!.response?.status).toBe(200);
        expect(new URL(prepares[0]!.url).pathname).toBe(fixture.preparePath);
        expect(
          JSON.parse(
            Buffer.from(prepares[0]!.bodyBase64!, "base64").toString(),
          ),
        ).toEqual(fixture.prepareBody);
        expect(runs).toHaveLength(1);
        const run = runs[0]!;
        expect(run.method).toBe("POST");
        expect(new URL(run.url).pathname).toBe(
          `/api/langgraph/threads/${fixture.thread}/runs/stream`,
        );
        const body = JSON.parse(
          Buffer.from(run.bodyBase64!, "base64").toString(),
        ) as Record<string, unknown>;
        expect(body.input).toEqual(fixture.prepared.input);
        expect(body.checkpoint).toEqual(fixture.prepared.checkpoint);
        expect(body.metadata).toEqual(fixture.prepared.metadata);
        expect(body.assistant_id).toBe(fixture.agent ?? "lead_agent");
        expect(
          packets
            .filter((packet) => packet.event === "replay.submission")
            .map((packet) => packet.values),
        ).toEqual([{ assistant: fixture.agent ?? "lead_agent" }]);
        expect(body.context).not.toHaveProperty("thread_id");
        if (surface === "agent")
          expect(body.context).toHaveProperty("agent_name", "test-agent");
        else expect(body.context).not.toHaveProperty("agent_name");
        expect(run.response?.status).toBe(200);
        expect(run.response?.headers["content-location"]).toBe(
          `/api/threads/${fixture.thread}/runs/${fixture.newRun}`,
        );
        const keys = packets.filter(
          (packet) => packet.event === "idempotency.allocate",
        );
        if (app === "vue") {
          expect(keys).toHaveLength(1);
          expect(keys[0]!.values).toEqual({
            raw: run.headers["idempotency-key"],
            thread: fixture.thread,
          });
          expect(run.headers["idempotency-key"]).toBeTruthy();
        } else {
          expect(keys).toEqual([]);
          expect(run.headers["idempotency-key"]).toBeNull();
        }
      });
