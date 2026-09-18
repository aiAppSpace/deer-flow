/*
  ⚠ 这不是一条活着的用例，是**探针底稿**。

  用法：拷到 `frontend-vue/tests/e2e-parity/zz-aria-hidden.spec.ts`，跑
      cd frontend-vue && node scripts/with-loopback-no-proxy.mjs -- \
        python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test \
        -c playwright.parity.config.ts zz-aria-hidden.spec.ts
  读完 console 上的 PROBE_ARIA_HIDDEN_* 之后**删掉**。

  它问的不变量：**`aria-hidden="true"` 的子树里不该有可聚焦元素**
  （WCAG 4.1.2 / axe 的 aria-hidden-focus）。读屏器听不到、键盘却能 tab 进去。

  为什么两个应用都跑：Radix 与 reka-ui 对 `inert` 的处理可能不同，
  那会是读屏器/键盘上的真分叉——而这一类台账看不见。

  ⚠ 已经踩过的坑写在代码里了：`inert` 子树要跳过（那是正确写法，不算账），
  `tabindex="-1"` 与 `disabled` 要跳过，祖先链上任何一层 `display:none` /
  `visibility:hidden` 都要跳过。

  ⚠ **第三十九轮我写好了这份底稿但一次都没跑过就删了**——这是那一轮的疏漏，
  也是它现在被放在这里的原因。第一跑若一片红，先怀疑探针（历轮第 4 次判据）。
*/

/* 一次性探针，用完即删。两个应用各跑一遍：aria-hidden 子树里有没有可聚焦元素。 */
import { test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

const CASES = PARITY_SCENARIOS.flatMap((scenario) =>
  scenarioStates(scenario).map((state) => ({
    key: `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`,
    scenario,
    state,
  })),
);

const PROBE = () => {
  const TABBABLE =
    'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]';
  const rendered = (element: Element) => {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const out: string[] = [];
  for (const host of document.querySelectorAll('[aria-hidden="true"]')) {
    if (!rendered(host)) continue;
    if (host.closest("[inert]")) continue;
    const inside = Array.from(host.querySelectorAll(TABBABLE)).filter(
      (element) => {
        if (element.hasAttribute("disabled")) return false;
        if (element.getAttribute("tabindex") === "-1") return false;
        if (element.closest("[inert]")) return false;
        let node: Element | null = element;
        while (node && node !== host) {
          if (!rendered(node)) return false;
          node = node.parentElement;
        }
        return true;
      },
    );
    if (inside.length === 0) continue;
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()}` +
      `${element.getAttribute("data-slot") ? `[${element.getAttribute("data-slot")}]` : ""}` +
      `"${(element.textContent ?? "").trim().slice(0, 18)}"`;
    out.push(
      `${host.tagName.toLowerCase()}` +
        `${host.getAttribute("data-slot") ? `[${host.getAttribute("data-slot")}]` : ""}` +
        `.${(host.className?.toString?.() ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")}` +
        ` ×${inside.length} → ${inside.slice(0, 3).map(describe).join(", ")}`,
    );
  }
  return out.slice(0, 5);
};

for (const [app, base] of APPS) {
  test(`探针（${app}）：aria-hidden 子树里的可聚焦元素`, async ({ browser }) => {
    test.setTimeout(1_800_000);
    const rows: unknown[] = [];
    const failed: string[] = [];
    for (const { key, scenario, state } of CASES) {
      const context = await browser.newContext({ ...PARITY_CONTEXT_OPTIONS });
      const page = await context.newPage();
      try {
        await runScenario(page, base, scenario, DEFAULT_DIMENSION, state, 30_000);
        const found = await page.evaluate(PROBE);
        if (found.length > 0) rows.push({ key, found });
      } catch (error) {
        failed.push(`${key}: ${String(error).split("\n")[0]?.slice(0, 80)}`);
      } finally {
        await context.close();
      }
    }
    console.log(`PROBE_ARIA_HIDDEN_${app} ` + JSON.stringify(rows, null, 1));
    console.log(`PROBE_FAILED_${app} ` + JSON.stringify(failed, null, 1));
  });
}
