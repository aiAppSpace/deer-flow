import { expect, test, type Page, type Route } from "./support/test";

import { applyScenarioBackend, type ParityScenario } from "./support/scenarios";

const fixture: ParityScenario = {
  id: "delayed-route-lifecycle",
  title: "Delayed route lifecycle",
  backend: "gateway",
  path: "/",
  settle: [],
  routes: [{ pattern: "**/api/delayed", delayMs: 15_000, json: [] }],
};

test("延迟路由在真实页面销毁时取消，不能向已销毁请求继续履行", async ({
  page,
}) => {
  let finish!: () => void;
  let disposedFulfillAttempts = 0;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const observed = new Proxy(page, {
    get(target, key) {
      if (key === "route")
        return async (
          pattern: string,
          handler: (route: Route) => Promise<unknown>,
        ) =>
          target.route(pattern, async (route) => {
            try {
              const observedRoute = new Proxy(route, {
                get(nativeRoute, property) {
                  const value = Reflect.get(nativeRoute, property);
                  if (property === "fulfill")
                    return (...args: Parameters<Route["fulfill"]>) => {
                      if (page.isClosed()) disposedFulfillAttempts += 1;
                      return Reflect.apply(value, nativeRoute, args);
                    };
                  return typeof value === "function"
                    ? value.bind(nativeRoute)
                    : value;
                },
              });
              return await handler(observedRoute);
            } finally {
              finish();
            }
          });
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Page;
  await page.route("http://route-owner.test/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>owned request</title>",
    }),
  );
  await applyScenarioBackend(observed, fixture);
  await page.goto("http://route-owner.test/");
  const started = page.waitForRequest("**/api/delayed");
  await page.evaluate(() => {
    void fetch("/api/delayed");
  });
  await started;
  await page.close();
  await finished;
  expect(disposedFulfillAttempts).toBe(0);
});

test("存活页面的真实延迟响应仍完整等待15秒并保留原响应", async ({ page }) => {
  await page.route("http://route-owner.test/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>live request</title>",
    }),
  );
  await applyScenarioBackend(page, fixture);
  await page.goto("http://route-owner.test/");
  const result = await page.evaluate(async () => {
    const started = performance.now();
    const response = await fetch("/api/delayed");
    return {
      elapsed: performance.now() - started,
      status: response.status,
      body: await response.json(),
    };
  });
  expect(result.elapsed).toBeGreaterThanOrEqual(15_000);
  expect(result.status).toBe(200);
  expect(result.body).toEqual([]);
});
