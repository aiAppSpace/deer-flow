import {
  expect,
  test,
  type BrowserContext,
  type Request,
  type TestInfo,
} from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

function savedTranscriptRead(request: Request) {
  const path = new URL(request.url()).pathname;
  return (
    request.method() === "POST" &&
    (/^\/mock\/api\/threads\/search$/.test(path) ||
      /^\/mock\/api\/threads\/[^/]+\/history$/.test(path))
  );
}

function mutation(request: Request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
    return null;
  const path = new URL(request.url()).pathname;
  if (!path.includes("/api/")) return null;
  // Static history/search are protocol reads. All thread/run/upload writes remain visible.
  if (savedTranscriptRead(request)) return null;
  return `${request.method()} ${path}`;
}

async function preserveAndClose(
  context: BrowserContext,
  info: TestInfo,
  name: string,
  evidence: object,
  failed: boolean,
) {
  const cleanupErrors: unknown[] = [];
  try {
    await info.attach(name, {
      body: JSON.stringify(evidence),
      contentType: "application/json",
    });
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await context.close();
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (!cleanupErrors.length) return;
  if (!failed)
    throw new AggregateError(cleanupErrors, "Evidence cleanup failed");
  // Preserve the original assertion as the failure; still surface cleanup errors.
  for (const error of cleanupErrors)
    info.annotations.push({
      type: "evidence-cleanup-error",
      description: String(error),
    });
}

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`${app}: read-only Showcase keeps capability discovery and blocks writes at ${viewport}`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const featureReads: {
        id: number;
        method: string;
        path: string;
        startedAt: number;
        completedAt?: number;
        status?: number;
        body?: unknown;
        failure?: string;
      }[] = [];
      const writes: string[] = [],
        errors: string[] = [],
        unexpected: string[] = [];
      let phase = "create-page";
      let failed = false;
      let failure: string | undefined;
      let inputBefore: string | undefined;
      let inputAfter: string | undefined;
      let url: string | undefined;
      try {
        const page = await context.newPage();
        const requests = new Map<Request, (typeof featureReads)[number]>();
        const responseReads: Promise<void>[] = [];
        page.on("request", (request) => {
          const path = new URL(request.url()).pathname;
          if (path === "/api/features") {
            const record = {
              id: featureReads.length + 1,
              method: request.method(),
              path,
              startedAt: Date.now(),
            };
            featureReads.push(record);
            requests.set(request, record);
          }
          const write = mutation(request);
          if (write) writes.push(write);
        });
        page.on("response", (response) => {
          const record = requests.get(response.request());
          if (!record) return;
          record.status = response.status();
          // Driver-side reading of the public fixture response does not replace
          // fetch, alter cache policy or assign an invisible QueryCache owner.
          responseReads.push(
            response.json().then(
              (body: unknown) => {
                record.body = body;
                record.completedAt = Date.now();
              },
              (error: unknown) => {
                record.failure = String(error);
              },
            ),
          );
        });
        page.on("requestfailed", (request) => {
          const record = requests.get(request);
          if (record)
            record.failure = request.failure()?.errorText ?? "request failed";
        });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/api/**", (route) => {
          // React's saved transcript is served by these real app routes. The
          // catch-all must not abort them before the scenario can load history.
          if (savedTranscriptRead(route.request())) return route.continue();
          unexpected.push(
            `${route.request().method()} ${new URL(route.request().url()).pathname}`,
          );
          return route.abort();
        });
        const scenario = PARITY_SCENARIOS.find(
          (entry) => entry.id === "showcase-public-thread",
        )!;
        phase = "saved-showcase-navigation";
        await runScenario(
          page,
          base,
          scenario,
          { ...DEFAULT_DIMENSION, viewport },
          scenarioStates(scenario)[0]!,
        );
        url = new URL(page.url()).pathname;
        phase = "readonly-controls";
        const input = page.locator('textarea[name="message"]');
        await expect(input).toHaveJSProperty("readOnly", true);
        await expect(input).toHaveAttribute("aria-disabled", "true");
        await expect(page.getByTestId("mention-button")).toBeDisabled();
        await expect(page.getByTestId("add-attachments-button")).toBeDisabled();
        await expect(page.locator('button[type="submit"]')).toBeDisabled();
        inputBefore = await input.inputValue();
        phase = "readonly-keyboard";
        await input.focus();
        await page.keyboard.type("this must stay read-only");
        await page.keyboard.press("Enter");
        inputAfter = await input.inputValue();
        await expect(input).toHaveValue(inputBefore);
        await expect(page.getByTestId("mention-picker")).toHaveCount(0);
        await expect(page.getByTestId("main-message-list")).toBeVisible();
        // The fixed scenario mounts four independent feature keys in React.
        // Network count is a companion check: key/admission ownership is proved
        // by real QueryClient + composer + API/fetcher mounted tests, not guessed
        // from this shared URL or from private framework state in the browser.
        phase = "feature-discovery-completion";
        await expect
          .poll(
            () => featureReads.filter((record) => record.completedAt).length,
          )
          .toBe(4);
        await Promise.all(responseReads);
        expect(
          featureReads.map(({ method, path }) => ({ method, path })),
        ).toEqual(
          Array.from({ length: 4 }, () => ({
            method: "GET",
            path: "/api/features",
          })),
        );
        for (const record of featureReads) {
          expect(record.status).toBe(200);
          expect(record.failure).toBeUndefined();
          expect(record.completedAt).toBeGreaterThanOrEqual(record.startedAt);
          expect(record.body).toMatchObject({
            agents_api: { enabled: true },
            knowledge_base: { scope_selection_enabled: false },
          });
          // This Showcase fixture omits reference support. A successful fetch
          // therefore authoritatively disables it instead of assuming permission.
          expect(record.body).not.toHaveProperty("conversation_references");
        }
        expect(writes).toEqual([]);
        expect(unexpected).toEqual([]);
        expect(errors).toEqual([]);
        phase = "complete";
      } catch (error) {
        failed = true;
        failure = String(error);
        throw error;
      } finally {
        await preserveAndClose(
          context,
          info,
          `${app}-${viewport}-capability-readonly`,
          {
            app,
            viewport,
            phase,
            failed,
            failure,
            featureReads,
            incompleteRequestIds: featureReads
              .filter((record) => !record.completedAt)
              .map((record) => record.id),
            writes,
            errors,
            unexpected,
            inputBefore,
            inputAfter,
            url,
          },
          failed,
        );
      }
    });
  }

  test(`${app}: editable conversation reference reaches the real run context`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const errors: string[] = [],
      unexpected: string[] = [];
    let phase = "create-page";
    let failed = false;
    let failure: string | undefined;
    let observedRun:
      | {
          method: string;
          contextReferences: unknown;
          displayReferences: unknown;
        }
      | undefined;
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/**", (route) => {
        unexpected.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        return route.abort();
      });
      const scenario = PARITY_SCENARIOS.find(
        (entry) => entry.id === "mentions",
      )!;
      const state = scenarioStates(scenario).find(
        (entry) => entry.id === "all-reference-kinds",
      )!;
      phase = "editable-navigation";
      await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);
      phase = "reference-selection";
      await page
        .getByRole("option", { name: "Writer brief", exact: true })
        .click();
      await expect(
        page.getByTestId("conversation-reference-chip"),
      ).toContainText("Writer brief");
      const input = page.getByRole("textbox", {
        name: /how can i assist you/i,
      });
      await input.press("End");
      await input.pressSequentially(" summarize");
      phase = "reference-submission";
      const run = page.waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().includes("/runs/stream"),
      );
      await input.press("Enter");
      const request = await run;
      const body = request.postDataJSON();
      observedRun = {
        method: request.method(),
        contextReferences: body.context?.conversation_references,
        displayReferences:
          body.input?.messages?.at(-1)?.additional_kwargs
            ?.conversation_references,
      };
      phase = "reference-wire-assertions";
      const source = scenario.mock!.threads![0]!;
      expect(body.context.conversation_references).toEqual([source.thread_id]);
      expect(
        body.input.messages.at(-1).additional_kwargs.conversation_references,
      ).toEqual([
        {
          thread_id: source.thread_id,
          title: "Writer brief",
          agent_name: "writer",
        },
      ]);
      expect(unexpected).toEqual([]);
      expect(errors).toEqual([]);
      phase = "complete";
    } catch (error) {
      failed = true;
      failure = String(error);
      throw error;
    } finally {
      await preserveAndClose(
        context,
        info,
        `${app}-reference-run-contract`,
        { app, phase, failed, failure, observedRun, errors, unexpected },
        failed,
      );
    }
  });
}
