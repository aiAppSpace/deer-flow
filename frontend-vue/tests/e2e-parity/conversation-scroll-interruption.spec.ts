import { expect, test, type Page, type CDPSession } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  applyDimension,
  applyScenarioBackend,
  DEFAULT_DIMENSION,
  type ParityScenario,
} from "./support/scenarios";

function nativeTextPoint() {
  const viewport = document.querySelector<HTMLElement>(
    '[data-testid="main-message-list"] > div',
  );
  if (!viewport) return null;
  const extent = viewport.scrollHeight - viewport.clientHeight;
  if (viewport.scrollTop < extent / 2 || extent - viewport.scrollTop < 300)
    return null;
  const bounds = viewport.getBoundingClientRect();
  const lines: DOMRect[] = [];
  for (const p of viewport.querySelectorAll("p")) {
    if (!p.textContent?.includes("Select these ordinary words")) continue;
    const range = document.createRange();
    range.selectNodeContents(p);
    lines.push(
      ...[...range.getClientRects()].filter(
        (rect) =>
          rect.width > 250 &&
          rect.top > bounds.top + 40 &&
          rect.bottom < bounds.bottom - 40,
      ),
    );
  }
  const center = (bounds.top + bounds.bottom) / 2;
  const line = lines.sort(
    (a, b) => Math.abs(a.top - center) - Math.abs(b.top - center),
  )[0];
  if (line)
    return {
      x: line.left + 20,
      y: line.top + line.height / 2,
      endX: line.left + 160,
      top: viewport.scrollTop,
      range: viewport.scrollHeight - viewport.clientHeight,
    };
  return null;
}
function isTextPoint(
  value: unknown,
): value is NonNullable<ReturnType<typeof nativeTextPoint>> {
  return (
    !!value &&
    typeof value === "object" &&
    ["x", "y", "endX", "top", "range"].every(
      (key) =>
        typeof (value as Record<string, unknown>)[key] === "number" &&
        Number.isFinite((value as Record<string, unknown>)[key]),
    )
  );
}

