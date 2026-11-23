#!/usr/bin/env node
/*
  【文件职责】     统计**全部构建产物**的 raw/gzip 体积，防止依赖或分包整体失控。
  【架构位置】     构建脚本
  【主要导出】     CLI：读取 .output/public/_nuxt，超预算退出 1
  【依赖关系】     Nuxt production build；Node zlib
  【边界与注意】   ⚠️ **这条门禁量的不是用户下载的字节。** 它把**全部** chunk 加起来，
                   其中许多是懒加载的；工作区实际请求闭包由路由门禁单独测量。
                   两个数没有对应关系，而且方向可以相反：把
                   KaTeX 从同步改成按需之后，用户首屏少了 269 KB，这里的总数却
                   **涨了 1 KiB**（多分出一个 chunk）——它对那次改进完全无感。

                   面向用户的预算在 `tests/e2e/route-payload.spec.ts` +
                   `baseline/route-payload-budget.json`：在真实导航里量浏览器
                   实际请求的脚本，并禁止重量级渲染器进入关键路径。调性能先看那条。

                   本条保留的价值是另一个方向：**产物总量**的天花板，能抓住
                   「装了个巨大的包」「分包规则失效导致重复打包」这类问题。
                   它不在 verify 里，但是 CI 的独立一步（0ce8caa3）。
*/

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = join(ROOT, ".output/public/_nuxt");

const budgets = {
  "vendor-vue": { totalRaw: 400_000, totalGzip: 90_000, maxRaw: 200_000 },
  "vendor-markdown": {
    // 2026-10-25 default production build: raw 1,308,949 / gzip 395,560 /
    // maxRaw 424,506. These are mixed renderer/product chunks, not exclusively
    // Markdown bytes. Rolldown co-locates existing consumers; disabling its load
    // optimization increased the measured workspace payload. Keep the defaults
    // and about 5% rounded headroom; real route loading is checked independently.
    totalRaw: 1_380_000,
    totalGzip: 420_000,
    maxRaw: 450_000,
  },
  "vendor-codemirror": {
    // 2026-10-25: raw 615,316 / gzip 218,984 / maxRaw 295,820. The largest
    // chunk now combines view/state/language support instead of view alone.
    // This changes emitted grouping, not the editor's lazy mounting boundary;
    // all three initial routes still load zero CodeMirror modules.
    totalRaw: 650_000,
    totalGzip: 230_000,
    maxRaw: 315_000,
  },
  // Both async dictionaries and locale helpers count toward the whole build;
  // route tests independently require downloading only the selected locale.
  // Linux 2026-10-09: 1,822 keys, 170,349 raw / 60,304 gzip; about 3% headroom.
  "vendor-i18n": { totalRaw: 176_000, totalGzip: 62_500, maxRaw: 120_000 },
  /*
    **这一格量的是包含实际 reka-ui 包的 chunk，可能同时含有产品代码。**
    2026-09-04（wave 66）把这句话改准了，因为原来那句是做不到的承诺：

    chunk 的名字由 `nuxt.config.ts` 的 `clientChunkFileName` 决定，判据是
    **chunk 里任意一个模块 id 命中**。Rollup 会把 vendor 与产品代码 co-locate，
    所以名字只取自其中一个模块，**装不出「谁的字节」**。
    实测：收窄种子之前（还带着 lucide/cva/clsx/tailwind-merge）24 个 chunk
    共 728,591 raw，而最大的两个（320 KB / 192 KB）**一个匹配包都不含**；
    收窄成 `reka-ui|splitpanes` 之后是 10 个 / 616,539 raw，
    但仍有 **4 个 chunk 两个标记都搜不到**。**所以别再往这一格写「它装着什么」。**

    它仍然有用，用途是**漂移警报**：这一格突然涨一截，说明 Rollup 的分块重排了，
    值得去看 `baseline/route-payload-budget.json`（那条才量用户下载什么）。
    **不要为了满足这一格去拆包**——两条预算没有对应关系，方向还可以相反。

    2026-09-04 实测 raw 616,539 / gzip 185,792 / maxRaw 285,765，按实测 + 约 5% 定。
    此前的 380,000 / 115,000 / 150,000 定于 2026-08-25，之后 settings 六个面板、
    agents 页、scheduled-tasks 陆续落地，**这条门禁就一直红着没人跑**。

    2026-09-05（wave 72）重测 raw 650,516 / gzip 195,402 / maxRaw 288,648，
    totalRaw 超了 516 字节（0.08%）。原因是那一轮把二十多颗手写 `<button>`
    改走 `ui/button` / `ui/toggle-group` / `ui/select` / `ui/tooltip`：
    primitive 本身一份没多，但**引它的 chunk 多了**，而这一格是按 chunk 名字
    归属字节的（见上面那段：装不出「谁的字节」）。按同样的「实测 + 约 5%」
    重定一次，不是为了绕过——是因为这条数字量的就是「有多少 chunk 碰过 Reka」，
    改走 primitive 必然让它涨，而那正是这一轮想要的方向。
  */
  /*
    vendor-ui 按包含实际 reka-ui 包模块的 chunk 归属统计，可能同时包含产品代码。
    分栏改为本仓 primitive 后移除 splitpanes 种子；下列各桶与整包预算保持不变。
    此预算检查构建体积；用户实际下载字节另由 route-payload 验收。
  */
  // Linux 2026-10-09: 35 mixed UI/product chunks, gzip 240,156; no duplicate
  // runtime in the audited module graph. Keep raw/max limits, ~3% gzip headroom.
  "vendor-ui": { totalRaw: 778_000, totalGzip: 248_000, maxRaw: 335_000 },
};
// 整包天花板同步抬高，抬的正好是 CodeMirror 那 542.7 KiB / 195.0 KiB：
// 实测 raw 14_305_757 / gzip 3_292_309 / maxRaw 779_847 / maxGzip 230_136。
// 不抬的话 gzip 只剩 7_691 字节余量，下一次无关改动就会撞线，
// 而撞线的原因和被记录的原因对不上——那种门禁只会教人抬数字。
// 2026-09-12：`totalGzip` 实测 3,415,750，超 15,750 字节（**0.46%**）。
// 另外三项都还在预算内（raw 14,660,198 / maxRaw 779,878 / maxGzip 230,093），
// 也就是说整包没有突然长出一块，是上面 vendor-ui 那一段说的同一件事按比例摊到了总数上。
// 只抬这一项，按实测 + 约 5%。
// Linux 2026-10-09: 680 chunks, 15,960,742 raw / 3,797,096 gzip.
// Rebase this actual product/dependency graph with ~3% headroom; max limits stay.
// Exact old/new byte attribution is unavailable: this is not a claim that the
// entire growth came from security updates. Evidence and limits: dependency audit.
const overallBudget = {
  totalRaw: 16_440_000,
  totalGzip: 3_911_000,
  maxRaw: 800_000,
  maxGzip: 240_000,
};

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const assets = readdirSync(ASSET_DIR)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const contents = readFileSync(join(ASSET_DIR, name));
    return {
      name,
      raw: contents.byteLength,
      gzip: gzipSync(contents, { level: 9 }).byteLength,
    };
  });

