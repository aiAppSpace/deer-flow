#!/usr/bin/env node
/*
  【文件职责】     对同一个场景，dump React 与 Vue 的语义 DOM 并比对差异。
  【架构位置】     开发工具（顾问性质，不是门禁）
  【主要导出】     CLI：默认打印差异报告；--json 输出机器可读结果
  【依赖关系】     playwright（本工作区 devDependency）；两个已在跑的 app
  【边界与注意】   **这是唯一可靠的文案与结构判据，词典比对不是。**

                   先试过按词典比对，实测在三个方向上都错：把我误判成「Vue 独创」
                   的 70 条拆开看，30 条其实在 React 词典里（引用扫描漏了）、
                   26 条是 React 在 .tsx 里**硬编码**的可见英文（setup 页、auth
                   回调、browser 面板、artifact 详情、channels 设置都有）、
                   13 条来自第三方库 streamdown。源码里读不出「屏幕上有什么」，
                   因为文字可以来自词典、字面量或依赖包，三条路都得算。

                   `ariaSnapshot()` 读的是渲染后的可访问性树：role + 可访问名 +
                   层级 + 顺序。它天然满足 ARCHITECTURE 里那条判据——不比 class 名、
                   包装元素和 primitive 内部结构，只比用户和辅助技术能感知到的东西。
                   两边用不同组件库，这是唯一能公平比较的粒度。

                   顾问性质、不阻断：它需要 ../frontend 跑起来，而本仓的
                   install/build/test/e2e 都不依赖那个目录（见 make standalone-check）。

                   **aria 快照看不见几何——所以本工具第二档比盒模型。**
                   wave 68 在浏览器里逐条量两个应用，一屏之内翻出六处差异，
                   `ariaSnapshot()` **一处都看不见**，对照台账也全绿：

                     · 欢迎区锚在外层布局容器而不是输入框上边线 → 低 15px、
                       压进输入框、宽 2px 之差让说明段落少折一行；
                     · composer 三颗图标键 `size-8`（32×32）而上游是
                       `h-8 px-2` + `size-3` 图标（28×32）；
                     · 润色键多渲染一段可见文字 → 28px 变 82px。

                   原因是 role / 可访问名 / 层级 / 顺序**全都一样**——两边渲染的是
                   同一棵可访问性树，只是画在了不同的位置和尺寸上。
                   台账那一侧的 `sampleGeometry` 只量场景 settle 里的锚点
                   （线索 137），这些元素都不是锚点。

                   **连接键取 `data-testid`，其次 role + 可访问名。** 不比 class：
                   两边用不同组件库，class 天然不同；比的是**用户量得出来的东西**
                   ——位置、尺寸、字号/行高、内边距、圆角、边框宽度。
*/

import { writeFileSync } from "node:fs";

// 本工作区装的是 `@playwright/test`（`playwright` 只是它的传递依赖，
// 直接 import 会在 pnpm 的严格 node_modules 下解析不到）。
import { chromium } from "@playwright/test";

import { diffAriaLines, normalizeAriaSnapshot } from "./lib/aria-parity.mjs";

const REACT_BASE = process.env.DOM_PARITY_REACT_BASE ?? "http://127.0.0.1:3200";
const VUE_BASE = process.env.DOM_PARITY_VUE_BASE ?? "http://127.0.0.1:3100";

/**
 * 只放不需要 Gateway 的公开页。带 workspace 的场景要两边接同一个 replay
 * Gateway，属于下一步——在那之前把范围写死，免得报告里混进「后端没起来」
 * 造成的假差异。
 */
const SCENARIOS = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "setup", path: "/setup" },
  /*
    `/showcase/<id>` 是免登录的只读演示（两边都有同一份 allowlist），
    也是这里唯一一屏**带真实消息的工作区**——消息气泡、turn actions、
    markdown 渲染、输入框都在里面。加它是因为前三屏都没有 AgentChat，
    而 wave 68 翻出的六处差异全在 AgentChat 上。
  */
  {
    name: "showcase",
    path: "/showcase/7cfa5f8f-a2f8-47ad-acbd-da7137baf990",
  },
];

