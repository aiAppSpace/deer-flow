/*
  【文件职责】     表格产物预览在**真 Worker**上的三条行为：正常 1MiB、极宽引号记录、
                   离开病态解析再开下一个。
  【架构位置】     e2e（mock 后端）
  【依赖关系】     ./utils/mock-api · app/components/workspace/artifacts/ArtifactTablePreview.vue
  【边界与注意】   **镜像上游 `frontend/tests/e2e/artifact-table-performance.spec.ts`**，
                   照 reduced-motion 的先例：这份 spec 天生不进对照工厂
                   （它量的是时延与长任务，而对照工厂的坐标系是 aria 树 / 几何 / 请求），
                   所以两侧各带一份，两边都有机器在守。理由记在
                   baseline/parity-scenario-coverage.json 的 `$pendingReasons`。

                   **不断言任何硬件相关的阈值**——与上游同一条纪律：时延、长任务、
                   心跳间隔只**报告**（attach 进 test-results），断言的是行为：
                   表格出得来、翻得动页、跑解析时主线程仍然响应、
                   离开一次病态解析之后 Worker 被关掉且下一个文件还能开。

                   为什么这三条值得守：本仓的预览是**自己写的 PreviewRun 令牌 +
                   每次运行独占一个 Worker**（app/composables/useDelimitedPreview.ts）。
                   第三条正是那套设计的判据——令牌换了之后旧 Worker 必须终止，
                   否则一次病态解析会把后续每一个预览都拖住。单测拦不到它：
                   Worker 在 jsdom 里根本不存在。
*/

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

const THREAD_ID = "00000000-0000-0000-0000-000000003141";
const FILEPATH = "/mnt/user-data/outputs/performance.csv";
const REPLACEMENT_FILEPATH = "/mnt/user-data/outputs/replacement.csv";

/** 约 1 MiB 的普通 CSV：12000 行，每行 80 个字符的备注。 */
const NORMAL_CSV =
  "ID,Note\n" +
  Array.from(
    { length: 12_000 },
    (_, index) => `${index},${"x".repeat(80)}\n`,
  ).join("");

/*
  一条**极宽的引号记录**：349000 个空引号字段。papaparse 在这种形状上会退化，
  正是「解析必须在 Worker 里，不能占着主线程」那条设计要挡的输入。
*/
const WIDE_QUOTED_CSV = '"",'.repeat(349_000) + '""\n';

type Metrics = {
  started: number;
  firstTable: number | null;
  beats: number;
  maxHeartbeatGap: number;
  longTasks: number[];
};

type MeasuredWindow = Window & { __csvMetrics: Metrics };

function viewerURL(filepath = FILEPATH) {
  return `/artifacts/view?path=${encodeURIComponent(filepath)}&thread_id=${THREAD_ID}`;
}

async function setup(page: Page, body: string) {
  mockLangGraphAPI(page);
  await page
    .context()
    .route(`**/api/threads/${THREAD_ID}/artifacts/**`, async (route) => {
      /*
        计时**从视窗真的去要内容那一刻开始**，不含页面导航——这样报出来的数字
        才是「冷 Worker + 表格分片」的代价，而不是掺着 Nuxt 的首屏。
      */
      await page.evaluate(() => {
        const measured = window as unknown as MeasuredWindow;
        const metrics: Metrics = {
          started: performance.now(),
          firstTable: null,
          beats: 0,
          maxHeartbeatGap: 0,
          longTasks: [],
        };
        measured.__csvMetrics = metrics;
        let previous = metrics.started;
        // 16ms 心跳：主线程被占住时它跳不动，`maxHeartbeatGap` 会张开。
        const timer = setInterval(() => {
          const now = performance.now();
          if (metrics.firstTable !== null) return;
          metrics.beats += 1;
          metrics.maxHeartbeatGap = Math.max(
            metrics.maxHeartbeatGap,
            now - previous,
          );
          previous = now;
        }, 16);
        const observer = new MutationObserver(() => {
          if (
            document.querySelector(
              '[data-testid="artifact-table-preview"] table',
            )
          ) {
            metrics.firstTable ??= performance.now();
            observer.disconnect();
          }
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
        const longTasks = new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries()) {
            if (
              entry.startTime >= metrics.started &&
              (metrics.firstTable === null ||
                entry.startTime <= metrics.firstTable)
            ) {
              metrics.longTasks.push(entry.duration);
            }
          }
        });
        longTasks.observe({ type: "longtask", buffered: false });
        window.addEventListener(
          "pagehide",
          () => {
            clearInterval(timer);
            observer.disconnect();
            longTasks.disconnect();
          },
          { once: true },
        );
      });
      await route.fulfill({ status: 200, contentType: "text/csv", body });
    });
}

