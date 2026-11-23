/*
  【文件职责】     测量真实首屏 JS 下载，并守住双语言、推测预取与渲染器边界。
  【架构位置】     E2E 产品合同（仅 Gateway API 使用 fixture）
  【主要导出】     Playwright cases
  【依赖关系】     baseline/route-payload-budget.json · .output/public/_nuxt
  【边界与注意】   raw/Brotli 来自浏览器实际请求过的去重产物文件，不是网络 wire bytes。
                   CDP initialPriority 只描述调度，不能证明应用是否需要模块。
                   当前产品禁止初始 HTML JS hints，NuxtLink 仅按 hover/focus 预取；
                   测试同时守住这些行为，首屏实际全集才对应当前应用依赖闭包。
                   全量 asset-budget 和此处的实际路由下载预算分别检查。
*/

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";
import { enUS } from "../../app/core/i18n/locales/en-US";
import { zhCN } from "../../app/core/i18n/locales/zh-CN";

const dictionaries = { "en-US": enUS, "zh-CN": zhCN };
type Locale = keyof typeof dictionaries;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ASSETS = join(ROOT, ".output/public/_nuxt");

type Group = { files: number; raw: number; brotli: number };
const budgets = JSON.parse(
  readFileSync(join(ROOT, "baseline/route-payload-budget.json"), "utf8"),
) as {
  routes: Record<string, { critical: Group; prefetch: Group }>;
  criticalPathForbidden: string[];
};

function sizeOnDisk(file: string) {
  const raw = readFileSync(join(ASSETS, file)).byteLength;
  let brotli = raw;
  try {
    brotli = readFileSync(join(ASSETS, `${file}.br`)).byteLength;
  } catch {
    // 小文件 Nuxt 不预压缩；用 raw 计，宁可高估也不漏计。
  }
  return { raw, brotli };
}

function total(files: string[]) {
  let raw = 0;
  let brotli = 0;
  for (const file of files) {
    const size = sizeOnDisk(file);
    raw += size.raw;
    brotli += size.brotli;
  }
  return { files: files.length, raw, brotli };
}

type Measured = {
  critical: string[];
  prefetch: string[];
  all: string[];
  htmlJsPrefetch: number;
  pageErrors: string[];
};

async function observeScripts(page: Page) {
  const priority = new Map<string, string>();
  const pageErrors: string[] = [];
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", onPageError);
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  session.on("Network.requestWillBeSent", (event) => {
    const url = new URL(event.request.url);
    if (!url.pathname.endsWith(".js") || !url.pathname.includes("/_nuxt/"))
      return;
    const file = url.pathname.split("/").pop()!;
    if (!priority.has(file)) priority.set(file, event.request.initialPriority);
  });
  return {
    files: () => [...priority.keys()],
    pageErrors,
    snapshot() {
      const critical: string[] = [];
      const prefetch: string[] = [];
      for (const [file, initialPriority] of priority) {
        // Scheduling evidence only. The separate structural assertions below
        // prohibit speculative downloads before user interaction.
        (initialPriority === "VeryLow" ? prefetch : critical).push(file);
      }
      return { critical, prefetch, all: [...priority.keys()] };
    },
    async stop() {
      page.off("pageerror", onPageError);
      await session.detach();
    },
  };
}

async function htmlJsPrefetch(page: Page, html: string) {
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, "text/html");
    return [...doc.querySelectorAll('link[rel="prefetch"]')].filter((link) =>
      /\.js(?:$|[?#])/.test(link.getAttribute("href") ?? ""),
    ).length;
  }, html);
}

async function measure(
  page: Page,
  path: string,
  whenRendered?: () => Promise<void>,
): Promise<Measured> {
  const observed = await observeScripts(page);
  try {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response).not.toBeNull();
    await page.waitForLoadState("networkidle");
    if (whenRendered) await whenRendered();
    return {
      ...observed.snapshot(),
      htmlJsPrefetch: await htmlJsPrefetch(page, await response!.text()),
      pageErrors: observed.pageErrors,
    };
  } finally {
    await observed.stop();
  }
}

function assetContaining(markers: string[]) {
  // Resolve real output ownership without relying on vendor labels or hashes.
  // The markers are complete dictionary strings / the workspace root template.
  const files = readdirSync(ASSETS).filter((file) => {
    if (!file.endsWith(".js")) return false;
    const source = readFileSync(join(ASSETS, file), "utf8");
    return markers.every((marker) => source.includes(marker));
  });
  expect(files, `one actual JS owner for ${markers[0]}`).toHaveLength(1);
  return files[0]!;
}

