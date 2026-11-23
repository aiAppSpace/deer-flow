import { expect, test } from "./support/test";
import { captureScenario } from "./support/capture";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  scenarioStates,
} from "./support/scenarios";
import type { Page, Request } from "@playwright/test";

type Card = {
  node: number;
  taskId: string | null;
  group: string | null;
  top: number;
  bottom: number;
};
type Frame = {
  at: number;
  kind: "start" | "raf" | "mutation" | "stop";
  viewport: number | null;
  top: number;
  height: number;
  client: number;
  cards: Card[];
};
type Observation = {
  timeOrigin: number;
  frames: Frame[];
  intersections: {
    at: number;
    node: number;
    taskId: string | null;
    group: string | null;
    visible: boolean;
    ratio: number;
    intersection: { x: number; y: number; width: number; height: number };
    root: { x: number; y: number; width: number; height: number } | null;
    top: number;
    bottom: number;
  }[];
  truncated: boolean;
};
declare global {
  interface Window {
    __initialScrollObservation?: { stop(): Observation };
  }
}

for (const [app, base] of [
  ["react", process.env.E2E_REACT_APP_URL!],
  ["vue", process.env.E2E_APP_URL!],
] as const) {
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    test(`${app}: initial scheduled cards enter viewport (${reducedMotion})`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({
        ...PARITY_CONTEXT_OPTIONS,
        reducedMotion,
      });
      let page: Page | undefined;
      const network: {
        id: number;
        method: string;
        url: string;
        startedAt: number;
        headersAt?: number;
        finishedAt?: number;
        failedAt?: number;
        status?: number;
        failure?: string;
      }[] = [];
      const requests = new Map<Request, number>();
      const pageErrors: string[] = [];
      let phase = "install-observer";
      let failure: string | undefined;
      let primaryError: unknown;
      let hasPrimaryError = false;
      let cleanupFailure: unknown;
      let observation: Observation | undefined;
      let capture: unknown;
      try {
        page = await context.newPage();
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (!url.pathname.startsWith("/api/")) return;
          const id = network.length;
          requests.set(request, id);
          network.push({
            id,
            method: request.method(),
            url: url.pathname + url.search,
            startedAt: Date.now(),
          });
        });
        page.on("response", (response) => {
          const id = requests.get(response.request());
          if (id !== undefined)
            Object.assign(network[id]!, {
              headersAt: Date.now(),
              status: response.status(),
            });
        });
        page.on("requestfinished", (request) => {
          const id = requests.get(request);
          if (id !== undefined)
            Object.assign(network[id]!, { finishedAt: Date.now() });
        });
        page.on("requestfailed", (request) => {
          const id = requests.get(request);
          if (id !== undefined)
            Object.assign(network[id]!, {
              failedAt: Date.now(),
              failure: request.failure()?.errorText ?? "unknown",
            });
        });
        await page.addInitScript(() => {
          const result: Observation = {
            timeOrigin: performance.timeOrigin,
            frames: [],
            intersections: [],
            truncated: false,
          };
          const nodes = new WeakMap<Element, number>();
          const observed = new WeakSet<Element>();
          let nextNode = 0;
          let frame = 0;
          let stopped = false;
          let firstCardsSeen = false;
          function ordinal(node: Element) {
            let id = nodes.get(node);
            if (id === undefined) {
              id = ++nextNode;
              nodes.set(node, id);
            }
            return id;
          }
          const group = (node: Element) =>
            node
              .closest("[data-message-group-index]")
              ?.getAttribute("data-message-group-index") ?? null;
          const rect = (value: DOMRectReadOnly) => ({
            x: value.x,
            y: value.y,
            width: value.width,
            height: value.height,
          });
          const recordIntersections = (
            entries: IntersectionObserverEntry[],
          ) => {
            for (const entry of entries) {
              result.intersections.push({
                at: performance.now(),
                node: ordinal(entry.target),
                taskId: entry.target.getAttribute("data-task-id"),
                group: group(entry.target),
                visible: entry.isIntersecting,
                ratio: entry.intersectionRatio,
                intersection: rect(entry.intersectionRect),
                root: entry.rootBounds ? rect(entry.rootBounds) : null,
                top: entry.boundingClientRect.top,
                bottom: entry.boundingClientRect.bottom,
              });
            }
          };
          // Threshold zero can deliver isIntersecting at a zero-area boundary,
          // then never deliver its later positive area. This test-only observer
          // keeps that event and separately samples the 0.1% crossing.
          const intersections = new IntersectionObserver(recordIntersections, {
            threshold: [0, 0.001],
          });
          function snapshot(kind: Frame["kind"]) {
            if (stopped) return;
            const viewport =
              document.querySelector<HTMLElement>('[role="log"] > div');
            const cards = [
              ...(viewport?.querySelectorAll(
                '[data-testid="scheduled-task-card"]',
              ) ?? []),
            ];
            for (const card of cards) {
              if (!observed.has(card)) {
                observed.add(card);
                intersections.observe(card);
              }
            }
            if (cards.length) firstCardsSeen = true;
            if (!firstCardsSeen) return;
            if (result.frames.length >= 5000) {
              result.truncated = true;
              return;
            }
            result.frames.push({
              at: performance.now(),
              kind,
              viewport: viewport ? ordinal(viewport) : null,
              top: viewport?.scrollTop ?? 0,
              height: viewport?.scrollHeight ?? 0,
              client: viewport?.clientHeight ?? 0,
              cards: cards.map((card) => {
                const rect = card.getBoundingClientRect();
                return {
                  node: ordinal(card),
                  taskId: card.getAttribute("data-task-id"),
                  group: group(card),
                  top: rect.top,
                  bottom: rect.bottom,
                };
              }),
            });
          }
          const mutations = new MutationObserver(() => snapshot("mutation"));
          const start = () => {
            mutations.observe(document.documentElement, {
              subtree: true,
              childList: true,
            });
            snapshot("start");
            const tick = () => {
              snapshot("raf");
              if (!stopped) frame = requestAnimationFrame(tick);
            };
            frame = requestAnimationFrame(tick);
          };
          if (document.documentElement) start();
          else
            document.addEventListener("DOMContentLoaded", start, {
              once: true,
            });
          window.__initialScrollObservation = {
            stop() {
              snapshot("stop");
              recordIntersections(intersections.takeRecords());
              stopped = true;
              cancelAnimationFrame(frame);
              mutations.disconnect();
              intersections.disconnect();
              return result;
            },
          };
        });
        phase = "natural-scenario-load";
        const scenario = PARITY_SCENARIOS.find(
          (item) => item.id === "scheduled-task-chat-card",
        )!;
        const state = scenarioStates(scenario).find(
          (item) => item.id === "chat-card",
        )!;
        capture = await captureScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          state,
        );
        observation = await page.evaluate(() =>
          window.__initialScrollObservation!.stop(),
        );
        phase = "verify-natural-trajectory";
        const complete = observation.frames.filter(
          (row) => row.cards.length === 5,
        );
        expect(complete.length).toBeGreaterThan(0);
        const final = observation.frames.at(-1)!;
        expect(final.kind).toBe("stop");
        expect(final.cards).toHaveLength(5);
        expect(final.viewport).not.toBeNull();
        expect(new Set(observation.frames.map((row) => row.viewport))).toEqual(
          new Set([final.viewport]),
        );
        expect(final.height - final.client - final.top).toBeLessThanOrEqual(2);
        const cardNodes = new Set(final.cards.map((card) => card.node));
        const entered = new Set(
          observation.intersections
            .filter(
              (row) =>
                row.visible &&
                row.intersection.width > 0 &&
                row.intersection.height > 0 &&
                cardNodes.has(row.node),
            )
            .map((row) => row.node),
        );
        expect(entered.size).toBe(5);
        expect(
          complete.some(
            (row) =>
              row.kind === "raf" &&
              row.top > 1 &&
              row.height - row.client - row.top > 2,
          ),
        ).toBe(true);
        expect(observation.truncated).toBe(false);
        expect(pageErrors).toEqual([]);
        phase = "verified";
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        primaryError = error;
        hasPrimaryError = true;
      } finally {
        let observationError: string | undefined;
        try {
          observation ??= await page?.evaluate(() =>
            window.__initialScrollObservation?.stop(),
          );
        } catch (error) {
          observationError = String(error);
          cleanupFailure = error;
        }
        try {
          await info.attach(`${app}-${reducedMotion}-initial-scroll`, {
            body: JSON.stringify(
              {
                app,
                base,
                reducedMotion,
                phase,
                failure,
                observationError,
                observation,
                network,
                pageErrors,
                capture,
              },
              null,
              2,
            ),
            contentType: "application/json",
          });
        } catch (error) {
          cleanupFailure ??= error;
          info.annotations.push({
            type: "observation-cleanup-error",
            description: String(error),
          });
        } finally {
          try {
            await context.close();
          } catch (error) {
            cleanupFailure ??= error;
            info.annotations.push({
              type: "context-close-error",
              description: String(error),
            });
          }
        }
      }
      if (hasPrimaryError) throw primaryError;
      if (cleanupFailure) throw cleanupFailure;
    });
  }
}