const asJson = process.argv.includes("--json");
const outFlag = process.argv.indexOf("--out");
const outPath = outFlag === -1 ? null : process.argv[outFlag + 1];

/*
  在页面里跑：给每个可见元素算一个**连接键**和一份可量的盒子。

  连接键优先 `data-testid`（两边共用的测试锚点），否则 role + 可访问名。
  同键多个元素时按文档顺序编号，所以顺序变化也会露出来。

  **只取用户量得出来的量**：位置、尺寸、字号 / 行高、内边距、圆角、边框宽度。
  不取 class、不取包装层——两边用不同组件库，那些天然不同（同 ARCHITECTURE
  里「只对齐可观察行为」那条）。
*/
const COLLECT_BOXES = () => {
  const norm = (value) => (value || "").replace(/\s+/g, " ").trim();
  const nameOf = (el) => {
    const label = el.getAttribute("aria-label");
    if (label && label.trim()) return label.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
      if (text) return text;
    }
    return norm(el.textContent).slice(0, 40);
  };
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(el).visibility !== "hidden"
    );
  };
  const seen = new Map();
  const rows = {};
  const record = (key, el) => {
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    rows[`${key}#${index}`] = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      font: `${style.fontSize}/${style.lineHeight}`,
      pad: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
      radius: style.borderRadius,
      border: style.borderTopWidth,
    };
  };
  for (const el of document.querySelectorAll("[data-testid]")) {
    if (visible(el)) record(`testid:${el.getAttribute("data-testid")}`, el);
  }
  const SELECTOR =
    'button, a[href], input, textarea, h1, h2, h3, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="radio"], [role="dialog"]';
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (!visible(el)) continue;
    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    record(`${role}:${nameOf(el)}`, el);
  }
  return rows;
};

/** 两边都存在的键才比；只在一边出现的单独列。位置按**相对视口顶部**比，允许 tolerance。 */
/*
  **返回 `boxesMatched`，报告里必须打出来。** 这一档天生会踩线索 176：
  两边都没采到元素时 `boxesChanged` 也是空的，报告打出「几何差异 0 处」，
  和「逐条量过、确实一样」长得**一模一样**。连上的键数是这两种 0 的唯一区别。
*/
function diffBoxes(react, vue, tolerance = 2) {
  const onlyReact = [];
  const onlyVue = [];
  const changed = [];
  let matched = 0;
  for (const key of Object.keys(react)) {
    if (!(key in vue)) {
      onlyReact.push(key);
      continue;
    }
    matched += 1;
    const a = react[key];
    const b = vue[key];
    const parts = [];
    for (const field of ["x", "w", "h"]) {
      if (Math.abs(a[field] - b[field]) > tolerance)
        parts.push(`${field} ${a[field]}→${b[field]}`);
    }
    for (const field of ["font", "pad", "radius", "border"]) {
      if (a[field] !== b[field])
        parts.push(`${field} ${a[field]} → ${b[field]}`);
    }
    if (parts.length) changed.push(`${key}   ${parts.join("   ")}`);
  }
  for (const key of Object.keys(vue)) if (!(key in react)) onlyVue.push(key);
  return {
    boxesOnlyReact: onlyReact,
    boxesOnlyVue: onlyVue,
    boxesChanged: changed,
    boxesMatched: matched,
  };
}

