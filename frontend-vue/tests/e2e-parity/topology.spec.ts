/*
  【文件职责】     证明对照拓扑成立：两个应用跑起来了，走各自的同源代理，看到同一个 Gateway。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/react-preview.ts · support/fixture-thread.ts
  【边界与注意】   这里**不做**差异比对——那是后面几层的事。这份用例只回答一个问题：
                   「后面比出来的差异，能不能被解释成两边数据不同或环境不同？」
                   如果它红了，任何跨应用比对的结论都不成立，先修这里。
*/

import { expect, test, type Page } from "./support/test";

import {
  FIRST_MARKER,
  FIXTURE_THREAD_ID,
  SECOND_MARKER,
  seedFixtureThread,
} from "./support/fixture-thread";
import { reactAppPresent } from "./support/react-preview";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";
const GATEWAY = process.env.E2E_GATEWAY_URL ?? "http://127.0.0.1:8021";

const threadPath = `/workspace/chats/${FIXTURE_THREAD_ID}`;
const batchesPath = `/api/threads/${FIXTURE_THREAD_ID}/subagent-batches`;

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  const seeded = await seedFixtureThread(request, GATEWAY);
  expect(seeded.status(), await seeded.text()).toBe(200);
  const features = await request.get(`${GATEWAY}/api/features`);
  expect(features.status(), await features.text()).toBe(200);
  await expect(features.json()).resolves.toMatchObject({
    subagent_batches: { repository_available: true, worker_running: false },
  });
});

/** 等到线程内容真的渲染出来，再取样。 */
async function openFixtureThread(page: Page, base: string) {
  // Message text and the independently loaded batch list have different owners.
  // Observe this navigation's actual response before asserting its empty UI.
  const batches = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === new URL(base).origin &&
      url.pathname === batchesPath &&
      response.request().method() === "GET"
    );
  });
  const [, response] = await Promise.all([
    page.goto(`${base}${threadPath}`),
    batches,
  ]);
  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual([]);
  await expect(page.getByTestId("subagent-batches-trigger")).toHaveCount(0);
  await expect(
    page.getByText(FIRST_MARKER, { exact: false }).first(),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText(SECOND_MARKER, { exact: false }).first(),
  ).toBeVisible();
}

test("both apps proxy to the same gateway", async ({ request }) => {
  /*
    判据不是「两边都答了 200」——两个各自独立的 Gateway 也会都答 200。判据是
    两边都能看见**只在这一个 Gateway 上种过**的那条线程，而且内容逐字相同。
    种子只发给了 Gateway 一次；如果两个应用的代理指向不同进程，其中一个必然空。
  */
  const [viaVue, viaReact] = await Promise.all([
    request.get(`${VUE_APP}/api/threads/${FIXTURE_THREAD_ID}/messages`),
    request.get(`${REACT_APP}/api/threads/${FIXTURE_THREAD_ID}/messages`),
  ]);

  expect(viaVue.status(), await viaVue.text()).toBe(200);
  expect(viaReact.status(), await viaReact.text()).toBe(200);

  const textOf = (payload: unknown) =>
    (payload as { content?: { content?: string } }[]).map(
      (event) => event.content?.content ?? "",
    );

  const vueText = textOf(await viaVue.json());
  const reactText = textOf(await viaReact.json());

  expect(vueText).toEqual([
    FIRST_MARKER,
    `${FIRST_MARKER} reply`,
    SECOND_MARKER,
    `${SECOND_MARKER} reply`,
  ]);
  expect(reactText).toEqual(vueText);
});

test("both apps agree on who the user is", async ({ request }) => {
  // auth 模式不一致的话，两边看到的是不同用户的不同数据，之后每一层都会比出
  // 一堆与实现无关的假差异。
  const [vue, react] = await Promise.all([
    request.get(`${VUE_APP}/api/v1/auth/me`),
    request.get(`${REACT_APP}/api/v1/auth/me`),
  ]);

  expect(vue.status(), await vue.text()).toBe(200);
  expect(react.status(), await react.text()).toBe(200);
  await expect(react.json()).resolves.toEqual(await vue.json());
});

test("both apps render the seeded thread", async ({ page }) => {
  await openFixtureThread(page, VUE_APP);
  await openFixtureThread(page, REACT_APP);
});

/*
  取样必须先对自己稳定，才谈得上和另一个应用比。同一个应用、同一个场景、两次
  独立加载，如果渲染出的可访问性树都不一样，那么跨应用的任何差异都无法归因。

  这条用例是**度量**，不是装饰：它把「夹具里有哪些东西会飘」变成一份具体清单，
  而归一化规则只应该照着这份清单写——凭想象写归一化，等于允许真差异被顺手抹掉。
*/
for (const [name, base] of [
  ["vue", VUE_APP],
  ["react", REACT_APP],
] as const) {
  test(`${name} renders the same accessibility tree on two loads`, async ({
    page,
  }) => {
    // Hold only the real first batch response until message content is visible.
    // A text-only readiness check must fail here, without a timing-based sleep.
    const matchesBatches = (url: URL) =>
      url.origin === new URL(base).origin && url.pathname === batchesPath;
    let releaseResponse!: () => void;
    const released = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route(
      matchesBatches,
      async (route) => {
        const response = await route.fetch();
        await released;
        await route.fulfill({ response });
      },
      { times: 1 },
    );
    let samplingReady = false;
    let loadingError: unknown;
    const firstLoad = openFixtureThread(page, base).then(
      () => {
        samplingReady = true;
      },
      (error: unknown) => {
        loadingError = error;
      },
    );
    try {
      await expect(
        page.getByText(FIRST_MARKER, { exact: false }).first(),
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        page.getByText(SECOND_MARKER, { exact: false }).first(),
      ).toBeVisible();
      await expect(page.getByTestId("subagent-batches-trigger")).toBeVisible();
      expect(
        samplingReady,
        "pending batch data cannot authorize a whole-page sample",
      ).toBe(false);
    } finally {
      releaseResponse();
      await firstLoad;
    }
    // Cleanup always releases the real response; preserve an earlier assertion
    // failure instead of replacing it with a later loading rejection.
    if (loadingError !== undefined) throw loadingError;
    const first = await page.locator("body").ariaSnapshot();

    await page.goto("about:blank");
    await openFixtureThread(page, base);
    const second = await page.locator("body").ariaSnapshot();

    expect(second).toBe(first);
  });
}