function localeFile(locale: Locale) {
  const dictionary = dictionaries[locale];
  return assetContaining([
    dictionary.projects.attachDialogHint,
    dictionary.projects.archivedDocumentsBanner,
  ]);
}

function workspaceLayoutFile() {
  return assetContaining([
    "bg-background text-foreground flex h-screen overflow-hidden",
  ]);
}

async function setLocaleCookie(
  page: Page,
  locale: Locale,
  baseURL: string | undefined,
) {
  expect(baseURL).toBeTruthy();
  await page
    .context()
    .addCookies([{ name: "locale", value: locale, url: baseURL! }]);
}

function expectOnlySelectedLocale(files: string[], locale: Locale) {
  const other = locale === "en-US" ? "zh-CN" : "en-US";
  expect(files).toContain(localeFile(locale));
  expect(files).not.toContain(localeFile(other));
}

function expectNoSpeculativeInitialScripts(measured: Measured) {
  expect(measured.htmlJsPrefetch).toBe(0);
  expect(measured.prefetch).toEqual([]);
  expect(measured.pageErrors).toEqual([]);
}

function seedThread(page: Page, content: string) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Route payload",
        messages: [
          { type: "human", id: "h", content: "hi" },
          { type: "ai", id: "a", content },
        ],
      },
    ],
  });
}

const PLAIN = "A plain sentence with no code, math or diagram.";