const threadId = "native-initial-reading-owner";
type NativeObservation = Record<string, unknown>;
type ObservedWindow = Window & { nativeReading?: NativeObservation[] };
async function observeNativeInput(page: Page) {
  await page.evaluate(() => {
    const target = window as ObservedWindow;
    const observations: NativeObservation[] = [];
    target.nativeReading = observations;
    const record = (event?: Event) => {
      const viewport = document.querySelector<HTMLElement>(
        '[data-testid="main-message-list"] > div',
      );
      if (!viewport || observations.length >= 600) return;
      const selection = window.getSelection();
      const common = selection?.rangeCount
        ? selection.getRangeAt(0).commonAncestorContainer
        : null;
      observations.push({
        time: performance.now(),
        kind: event?.type ?? "frame",
        trusted: event?.isTrusted,
        key: event instanceof KeyboardEvent ? event.key : undefined,
        target:
          event?.target instanceof Element ? event.target.tagName : undefined,
        targetParagraph:
          event?.target instanceof Element && !!event.target.closest("p"),
        targetMarkup:
          event?.target instanceof Element
            ? event.target.outerHTML.slice(0, 300)
            : undefined,
        active: document.activeElement?.tagName,
        activeMarkup: event
          ? document.activeElement?.outerHTML.slice(0, 300)
          : undefined,
        keyInside: event ? viewport.contains(event.target as Node) : undefined,
        top: viewport.scrollTop,
        range: viewport.scrollHeight - viewport.clientHeight,
        selection: selection?.toString().slice(0, 160),
        selectionInside: !!common && viewport.contains(common),
      });
    };
    for (const type of [
      "mousedown",
      "mousemove",
      "mouseup",
      "click",
      "keydown",
      "selectionchange",
      "focusin",
    ])
      document.addEventListener(type, record, { capture: true, passive: true });
    const sample = () => {
      record();
      if (observations.length < 600) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
const scenario: ParityScenario = {
  id: "native-initial-reading-owner",
  title: "Initial history and native reading",
  backend: "mock",
  path: `/workspace/chats/${threadId}`,
  mock: {
    threads: [
      {
        thread_id: threadId,
        title: "Reading history",
        messages: Array.from({ length: 10 }, (_, index) => [
          {
            type: "human" as const,
            id: `reading-human-${index}`,
            content: `Reading question ${index}`,
          },
          {
            type: "ai" as const,
            id: `reading-ai-${index}`,
            content: Array.from(
              { length: 6 },
              (_, line) =>
                `Reading paragraph ${index} ${line}. Select these ordinary words while the conversation follows its new content into view.`,
            ).join("\n\n"),
          },
        ]).flat(),
      },
    ],
  },
  settle: [],
};
for (const [app, base] of [
  ["react", process.env.E2E_REACT_APP_URL!],
  ["vue", process.env.E2E_APP_URL!],
] as const) {
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    for (const input of [
      "selection",
      "wheel-and-keyboard",
      "focus-and-keyboard",
    ] as const) {
      test(`${app}: natural async history respects native ${input} (${reducedMotion})`, async ({
        browser,
      }, info) => {
        const context = await browser.newContext({
          ...PARITY_CONTEXT_OPTIONS,
          reducedMotion,
        });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const observations: unknown[] = [];
        const errors: string[] = [];
        let phase = "initialization";
        let failure: string | undefined;
        let primaryError: unknown;
        let hasPrimaryError = false;
        let cleanupFailure: unknown;
        let cleanupPage: Page | undefined;
        let cleanupMouse: CDPSession | undefined;
        let mouseHeld = false;
        try {
          const page = await context.newPage();
          cleanupPage = page;
          const nativeMouse = await context.newCDPSession(page);
          cleanupMouse = nativeMouse;
          page.on("pageerror", (error) => errors.push(error.message));
          await applyScenarioBackend(page, scenario);
          await applyDimension(page, base, DEFAULT_DIMENSION);
          let held = 0;
          await page.route(
            new RegExp(`/api/(?:langgraph/)?threads/${threadId}(?:[/?]|$)`),
            async (route) => {
              held += 1;
              await gate;
              if (!page.isClosed()) await route.fallback();
            },
          );
          await page.goto(`${base}${scenario.path}`);
          await expect.poll(() => held).toBeGreaterThan(0);
          await observeNativeInput(page);
          phase = "release-initial-history";
          release();
          const viewport = page.locator(
            '[data-testid="main-message-list"] > div',
          );
          await viewport.waitFor({ state: "visible" });
          await page.waitForFunction(nativeTextPoint, undefined, {
            polling: "raf",
          });
          // Re-read using the same CDP connection immediately before input.
          // A Playwright snapshot between measuring and pressing can take
          // several animation frames. This expression only reads DOM geometry.
          const point = await nativeMouse.send("Runtime.evaluate", {
            expression: `(${nativeTextPoint.toString()})()`,
            returnByValue: true,
          });
          const geometry: unknown = point.result.value;
          if (!isTextPoint(geometry))
            throw new Error(
              "No current visible native text during initial motion",
            );
          observations.push({ phase, geometry });
          phase = "native-reading-input";
          // Playwright's mouse backend uses this same native Chromium input.
          // Sending the sequence directly avoids trace snapshots between events
          // making a moving paragraph's previously observed coordinates stale.
          if (input === "selection") {
            await nativeMouse.send("Input.dispatchMouseEvent", {
              type: "mouseMoved",
              x: geometry.x,
              y: geometry.y,
              button: "none",
              buttons: 0,
            });
            await nativeMouse.send("Input.dispatchMouseEvent", {
              type: "mousePressed",
              x: geometry.x,
              y: geometry.y,
              button: "left",
              buttons: 1,
              clickCount: 1,
            });
            mouseHeld = true;
          }
          if (input === "selection") {
            // A native mouse-down establishes the browser's selection anchor.
            // Locate the drag endpoint in the now-held content, rather than
            // reusing pre-press text coordinates while the initial view moved.
            const endpointResult = await nativeMouse.send("Runtime.evaluate", {
              expression: `(${nativeTextPoint.toString()})()`,
              returnByValue: true,
            });
            const endpoint: unknown = endpointResult.result.value;
            if (!isTextPoint(endpoint))
              throw new Error("No visible text for the held native drag");
            observations.push({ endpoint });
            await nativeMouse.send("Input.dispatchMouseEvent", {
              type: "mouseMoved",
              x: endpoint.endX,
              y: endpoint.y,
              button: "left",
              buttons: 1,
            });
            await expect
              .poll(() =>
                page.evaluate(() => {
                  const selection = window.getSelection();
                  const common = selection?.rangeCount
                    ? selection.getRangeAt(0).commonAncestorContainer
                    : null;
                  const viewport = document.querySelector(
                    '[data-testid="main-message-list"] > div',
                  );
                  return common && viewport?.contains(common)
                    ? selection!.toString().length
                    : 0;
                }),
              )
              .toBeGreaterThan(0);
            const heldTop = await viewport.evaluate(
              (element) => element.scrollTop,
            );
            await page.waitForTimeout(160);
            const afterHold = await viewport.evaluate(
              (element) => element.scrollTop,
            );
            observations.push({
              heldTop,
              afterHold,
              selection: await page.evaluate(() =>
                window.getSelection()?.toString(),
              ),
            });
            expect(Math.abs(afterHold - heldTop)).toBeLessThanOrEqual(1);
            await nativeMouse.send("Input.dispatchMouseEvent", {
              type: "mouseReleased",
              x: endpoint.endX,
              y: endpoint.y,
              button: "left",
              buttons: 0,
              clickCount: 1,
            });
            mouseHeld = false;
            await expect
              .poll(() => viewport.evaluate((element) => element.scrollTop))
              .toBeGreaterThan(heldTop + 1);
            await expect
              .poll(() =>
                viewport.evaluate(
                  (element) =>
                    element.scrollHeight -
                    element.clientHeight -
                    element.scrollTop,
                ),
              )
              .toBeLessThanOrEqual(2);
          } else {
            if (input === "wheel-and-keyboard") {
              await page.mouse.move(geometry.x, geometry.y);
              await page.mouse.wheel(0, -300);
              const reading = await viewport.evaluate(
                (element) => element.scrollTop,
              );
              await page.waitForTimeout(250);
              const afterWheel = await viewport.evaluate(
                (element) => element.scrollTop,
              );
              observations.push({ reading, afterWheel });
              expect(afterWheel).toBeLessThanOrEqual(reading + 1);
              expect(
                await viewport.evaluate(
                  (element) =>
                    element.scrollHeight -
                    element.clientHeight -
                    element.scrollTop,
                ),
              ).toBeGreaterThan(100);
            } else {
              const movement = await viewport.evaluate(async (element) => {
                const first = element.scrollTop;
                await new Promise<void>((resolve) =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                  ),
                );
                return { first, last: element.scrollTop };
              });
              observations.push({ movement });
              expect(movement.last).toBeGreaterThan(movement.first);
            }
            // Establish the real inner keyboard target, not the outer layout
            // scroller that receives focus after clicking un-focusable text.
            // Focus itself may stop following; this is a focus+keyboard contract,
            // not evidence that PageUp alone stopped a still-running animation.
            const copies = page
              .getByTestId("main-message-list")
              .getByRole("button", { name: "Copy to clipboard", exact: true });
            const index = await copies.evaluateAll((buttons) => {
              const viewport = document.querySelector<HTMLElement>(
                '[data-testid="main-message-list"] > div',
              )!;
              const bounds = viewport.getBoundingClientRect();
              return (
                buttons
                  .map((button, index) => ({
                    index,
                    box: button.getBoundingClientRect(),
                  }))
                  .filter(
                    ({ box }) =>
                      box.top >= bounds.top && box.bottom <= bounds.bottom,
                  )
                  .sort(
                    (a, b) =>
                      Math.abs(a.box.top - (bounds.top + bounds.bottom) / 2) -
                      Math.abs(b.box.top - (bounds.top + bounds.bottom) / 2),
                  )[0]?.index ?? -1
              );
            });
            expect(
              index,
              "a current inner Copy control is fully visible",
            ).toBeGreaterThanOrEqual(0);
            const copy = copies.nth(index);
            await copy.focus();
            await expect(copy).toBeFocused();
            const beforeKey = await viewport.evaluate(
              (element) => element.scrollTop,
            );
            expect(beforeKey, "PageUp must have space to move").toBeGreaterThan(
              300,
            );
            await page.keyboard.press("PageUp");
            await expect
              .poll(() => viewport.evaluate((element) => element.scrollTop))
              .toBeLessThan(beforeKey - 20);
            // Let the browser's own key-scroll finish, then prove no tail chase.
            const settled = await viewport.evaluate(
              (element, baseline) =>
                new Promise<{ top: number; frames: number }>(
                  (resolve, reject) => {
                    let previous = element.scrollTop;
                    let stable = 0;
                    let frames = 0;
                    const sample = () => {
                      const current = element.scrollTop;
                      stable =
                        Math.abs(current - previous) <= 1 &&
                        current < baseline - 20
                          ? stable + 1
                          : 0;
                      previous = current;
                      frames += 1;
                      if (stable >= 12) resolve({ top: current, frames });
                      else if (frames >= 180)
                        reject(
                          new Error(
                            "Native PageUp never reached a stable reading position",
                          ),
                        );
                      else requestAnimationFrame(sample);
                    };
                    requestAnimationFrame(sample);
                  },
                ),
              beforeKey,
            );
            observations.push({ settled });
            const afterKey = await viewport.evaluate(
              (element) => element.scrollTop,
            );
            await page.waitForTimeout(200);
            const afterReading = await viewport.evaluate(
              (element) => element.scrollTop,
            );
            observations.push({ beforeKey, afterKey, afterReading });
            expect(Math.abs(afterReading - afterKey)).toBeLessThanOrEqual(1);
            expect(afterReading).toBeLessThan(beforeKey - 20);
          }
          const native = await page.evaluate(
            () => (window as ObservedWindow).nativeReading ?? [],
          );
          const frames = native.filter(
            (item) => item.kind === "frame" && typeof item.top === "number",
          );
          expect(
            frames.some(
              (item, index) =>
                index > 0 &&
                (item.top as number) > (frames[index - 1]!.top as number),
            ),
          ).toBe(true);
          if (input === "selection") {
            expect(
              native.some(
                (item) =>
                  item.kind === "mousedown" &&
                  item.trusted === true &&
                  item.keyInside === true,
              ),
            ).toBe(true);
            expect(
              native.some(
                (item) =>
                  item.selectionInside === true &&
                  typeof item.selection === "string" &&
                  item.selection.length > 0,
              ),
            ).toBe(true);
          } else {
            expect(
              native.some(
                (item) =>
                  item.kind === "keydown" &&
                  item.key === "PageUp" &&
                  item.trusted === true &&
                  item.keyInside === true,
              ),
            ).toBe(true);
          }
          expect(errors).toEqual([]);
          phase = "verified";
        } catch (error) {
          failure = String(error);
          primaryError = error;
          hasPrimaryError = true;
        } finally {
          release();
          const cleanup = async (
            name: string,
            operation: () => Promise<unknown>,
          ) => {
            try {
              await operation();
            } catch (error) {
              cleanupFailure ??= error;
              info.annotations.push({ type: name, description: String(error) });
            }
          };
          await cleanup("mouse-release-error", async () => {
            if (mouseHeld && cleanupMouse)
              await cleanupMouse.send("Input.dispatchMouseEvent", {
                type: "mouseReleased",
                x: 500,
                y: 300,
                button: "left",
                buttons: 0,
                clickCount: 1,
              });
          });
          await cleanup("native-detach-error", async () =>
            cleanupMouse?.detach(),
          );
          await cleanup("observation-read-error", async () => {
            if (cleanupPage)
              observations.push({
                native: await cleanupPage.evaluate(
                  () => (window as ObservedWindow).nativeReading,
                ),
                final: await cleanupPage.evaluate(() => {
                  const viewport = document.querySelector<HTMLElement>(
                    '[data-testid="main-message-list"] > div',
                  );
                  return {
                    top: viewport?.scrollTop,
                    range: viewport
                      ? viewport.scrollHeight - viewport.clientHeight
                      : null,
                    active: document.activeElement?.outerHTML.slice(0, 500),
                    selection: window.getSelection()?.toString().slice(0, 160),
                  };
                }),
              });
          });
          await cleanup("observation-attach-error", async () =>
            info.attach(`${app}-${input}-${reducedMotion}-reading`, {
              body: JSON.stringify(
                {
                  app,
                  reducedMotion,
                  input,
                  phase,
                  failure,
                  observations,
                  errors,
                  cleanupErrors: info.annotations,
                },
                null,
                2,
              ),
              contentType: "application/json",
            }),
          );
          await cleanup("context-close-error", () => context.close());
        }
        if (hasPrimaryError) throw primaryError;
        if (cleanupFailure) throw cleanupFailure;
      });
    }
  }
}
