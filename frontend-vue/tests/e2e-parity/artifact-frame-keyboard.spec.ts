import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

for (const [app, base] of APPS)
  test(`${app}: artifact iframe preserves every real control through repeated native forward and reverse Tab`, async ({
    browser,
  }) => {
    const failures: string[] = [];
    for (const id of ["artifact-preview", "artifact-panel-resize"])
      for (const direction of ["Tab", "Shift+Tab"] as const) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        const unmatched: string[] = [];
        const errors: string[] = [];
        const sequence: unknown[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/api/**", async (route) => {
          unmatched.push(
            `${route.request().method()} ${new URL(route.request().url()).pathname}`,
          );
          await route.abort("blockedbyclient");
        });
        try {
          const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
          await runScenario(
            page,
            base,
            scenario,
            DEFAULT_DIMENSION,
            scenarioStates(scenario)[0]!,
            30_000,
          );
          await page.setViewportSize({ width: 360, height: 360 });
          await page.addStyleTag({ content: "html{font-size:32px!important}" });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const host = page.locator('[data-slot="sheet-content"]');
          await expect(host).toHaveCount(1);
          await expect(host).toBeVisible();
          await expect(host.locator("iframe")).toHaveCount(1);
          const frame = page.frameLocator('[data-slot="sheet-content"] iframe');
          await expect(frame.locator("body")).toBeVisible();
          // The report document owns a native keyboard entry even without inner controls.
          // The iframe remains required on every repeated forward and reverse traversal.
          await expect(frame.locator("body")).toHaveAttribute("tabindex", "0");
          await expect(
            frame.locator(
              "button,a[href],input,select,textarea,body [tabindex]",
            ),
          ).toHaveCount(0);
          const tracking = await host.evaluateHandle((element) => {
            const ids = new WeakMap<Element, number>();
            let nextId = 1;
            const identify = (node: Element) => {
              let identity = ids.get(node);
              if (identity === undefined) {
                identity = nextId++;
                ids.set(node, identity);
              }
              return identity;
            };
            const required = Array.from(
              element.querySelectorAll<HTMLButtonElement | HTMLIFrameElement>(
                "button,iframe",
              ),
            ).filter((node) => {
              const box = node.getBoundingClientRect();
              return (
                node.tabIndex >= 0 &&
                !(node instanceof HTMLButtonElement && node.disabled) &&
                box.width > 0 &&
                box.height > 0 &&
                node.checkVisibility({
                  checkVisibilityCSS: true,
                  checkOpacity: true,
                })
              );
            });
            return {
              host: element,
              identify,
              required: required.map((node) => ({
                node,
                id: identify(node),
                tag: node.tagName,
                label: node.getAttribute("aria-label") ?? node.textContent,
              })),
            };
          });
          const required = await tracking.evaluate((state) =>
            state.required.map(({ id, tag, label }) => ({ id, tag, label })),
          );
          expect(required.filter((node) => node.tag === "IFRAME")).toHaveLength(
            1,
          );
          expect(
            required.filter((node) => node.tag === "BUTTON").length,
          ).toBeGreaterThan(0);
          await host.focus();
          const visits = new Map<number, number>();
          const focusFailures: string[] = [];
          for (let index = 0; index < 40; index += 1) {
            await page.keyboard.press(direction);
            const active = await tracking.evaluate(async (state) => {
              const node = state.host.ownerDocument.activeElement;
              if (!(node instanceof HTMLElement)) return null;
              const intersection = await new Promise<IntersectionObserverEntry>(
                (resolve) => {
                  const observer = new IntersectionObserver((entries) => {
                    observer.disconnect();
                    resolve(entries[0]!);
                  });
                  observer.observe(node);
                },
              );
              const box = node.getBoundingClientRect();
              return {
                id: state.identify(node),
                tag: node.tagName,
                label: node.getAttribute("aria-label") ?? node.textContent,
                inside: state.host.contains(node),
                guard: node.matches(
                  "[data-dialog-focus-sentinel],[data-dialog-focus-guard],[data-radix-focus-guard],[data-reka-focus-guard]",
                ),
                visible: node.checkVisibility({
                  checkVisibilityCSS: true,
                  checkOpacity: true,
                }),
                width: box.width,
                height: box.height,
                intersection: {
                  width: intersection.intersectionRect.width,
                  height: intersection.intersectionRect.height,
                  ratio: intersection.intersectionRatio,
                },
              };
            });
            sequence.push(active);
            try {
              expect(
                active,
                `${id}/${direction}/${index}: actual native focus`,
              ).not.toBeNull();
              expect(active!.inside).toBe(true);
              expect(active!.guard).toBe(false);
              expect(active!.visible).toBe(true);
              expect(active!.width).toBeGreaterThan(0);
              expect(active!.height).toBeGreaterThan(0);
              expect(active!.intersection.width).toBeGreaterThan(0);
              expect(active!.intersection.height).toBeGreaterThan(0);
              expect(active!.tag).not.toBe("BODY");
            } catch (error) {
              focusFailures.push(`${index}: ${String(error)}`);
            }
            if (active) visits.set(active.id, (visits.get(active.id) ?? 0) + 1);
          }
          expect(focusFailures).toEqual([]);
          for (const node of required)
            expect(
              visits.get(node.id) ?? 0,
              `${id}/${direction}: physical ${node.tag} ${node.label} repeatedly reachable`,
            ).toBeGreaterThanOrEqual(2);
          expect(
            await tracking.evaluate((state) =>
              state.required.every(
                ({ node }) => node.isConnected && state.host.contains(node),
              ),
            ),
          ).toBe(true);
          await tracking.dispose();
          expect(errors).toEqual([]);
          expect(unmatched).toEqual([]);
        } catch (error) {
          failures.push(`${id}/${direction}: ${String(error)}`);
        } finally {
          await test.info().attach(`${id}-${direction}-native-focus`, {
            body: JSON.stringify({ sequence, unmatched, errors }, null, 2),
            contentType: "application/json",
          });
          await context.close();
        }
      }
    expect(failures).toEqual([]);
  });