if (assets.length === 0) {
  throw new Error(`No production JavaScript assets found in ${ASSET_DIR}`);
}

const failures = [];
for (const [group, budget] of Object.entries(budgets)) {
  const grouped = assets.filter((asset) => asset.name.startsWith(`${group}-`));
  const totalRaw = sum(grouped, "raw");
  const totalGzip = sum(grouped, "gzip");
  const maxRaw = Math.max(0, ...grouped.map((asset) => asset.raw));
  console.log(
    `${group.padEnd(19)} ${String(grouped.length).padStart(3)} chunks  ` +
      `raw ${format(totalRaw).padStart(11)}  gzip ${format(totalGzip).padStart(11)}  ` +
      `max ${format(maxRaw).padStart(11)}`,
  );
  for (const key of ["totalRaw", "totalGzip", "maxRaw"]) {
    const actual = { totalRaw, totalGzip, maxRaw }[key];
    if (actual > budget[key]) {
      failures.push(`${group}.${key}: ${actual} > ${budget[key]}`);
    }
  }
}

const totalRaw = sum(assets, "raw");
const totalGzip = sum(assets, "gzip");
const maxRaw = Math.max(...assets.map((asset) => asset.raw));
const maxGzip = Math.max(...assets.map((asset) => asset.gzip));
console.log(
  `${"all-client-js".padEnd(19)} ${String(assets.length).padStart(3)} chunks  ` +
    `raw ${format(totalRaw).padStart(11)}  gzip ${format(totalGzip).padStart(11)}  ` +
    `max ${format(maxRaw).padStart(11)} / ${format(maxGzip)} gzip`,
);
for (const key of ["totalRaw", "totalGzip", "maxRaw", "maxGzip"]) {
  const actual = { totalRaw, totalGzip, maxRaw, maxGzip }[key];
  if (actual > overallBudget[key]) {
    failures.push(`all-client-js.${key}: ${actual} > ${overallBudget[key]}`);
  }
}

if (failures.length) {
  console.error(`Asset budget exceeded:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  "Build-output budget passed. 面向用户的首屏预算见 make e2e（route-payload.spec.ts）。",
);