async function report(page: Page, name: string, bytes: number) {
  const metrics = await page.evaluate(
    () => (window as unknown as MeasuredWindow).__csvMetrics,
  );
  const payload = {
    sample: name,
    bytes,
    firstTableMs:
      metrics.firstTable === null ? null : metrics.firstTable - metrics.started,
    heartbeatCount: metrics.beats,
    maxHeartbeatGapMs: metrics.maxHeartbeatGap,
    longTaskCount: metrics.longTasks.length,
    longTaskDurationsMs: metrics.longTasks,
  };
  // 只报告，不断言——机器不同数字就不同，钉死它等于钉死这台机器。
  console.log("CSV browser performance", JSON.stringify(payload));
  await test.info().attach(`${name}-performance`, {
    body: JSON.stringify(payload, null, 2),
    contentType: "application/json",
  });
  return payload;
}

test("冷 Worker 跑一份约 1 MiB 的普通 CSV，表格出得来也翻得动页", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await setup(page, NORMAL_CSV);
  await page.goto(viewerURL());

  await expect(page.getByRole("table")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("Preview of first 200 rows", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "0", exact: true }),
  ).toBeVisible();
  // 表头 + 50 行 = 51 个 row。
  await expect(page.getByRole("row")).toHaveCount(51);

  const metrics = await report(
    page,
    "normal-1mib",
    Buffer.byteLength(NORMAL_CSV),
  );
  expect(metrics.firstTableMs).not.toBeNull();

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(/^51–100/)).toBeVisible();
});

test("解析极宽引号记录时主线程仍然响应", async ({ page }) => {
  test.setTimeout(60_000);
  await setup(page, WIDE_QUOTED_CSV);
  const workerStarted = page.waitForEvent("worker");
  await page.goto(viewerURL());
  await workerStarted;

  /*
    造一个**与产品无关**的按钮来当探针：它证明的是「主线程还能处理一次真实的
    DOM 交互」，而不是「某个产品控件恰好还能点」——后者可能因为别的原因不可用。
  */
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.textContent = "Responsiveness probe";
    button.onclick = () => {
      button.textContent = "Probe acknowledged";
    };
    document.body.prepend(button);
  });
  await page.getByRole("button", { name: "Responsiveness probe" }).click();
  await expect(
    page.getByRole("button", { name: "Probe acknowledged" }),
  ).toBeVisible();

  // 心跳还在跳 = 主线程没有被解析占死。
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as unknown as MeasuredWindow).__csvMetrics.beats,
      ),
    )
    .toBeGreaterThan(2);

  // 最终要么给出表格，要么明说「这份表可靠地预览不了」——不许一直转。
  await expect(
    page
      .getByRole("table")
      .or(page.getByText(/Unable to preview this table reliably/)),
  ).toBeVisible({ timeout: 15_000 });

  await report(page, "wide-quoted-1mib", Buffer.byteLength(WIDE_QUOTED_CSV));
});

test("离开一次病态解析之后，Worker 被关掉，下一个文件照常打开", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await setup(page, WIDE_QUOTED_CSV);
  const workerStarted = page.waitForEvent("worker");
  await page.goto(viewerURL());
  const worker = await workerStarted;
  let closed = false;
  worker.on("close", () => {
    closed = true;
  });

  await page
    .context()
    .route(
      `**/api/threads/${THREAD_ID}/artifacts/**/replacement.csv`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/csv",
          body: "ID,Note\nreplacement,ready\n",
        }),
    );
  await page.goto(viewerURL(REPLACEMENT_FILEPATH));

  await expect(
    page.getByRole("cell", { name: "replacement", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  // 旧 Worker 必须真的被终止；不然一次病态解析会把后面每一个预览都拖住。
  await expect.poll(() => closed).toBe(true);
});