async function snapshotOf(context, base, path) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    /*
      **不用 `networkidle`。** 两边都是开发服务器，HMR 的长连接让「网络安静」
      这个条件永远不成立：实测 landing 每次都走到 30s 超时，然后掉进下面的
      catch，静默返回一个空 boxes——报告里印出来是「几何差异 0 处」，
      和「逐条量过、确实一样」长得一模一样（线索 176 的同一个坑，
      这一次是本工具自己踩的）。改成 domcontentloaded + 有上限的静置。
    */
    const response = await page.goto(`${base}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: 8_000 })
      .catch(() => {});
    await page.waitForTimeout(1_500);
    const status = response?.status() ?? 0;
    const snapshot = await page.locator("body").ariaSnapshot();
    const boxes = await page.evaluate(COLLECT_BOXES);
    return {
      status,
      url: page.url(),
      snapshot: normalizeAriaSnapshot(snapshot),
      boxes,
      errors,
    };
  } catch (cause) {
    return {
      status: 0,
      url: page.url(),
      snapshot: "",
      boxes: {},
      errors: [...errors, String(cause)],
    };
  } finally {
    await page.close();
  }
}

/*
  **落地 URL 必须报出来。** 两边都要求登录的路径（本机这套栈上 /setup 与
  /showcase/<id> 就是）会各自跳到 /login，于是两边拍到的是**同一张登录页**，
  aria 与几何自然逐字相同——报告里印出来是「差异 0 行 / 几何差异 0 处」，
  读起来像「这一屏对齐了」，实际上这一屏根本没被打开过。实测 wave 68：
  landing 之外的三个场景里有两个是这样，其中 `showcase` 是当轮刚加的，
  差点就把「第三次量登录页」当成「工作区对齐了」写进结论。
*/
function landedElsewhere(path, reactUrl, vueUrl) {
  const pathOf = (url) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };
  const react = pathOf(reactUrl ?? "");
  const vue = pathOf(vueUrl ?? "");
  if (react === path && vue === path) return null;
  return { react, vue };
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const results = [];

for (const scenario of SCENARIOS) {
  const react = await snapshotOf(context, REACT_BASE, scenario.path);
  const vue = await snapshotOf(context, VUE_BASE, scenario.path);
  results.push({
    ...scenario,
    react: { status: react.status, url: react.url, errors: react.errors },
    vue: { status: vue.status, url: vue.url, errors: vue.errors },
    redirected: landedElsewhere(scenario.path, react.url, vue.url),
    ...diffAriaLines(react.snapshot, vue.snapshot),
    ...diffBoxes(react.boxes, vue.boxes),
  });
}

await context.close();
await browser.close();

if (outPath) writeFileSync(outPath, JSON.stringify(results, null, 2));
if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`语义 DOM 对照  React ${REACT_BASE}  ↔  Vue ${VUE_BASE}\n`);
  for (const result of results) {
    const total = result.onlyReact.length + result.onlyVue.length;
    console.log(
      `## ${result.name}  ${result.path}   ` +
        `React ${result.react.status} / Vue ${result.vue.status}   差异 ${total} 行`,
    );
    if (result.redirected) {
      console.log(
        `   ⚠ 跳转了：React → ${result.redirected.react}   ` +
          `Vue → ${result.redirected.vue}` +
          (result.redirected.react === result.redirected.vue
            ? "。两边落到同一张页面，下面的 0 差异**不构成这一屏的对齐证据**。"
            : "。两边落到不同页面，下面的差异是两张不同页面之间的。"),
      );
    }
    for (const error of [...result.react.errors, ...result.vue.errors]) {
      console.log(`   ⚠ ${error.slice(0, 140)}`);
    }
    for (const line of result.onlyReact.slice(0, 40))
      console.log(`   React 独有  ${line}`);
    for (const line of result.onlyVue.slice(0, 40))
      console.log(`   Vue   独有  ${line}`);
    const hidden =
      total -
      Math.min(result.onlyReact.length, 40) -
      Math.min(result.onlyVue.length, 40);
    if (hidden > 0) console.log(`   …… 还有 ${hidden} 行`);

    // 第二档：几何。aria 一处都看不见的那类差异全在这里。
    const boxTotal =
      result.boxesChanged.length +
      result.boxesOnlyReact.length +
      result.boxesOnlyVue.length;
    console.log(
      `   几何：连上 ${result.boxesMatched} 个元素，差异 ${boxTotal} 处` +
        (result.boxesMatched === 0 ? "  ← 一个都没连上，这个 0 不作数" : ""),
    );
    for (const line of result.boxesChanged.slice(0, 40))
      console.log(`   盒子不同  ${line}`);
    for (const key of result.boxesOnlyReact.slice(0, 20))
      console.log(`   只在 React  ${key}`);
    for (const key of result.boxesOnlyVue.slice(0, 20))
      console.log(`   只在 Vue    ${key}`);
    console.log("");
  }
}