test.describe("route payload", () => {
  for (const locale of ["en-US", "zh-CN"] as const) {
    for (const [route, budget] of Object.entries(budgets.routes)) {
      test(`${route} ${locale} stays inside its initial payload budget`, async ({
        page,
        baseURL,
      }, testInfo) => {
        seedThread(page, PLAIN);
        await setLocaleCookie(page, locale, baseURL);
        /*
        `/login` 的预算量的是**匿名访客**下载了什么。共享 mock 默认把
        `/api/v1/auth/me` 喂成已登录，而登录页现在照上游那样「已有 session 就跳回
        工作区」——那样量到的是工作区的载荷，挂在 /login 的名下（实测 728 KB，
        与工作区 718 KB 几乎相等，就是这么发现的）。这里覆盖成 401。
      */
        if (route === "/login") {
          await page.route("**/api/v1/auth/me", (handler) =>
            handler.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
          );
        }
        const measured = await measure(page, route);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        expectNoSpeculativeInitialScripts(measured);
        expectOnlySelectedLocale(measured.all, locale);
        if (route === "/") {
          await expect(page.getByTestId("landing-workspace-cta")).toHaveText(
            dictionaries[locale].marketing.enterWorkspace,
          );
          expect(measured.all).not.toContain(workspaceLayoutFile());
        } else if (route === "/login") {
          await expect(page.locator('input[type="password"]')).toBeVisible();
          expect(measured.all).not.toContain(workspaceLayoutFile());
        } else {
          await expect(
            page.getByPlaceholder(dictionaries[locale].inputBox.placeholder),
          ).toBeVisible();
          expect(measured.all).toContain(workspaceLayoutFile());
        }
        const actual = {
          critical: total(measured.critical),
          prefetch: total(measured.prefetch),
          all: total(measured.all),
        };
        await testInfo.attach("route-payload.json", {
          body: JSON.stringify(
            { route, locale, actual, files: measured },
            null,
            2,
          ),
          contentType: "application/json",
        });
        // 始终打印实测值：调预算的人应该看到数字，而不是靠失败信息倒推。
        for (const group of ["critical", "prefetch"] as const) {
          const it = actual[group];
          console.log(
            `PAYLOAD ${route.padEnd(24)} ${locale} ${group.padEnd(8)} ` +
              `${String(it.files).padStart(3)} files  ` +
              `raw ${String(it.raw).padStart(8)}  brotli ${String(it.brotli).padStart(7)}`,
          );
        }

        const within = (a: Group, b: Group) => ({
          files: a.files <= b.files,
          raw: a.raw <= b.raw,
          brotli: a.brotli <= b.brotli,
        });
        const pass = { files: true, raw: true, brotli: true };
        expect(
          {
            route,
            critical: within(actual.critical, budget.critical),
            prefetch: within(actual.prefetch, budget.prefetch),
          },
          `measured critical ${actual.critical.files} files / ${actual.critical.raw} raw / ` +
            `${actual.critical.brotli} brotli (budget ${budget.critical.files} / ` +
            `${budget.critical.raw} / ${budget.critical.brotli}); ` +
            `prefetch ${actual.prefetch.files} files / ${actual.prefetch.raw} raw / ` +
            `${actual.prefetch.brotli} brotli (budget ${budget.prefetch.files} / ` +
            `${budget.prefetch.raw} / ${budget.prefetch.brotli})`,
        ).toEqual({ route, critical: pass, prefetch: pass });
      });
    }
  }

  test("keeps heavyweight renderers out of the critical path", async ({
    page,
  }) => {
    seedThread(page, PLAIN);
    const measured = await measure(page, `/workspace/chats/${MOCK_THREAD_ID}`);
    expectNoSpeculativeInitialScripts(measured);

    /*
      纯文本会话不该为代码高亮、图表或公式排版付费。这三个库分别是
      848 KB / 1.42 MB / 264 KB 量级，同步进首屏一个就抵得上整个 UI 层。
      检查覆盖 prefetch：投机下载也是用户付的流量。
    */
    const offenders: string[] = [];
    for (const file of measured.all) {
      const source = readFileSync(join(ASSETS, file), "utf8");
      for (const marker of budgets.criticalPathForbidden) {
        if (source.includes(marker)) offenders.push(`${file}: ${marker}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("loads the heavyweights only when the content needs them", async ({
    page,
  }) => {
    seedThread(page, "```mermaid\ngraph TD;\nA-->B;\n```\n");
    const withDiagram = await measure(
      page,
      `/workspace/chats/${MOCK_THREAD_ID}`,
      // Mermaid starts after visibility, debounce and idle scheduling. Keep CDP
      // attached until the actual chart exists; navigation icons are also SVGs.
      () => expect(page.getByLabel("Mermaid chart")).toBeVisible(),
    );
    await expect(page.locator("[data-mermaid-diagram], svg")).not.toHaveCount(
      0,
    );

    // Positive proof of the same forbidden library markers: content must cause
    // actual renderer downloads, rather than merely changing a filename/size.
    const sources = withDiagram.all.map((file) =>
      readFileSync(join(ASSETS, file), "utf8"),
    );
    expect(sources.some((source) => source.includes("sequenceDiagram"))).toBe(
      true,
    );
    expect(withDiagram.pageErrors).toEqual([]);
    const plainBudget =
      budgets.routes[`/workspace/chats/${MOCK_THREAD_ID}`] ??
      budgets.routes["/workspace/chats/new"]!;
    expect(total(withDiagram.critical).raw).toBeGreaterThan(
      plainBudget.critical.raw,
    );
  });

  for (const locale of ["en-US", "zh-CN"] as const) {
    for (const action of ["hover", "focus"] as const) {
      test(`${locale} ${action} preloads workspace on intent and click navigates`, async ({
        page,
        baseURL,
      }, testInfo) => {
        seedThread(page, PLAIN);
        await setLocaleCookie(page, locale, baseURL);
        const observed = await observeScripts(page);
        try {
          const response = await page.goto("/", { waitUntil: "networkidle" });
          expect(response).not.toBeNull();
          const link = page.getByTestId("landing-workspace-cta");
          await expect(link).toHaveText(
            dictionaries[locale].marketing.enterWorkspace,
          );
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          const workspaceFile = workspaceLayoutFile();
          const initial = observed.snapshot();
          expect(initial.all).not.toContain(workspaceFile);
          expect(initial.prefetch).toEqual([]);
          expectOnlySelectedLocale(initial.all, locale);
          expect(await htmlJsPrefetch(page, await response!.text())).toBe(0);

          await link[action]();
          await expect.poll(() => observed.files()).toContain(workspaceFile);
          await expect(page).toHaveURL(new URL("/", baseURL!).toString());
          const preloaded = observed.files();
          await link.click();
          await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
          await expect(
            page.getByPlaceholder(dictionaries[locale].inputBox.placeholder),
          ).toBeVisible();
          await page.waitForLoadState("networkidle");
          expectOnlySelectedLocale(observed.files(), locale);
          expect(observed.pageErrors).toEqual([]);
          await testInfo.attach("route-interaction-payload.json", {
            body: JSON.stringify(
              {
                locale,
                action,
                workspaceFile,
                initial,
                preloaded,
                final: observed.files(),
              },
              null,
              2,
            ),
            contentType: "application/json",
          });
        } finally {
          await observed.stop();
        }
      });
    }
  }
});
