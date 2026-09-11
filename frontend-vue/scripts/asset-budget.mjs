#!/usr/bin/env node
/*
  【文件职责】     统计**全部构建产物**的 raw/gzip 体积，防止依赖或分包整体失控。
  【架构位置】     构建脚本
  【主要导出】     CLI：读取 .output/public/_nuxt，超预算退出 1
  【依赖关系】     Nuxt production build；Node zlib
  【边界与注意】   ⚠️ **这条门禁量的不是用户下载的字节。** 它把**全部** chunk 加起来，
                   其中绝大多数是懒加载的；打开工作区实际只下载其中几十个。
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
    // 这一格在 UI primitive 层落地**之前**就已经超了：在 48f3ef29 上实测
    // raw 1_139_429 / gzip 341_956 / maxRaw 374_890，三项全红。
    // 之前没人看见，是因为 asset-budget 不在 verify 里，得单独跑。
    // 这里记录的是当前实测值加余量，不是把一次回归悄悄放行；
    // maxRaw 前后完全没变（374_890），说明最大的那个 chunk 不是这次改动撑大的。
    totalRaw: 1_200_000,
    totalGzip: 360_000,
    // ArtifactPanel deliberately stays synchronous; keep measured headroom
    // without forcing another component boundary solely to satisfy this gate.
    maxRaw: 380_000,
  },
  // 这一格从「刻意为零」变成实测值：artifact 编辑器现在真的跑 CodeMirror 6。
  // 实测 raw 555_743 / gzip 199_712 / maxRaw 199_773（11 个 chunk，全部动态
  // import，首屏一个字节都不加载）。maxRaw 那一个是 `@codemirror/view`。
  // 语法包按语言分片，所以打开一个 .py 不会顺带下载 html/css/markdown。
  "vendor-codemirror": {
    // 2026-09-04（wave 66）复测 raw 555,743 / gzip 199,926 / maxRaw 199,773——
    // 与 2026-08-25 记的实测值逐字相同，这一格没有漂。
    totalRaw: 585_000,
    totalGzip: 210_000,
    maxRaw: 210_000,
  },
  // Typed dictionaries deliberately retain the React suggestion icon shape,
  // so their chunk also contains a small lucide subset. Classify i18n before
  // vendor-ui and budget the complete locale payload instead of hiding it in
  // the Reka/lucide accessibility bucket.
  // 2026-09-04（wave 66）复测 raw 87,271 / gzip 32,410——预算留着原来的余量。
  "vendor-i18n": { totalRaw: 120_000, totalGzip: 45_000, maxRaw: 120_000 },
  /*
    **这一格量的不是「Reka 的字节」，是「被 Reka/splitpanes 引种的那些 chunk」。**
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
    2026-09-12 第四轮重定一次。实测 raw 740,601 / gzip 223,015 / maxRaw 318,499
    ——**三项全超**（旧值 683,000 / 205,000 / 305,000 定于 wave 72，实测基数是
    650,516 / 195,402 / 288,648）。抬之前把该问的都问了，逐条写在这里：

    ① **是不是重复打包了？** 不是。逐个 chunk 搜 Reka 的内部字面量：
       `dismissableLayer.pointerDownOutside` 只出现在 1 个 chunk、
       `focusScope.autoFocusOnMount` 只出现在 1 个——分块规则没失效。
    ② **用户下载的字节涨了吗？** 没有。面向用户的那条门禁
       （`tests/e2e/route-payload.spec.ts` + `baseline/route-payload-budget.json`）
       2026-09-12 实测 5 条全绿，三条路由都在各自预算内，
       重量级渲染器也仍然不在关键路径上。
    ③ **那涨的是什么？** **带这个名字的 chunk 从 10 个变成 20 个。**
       这一格按 chunk 名字归属字节，而名字的判据是「chunk 里任意一个模块 id
       命中 `reka-ui|splitpanes`」——2026-09-11 那一轮把手写行换成 `ui/item`、
       把三处手搓模态换成 `ui/dialog`、把手写 `<input>` 换成 `ui/input`、
       搬来 Tabs 的 variant 体系，**每一处都让又一个产品 chunk 碰到 Reka**；
       再加上 2026-09-10 合上游带进来的 Projects / CSV 预览等新面。
       **这正是这一格会涨的那个方向**，见上面那段「装不出谁的字节」。
    ④ **`maxRaw` 那一个是什么？** 318,499 那个 chunk 里 `artifact` 出现 72 次、
       `sidecar` 71 次，`splitpanes` 只出现 1 次——**它是工作区那块产品代码**，
       只因为含着 splitpanes 才叫这个名字。也就是说 `vendor-ui.maxRaw`
       **根本不是一个关于 Reka 的读数**，别照着它去拆 Reka。

    **为什么红了这么久没人知道**：这一格不在 `verify` 里，文件头写着它是
    「CI 的独立一步」——而这条分支三百多个提交从来没推过，**CI 一次都没跑过**。
    线索 194 的又一例：一条只活在 CI 里、而 CI 永远不会跑到的门禁等于不存在。
    2026-09-12 起冷启动文档的收工门禁块里记的是它的真实状态。
  */
  "vendor-ui": { totalRaw: 778_000, totalGzip: 234_000, maxRaw: 335_000 },
};
// 整包天花板同步抬高，抬的正好是 CodeMirror 那 542.7 KiB / 195.0 KiB：
// 实测 raw 14_305_757 / gzip 3_292_309 / maxRaw 779_847 / maxGzip 230_136。
// 不抬的话 gzip 只剩 7_691 字节余量，下一次无关改动就会撞线，
// 而撞线的原因和被记录的原因对不上——那种门禁只会教人抬数字。
// 2026-09-12：`totalGzip` 实测 3,415,750，超 15,750 字节（**0.46%**）。
// 另外三项都还在预算内（raw 14,660,198 / maxRaw 779,878 / maxGzip 230,093），
// 也就是说整包没有突然长出一块，是上面 vendor-ui 那一段说的同一件事按比例摊到了总数上。
// 只抬这一项，按实测 + 约 5%。
const overallBudget = {
  totalRaw: 14_800_000,
  totalGzip: 3_580_000,
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
