#!/usr/bin/env node
/*
  从两边源码里抽「aria 天生看不见」的三类形状，逐组件对账。

  wave 68 那十六处差异是**读 React 源码**读出来的，不是量出来的：图标尺寸、
  按钮变体、有没有 Tooltip 包着——这三样都不进可访问性树，几何档也只在两边
  同时跑起来、且那个元素当时可见时才够得着。源码扫描不需要跑应用，
  也够得着登录后的屏。
*/
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";

/*
  **把两边的图标名都解析成 lucide 的规范名再比。**

  只比「两边同名的图标」会漏掉最难发现的一类：名字不同、字形也不同。
  wave 68 一轮撞了两次——`WandSparkles` vs 上游 `SparklesIcon`；
  `CheckCircle2` vs 上游 `CheckCircleIcon`，前者解析到 `CircleCheck`、
  后者解析到 **`CircleCheckBig`**，是两个画得不一样的图标。
  别名表就在两个包各自的 `.d.ts` 的 export 行里（`X as Y` 成千上万条）。
*/
function aliasMap(dts) {
  const map = new Map();
  const src = readFileSync(dts, "utf8");
  for (const m of src.matchAll(
    /\b([A-Z][A-Za-z0-9]*) as ([A-Z][A-Za-z0-9]*)\b/g,
  ))
    map.set(m[2], m[1]);
  for (const m of src.matchAll(/declare const ([A-Z][A-Za-z0-9]*):/g))
    if (!map.has(m[1])) map.set(m[1], m[1]);
  return map;
}
const canonical = (map, name) => {
  let n = name;
  for (let i = 0; i < 5 && map.has(n) && map.get(n) !== n; i += 1)
    n = map.get(n);
  return n;
};

/*
  落地页 / docs / blog 是**双向豁免**的面（对齐范围只覆盖产品面），
  它们独占的图标不是差异，留在报告里只会把真信号淹掉。
*/
// `magicui` wave 111 删掉：两个应用里都已经没有这个目录了（新加的 staleExempt 报的）。
const EXEMPT = new Set(["landing", "docs", "blog"]);

/*
  哪些豁免真的在扫描过程中撞到过。**没撞到 = 那个目录已经不在了**，
  留着的是一条过期豁免——下一个人会以为它还在挡着什么（线索 186）。
  与下面 `VERIFIED` 的 stale 检查同一条理由：wave 111 之前这张表是单向的，
  只有「撞到就跳过」，没有「表里的每一条还撞得到吗」。
*/
const exemptSeen = new Set();

/*
  **`.ts` 也要扫。**

  wave 75 之前这里只收 `.tsx` 与 `.vue`，而**两边都把图标表放在 `.ts` 里**：
  本仓 `core/artifacts/display.ts` 的 `Image as ImageIcon`、
  `core/skills/slash-suggestions.ts` 的那一批；上游 `core/utils/files.tsx`
  是 `.tsx` 所以看得见，但同类的 `.ts` 看不见。
  于是「只有 React 用 Image」这种线索是**扫描范围造出来的**，不是差异。
*/
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (EXEMPT.has(name)) {
      exemptSeen.add(name);
      continue;
    }
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if ([".tsx", ".ts", ".vue"].includes(extname(p))) out.push(p);
  }
  return out;
}

/** lucide 图标 + 它的尺寸。React：`<XIcon className="size-3" />` / `size={12}`；Vue：`<X :size="12" />` / `class="size-3"`。 */
function icons(src, alias) {
  const found = new Map();
  const tagRe = /<([A-Z][A-Za-z0-9]*)\b([^>]*?)\/?>/g;
  let m;
  while ((m = tagRe.exec(src))) {
    const [, tag, attrs] = m;
    const sizeNum = attrs.match(/:?size=[{"]?(\d+)/);
    // `size-3.5` = 14px。**小数点不能漏**：漏了会把 14 读成 12，
    // 于是「两边都是 14」被报成「React 12 / Vue 14」——wave 68 实测三条里
    // 有两条是这么来的假线索。`size-[14px]` 也要认。
    const sizeArb = attrs.match(/size-\[(\d+)px\]/);
    const sizeCls = attrs.match(/size-(\d+(?:\.\d+)?)/);
    if (!sizeNum && !sizeArb && !sizeCls) continue;
    const px = sizeNum
      ? Number(sizeNum[1])
      : sizeArb
        ? Number(sizeArb[1])
        : Number(sizeCls[1]) * 4;
    // 只认真正的 lucide 图标：`DialogPrimitive`、`BuzzProviderIcon`、
    // `ChainOfThoughtStep` 这些也带 `size-*`，但它们不是图标。
    if (!alias.has(tag)) continue;
    const name = canonical(alias, tag);
    found.set(name, (found.get(name) ?? new Set()).add(px));
  }
  return found;
}

/*
  **拿字符当图标的那一档。**

  `icons()` 只认 import 进来的 lucide 组件，于是「压根没 import 任何图标、
  直接在标签之间写一个符号字符」这一整类**对它是隐形的**——wave 69 与 wave 70
  两轮都从它眼皮底下漏过去了。实测漏掉的：`AgentChat.vue` 的 sidecar 触发器写着
  `◫`（U+25EB）而上游画 `MessageSquareTextIcon`、agent 建成那一屏写着 `✓`
  而上游画 `CheckCircleIcon`、followup 关闭键写着 `×` 而上游画 `XIcon`。
  这三处 `ariaSnapshot()` 全看不见（可访问名两边一样），几何档也看不见
  （它不量字形），对照台账自然全绿。

  字符跟着正文字体渲染：字重、基线、光学重心都由系统字体决定，
  和一颗 24×24 viewBox 的 svg 不是同一个东西。

  **但「用了字符」本身不是缺陷**——上游 `message-list.tsx:1372` 的划词关闭键
  就是 `<span aria-hidden="true">×</span>`，本仓照抄是对的。所以这一档
  **必须两边一起比**，而且**按全仓比**（同字形档，理由见文件末尾：
  两边组件切分方式不同，按文件问全是噪声）。

  只认「独占一个文本节点」的符号：`>` 与 `<` 之间除了空白只有它。
  emoji（U+1F300 以上）不算——那是正文内容，不是图标替身
  （scheduled-tasks 的示例配方就带着一串）。
*/
const GLYPH_RE =
  />\s*([\u00D7\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u25A0-\u25FF\u2600-\u27BF\u2B00-\u2BFF])\s*</g;

function glyphs(src) {
  const set = new Set();
  for (const m of src.matchAll(GLYPH_RE)) set.add(m[1]);
  return set;
}

const kinds = {
  tooltip: (s) => (s.match(/<Tooltip\b/g) ?? []).length,
  nativeTitle: (s) => (s.match(/\btitle=[{"'`:]/g) ?? []).length,
  ariaLive: (s) => (s.match(/aria-live/g) ?? []).length,
  roleStatus: (s) => (s.match(/role=["'{]?["']?status/g) ?? []).length,
};

/*
  **扫整个源码根，不只是 `components/`。**

  wave 75 之前这两个默认值是 `.../src/components` 与 `app/components`，
  于是 `core/` / `pages/` / `composables/` 下的图标一颗都看不见。
  字形那一档比的是**全仓集合**，扫不全就等于在拿两个残缺集合做差——
  实测「只有 React 用」那 13 条里有一半是这么来的。
  逐文件配对那一档仍然只在两边都有同名文件时才成立，不受影响。
*/
const reactRoot = process.argv[2] ?? "../frontend/src";
const REACT_DTS =
  "../frontend/node_modules/lucide-react/dist/lucide-react.d.ts";
const vueRoot = process.argv[3] ?? "app";
/*
  **先剥注释再解析**（线索 174）。实测被自己咬过一次：SubtaskCard 的 import 块里
  写了三行 `//` 注释解释为什么用 `CheckCircle`，收集器按逗号切块之后
  注释粘在名字前面，整段被当成无效名**静默丢掉**——报告于是说
  「`CircleCheckBig` 只有 React 用」，而那一处当轮刚改对。
  **方向是漏报，比误报更难发现。**
*/
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/*
  **按完整路径存，不按 basename。**

  wave 75 之前 key 是 `basename.toLowerCase()`：同名文件后来的**静默覆盖**前面的
  ——实测 React 侧 167 份 `.tsx` 只剩 162 个 key，扫到整个 src 之后 409 份只剩 267。
  丢掉的那些既不出现在字形集合里，也不参与配对，而报告里看不出少了什么。
  逐文件配对改用下面单独建的 basename 索引，并且**只在两边各自唯一时才配**。
*/
const load = (root, alias) => {
  const map = new Map();
  for (const f of walk(root)) {
    const key = f;
    const src = stripComments(readFileSync(f, "utf8"));
    map.set(key, {
      file: f,
      src,
      icons: icons(src, alias),
      glyphs: glyphs(src),
      ...Object.fromEntries(
        Object.entries(kinds).map(([k, fn]) => [k, fn(src)]),
      ),
    });
  }
  return map;
};
/*
  **上游缺席时打印一行就退出 0**（同 upstream-drift.mjs）。本仓的
  install / build / test / e2e 都不依赖 `../frontend`（见 make standalone-check），
  不能因为兄弟应用没 checkout 就让任何入口变红。

  ⚠ **这里原来写着「这是顾问工具，不进任何门禁」——那句话从 wave 111 起就是假的**：
  那一轮给过期豁免加了 `process.exitCode = 1`，加上另外三处形状断言的 `exit(2)`，
  **这个脚本会红，它就是一道门禁**。留着那句话的后果不是措辞问题：
  读到它的人会以为这份输出可以忽略，接 CI 的人会照它跳过。
  报告本身仍然是「线索不是结论」——**那说的是要逐条回源码确认，不是说它不会失败**。
  它红的条件只有两类，两类都与「今天的差异有多少条」无关：
  **① 豁免表过期**（VERIFIED 里记的那条已经不复存在）、**② 形状断言不成立**
  （别名表解析不出来——空表会让每一条都「相同」）。
*/
if (!existsSync(reactRoot) || !existsSync(REACT_DTS)) {
  console.log(
    `跳过：找不到上游（${reactRoot}）。需要兄弟应用及其 node_modules 才能对账。`,
  );
  process.exit(0);
}

const REACT_ALIAS = aliasMap(REACT_DTS);
const VUE_ALIAS = aliasMap(
  "node_modules/lucide-vue-next/dist/lucide-vue-next.d.ts",
);

/* 形状断言：别名表解析不出来就别往下走（线索 176/195——空表会让每一条都「相同」）。 */
for (const [label, map, probe, want] of [
  ["React", REACT_ALIAS, "CheckCircleIcon", "CircleCheckBig"],
  ["Vue", VUE_ALIAS, "CheckCircle2", "CircleCheck"],
]) {
  if (map.size < 1000 || canonical(map, probe) !== want) {
    console.error(
      `别名表没解析出来：${label} ${map.size} 条，` +
        `${probe} → ${canonical(map, probe)}（应为 ${want}）`,
    );
    process.exit(2);
  }
}

const R = load(reactRoot, REACT_ALIAS);
const V = load(vueRoot, VUE_ALIAS);

/*
  逐文件配对用 basename 索引，**只在两边各自唯一时才配**。
  一边有两份同名的（React 的 `src` 下有 5 组），配哪一份都是猜——
  报出条数而不是静默挑一个。
*/
const byBase = (map, exts) => {
  const idx = new Map();
  for (const [path, entry] of map) {
    if (!exts.includes(extname(path))) continue;
    const k = basename(path, extname(path)).toLowerCase().replace(/[-_]/g, "");
    idx.set(k, [...(idx.get(k) ?? []), entry]);
  }
  return idx;
};
/*
  **只拿组件文件配对**（`.tsx` ↔ `.vue`）。扫描面扩到 `.ts` 之后，
  按 basename 配会把上游的 `ai-elements/message.tsx` 配到本仓的
  `core/types/message.ts`——一个纯类型文件，报出来的「React 有 Tooltip、
  Vue 没有」是纯噪声。`.ts` 仍然进全仓的字形与尺寸集合。
*/
const RB = byBase(R, [".tsx"]),
  VB = byBase(V, [".vue"]);
const pairs = [...VB.keys()].filter((k) => RB.has(k)).sort();
const unique = pairs.filter(
  (k) => RB.get(k).length === 1 && VB.get(k).length === 1,
);
console.log(
  `React ${R.size} 份 / Vue ${V.size} 份 / 同名配对 ${unique.length} 对` +
    `（另有 ${pairs.length - unique.length} 组同名文件不止一份，不配）\n`,
);

let issues = 0;
for (const key of unique) {
  const r = RB.get(key)[0],
    v = VB.get(key)[0];
  const lines = [];
  for (const [name, rs] of r.icons) {
    const vs = v.icons.get(name);
    // 按文件只比尺寸。**字形那一档按全仓比**，见文件末尾——两边的组件切分
    // 方式不同（`GitBranchPlus` 在 React 的 message-list.tsx 里，在 Vue 是独立的
    // AssistantTurnActions.vue），按文件问「有没有这颗」全是噪声。
    if (!vs) continue;
    const diff = [...rs].filter((x) => !vs.has(x));
    if (diff.length && [...vs].some((x) => !rs.has(x)))
      lines.push(
        `  图标 ${name}：React ${[...rs].join("/")}px  →  Vue ${[...vs].join("/")}px`,
      );
  }
  /*
    **tooltip / aria 这一档要跟一层委托。**

    本仓把组件拆得比上游细：`AssistantTurnActions.vue` 是上游 `message-list.tsx`
    的一部分，`TruncatedTooltip.vue` 与 `SettingsPageLoading.vue` 在上游是同一份
    文件里的内部函数。不跟委托的话这三条永远红着，而**一条长期红着的线索
    等于没有**（线索 194）——真差异会被它们淹掉。

    只跟一层：够消掉这一类，又不至于把整棵子树的 tooltip 都算成自己的。
  */
  const vueMarkers = (k) => {
    let total = v[k];
    for (const m of v.src.matchAll(/from\s+"@\/(components\/[^"]+\.vue)"/g)) {
      const children =
        VB.get(basename(m[1], ".vue").toLowerCase().replace(/[-_]/g, "")) ?? [];
      for (const child of children) total += child[k];
    }
    return total;
  };
  for (const [k, label] of [
    ["tooltip", "Tooltip"],
    ["ariaLive", "aria-live"],
    ["roleStatus", 'role="status"'],
  ]) {
    if (r[k] > 0 && vueMarkers(k) === 0)
      lines.push(`  ${label}：React ${r[k]} 处，Vue 0 处（含直接子组件）`);
  }
  if (
    r.tooltip > 0 &&
    v.nativeTitle > r.nativeTitle &&
    vueMarkers("tooltip") === 0
  )
    lines.push(`  Vue 用原生 title 而 React 用 Tooltip 组件`);
  if (lines.length) {
    issues += lines.length;
    console.log(`## ${key}\n   ${r.file}\n   ${v.file}`);
    console.log(lines.join("\n"));
    console.log();
  }
}
console.log(`按文件的尺寸差 ${issues} 处\n`);

/*
  **字形档：按全仓比规范名的集合。**

  上游用了、本仓一处都没用的那颗，通常意味着本仓画的是**另一颗长得像的**——
  wave 68 两次都是这样：`SparklesIcon` vs `WandSparkles`（本仓多画了魔杖），
  `CheckCircleIcon`(=CircleCheckBig) vs `CheckCircle2`(=CircleCheck)。
  反向（本仓用了上游没有的）同样要看：那一颗多半就是替身。
*/
/*
  **从 import 语句收集，不从 `icons()` 收集。** `icons()` 只记「写了尺寸的」，
  拿它当「用没用过这颗」会把「用了但没写尺寸」误报成「没用过」——
  实测一版这么写，把 composer 明明在用的 `Zap` 报成「只有 React 用」。
*/
const allIcons = (map, alias) => {
  const set = new Set();
  for (const v of map.values()) {
    for (const block of v.src.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*["']lucide-(?:react|vue-next)["']/g,
    )) {
      for (const raw of block[1].split(",")) {
        const name = raw
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0];
        if (alias.has(name)) set.add(canonical(alias, name));
      }
    }
  }
  return set;
};
/*
  **已核实的排除项，一条一个理由。**

  一条长期红着的线索等于没有（线索 194）：字形档从 wave 69 起挂着十几条，
  每一轮都被重新读一遍、每一轮都得出同样的结论，真差异反而被它们淹掉。
  wave 75 逐条回源码核完，把结论写在这里——**报告只列没核过的**。

  这份表是**双向**的：某一条不再出现（上游删了、或本仓开始用了），
  下面的 `stale` 会把它报出来，逼着回来重看一遍，而不是留一条过期的豁免。
*/
const VERIFIED = {
  // —— 上游那一处是死代码，**禁止移植**（react-parity-scope.json 的既定判据）——
  ArrowDown:
    "ConversationScrollButton；`grep -rn ConversationScrollButton` 除定义处零命中",
  Book: "ai-elements/sources.tsx 整份零消费者",
  ChevronLeft:
    "ai-elements/message.tsx 的 MessageBranchPrevious，MessageBranch* 零消费者",
  ThumbsUp:
    "message-list-item.tsx 的点赞；渲染条件 feedback!==undefined，没有一处传它",
  ThumbsDown: "同 ThumbsUp",
  // —— 两边 primitive 实现不同，不是产品面差异 ——
  Bookmark: "ai-elements/ 的内部件，本仓那一层用 reka 自己的结构",
  GripVertical: "ui/ 的 resizable 手柄，本仓走 splitpanes",
  // —— 改动面板那三条（FileMinus / FilePlus / FilePenLine）wave 111 删掉了 ——
  // wave 69 记的是「本仓那一屏结构不同」，而 wave 87 重做改动面板之后**两边都用了**
  // （上游是 `FileMinusIcon` 等别名，本仓是裸名，canonical 之后同一颗）。
  // 也就是说这条豁免自 wave 87 起就过期了，而 `stale` **一直在报**——
  // 没有人读那一行，因为收工清单只核最后那句「共 0 处待核」。见下面的 exitCode。
  // —— 名字撞车 / 第三方内部 ——
  Github:
    "上游画的是**本地组件** `components/workspace/github-icon.tsx`（手写 svg），" +
    "不是 lucide 的 Github；本仓用 lucide 的同名图标，两边都画 GitHub 标志",
  Maximize2:
    "本仓 MarkdownTable 的全屏键；上游那一颗由 streamdown 内部渲染" +
    "（`dist/chunk-BO2N2NFS.js` 的 `Maximize2Icon`），扫不到它的源码",
};

const ri = allIcons(R, REACT_ALIAS),
  vi = allIcons(V, VUE_ALIAS);
const rawOnlyR = [...ri].filter((n) => !vi.has(n)).sort();
const rawOnlyV = [...vi].filter((n) => !ri.has(n)).sort();
const onlyR = rawOnlyR.filter((n) => !(n in VERIFIED));
const onlyV = rawOnlyV.filter((n) => !(n in VERIFIED));
const stale = Object.keys(VERIFIED)
  .filter((n) => !rawOnlyR.includes(n) && !rawOnlyV.includes(n))
  .sort();
/* 形状断言：两边都必须解析出成百颗，否则下面的集合差是假的（线索 195）。 */
if (ri.size < 50 || vi.size < 50) {
  console.error(`图标集合没解析出来：React ${ri.size} / Vue ${vi.size}`);
  process.exit(2);
}
console.log(`## 字形（全仓）  React ${ri.size} 颗 / Vue ${vi.size} 颗`);
console.log(`   只有 React 用：${onlyR.join("、") || "无"}`);
console.log(`   只有 Vue  用：${onlyV.join("、") || "无"}`);
console.log(
  `   （另有 ${Object.keys(VERIFIED).length - stale.length} 条已核实并排除，理由写在 VERIFIED 表里）`,
);
const staleExempt = [...EXEMPT].filter((name) => !exemptSeen.has(name));
if (staleExempt.length)
  console.log(
    `   ⚠ EXEMPT 表里这几个目录在两边都不存在了，删掉或改名：${staleExempt.join("、")}`,
  );
if (stale.length)
  console.log(
    `   ⚠ VERIFIED 表里这几条已经不再出现，回去重看一遍再删：${stale.join("、")}`,
  );
/*
  **过期的豁免要让这条门禁红**（wave 111）。收工清单上写的读数一直是
  「0 处待核，**不报 stale**」——而 `stale` 从 wave 87 起就一直在报那三条，
  连着几十轮没有人发现：核清单的人只 grep 最后那句「共 0 处待核」，
  ⚠ 那一行在它上面。**一句要靠人眼读的断言，等于没有断言**（线索 194 的同一形状）。
  现在它自己会把退出码变成 1。
*/
if (stale.length || staleExempt.length) process.exitCode = 1;
/*
  **尺寸也要有一档全仓的。**

  按文件比只覆盖「两边同名的那些文件」——实测 57 / 199，也就是本仓 **71%**
  的组件从没被这一档看过：两边的组件切分方式不同（`AssistantTurnActions.vue`
  是上游 `message-list.tsx` 的一部分，settings 十一个面板、markdown 十四个
  在上游都是别的名字）。全仓这一档问的是另一个问题：
  **同一颗图标，两边用过的尺寸集合一不一样。**

  它比按文件那一档钝——一颗图标在两边各有多处、尺寸本来就可以不同——
  所以只报「集合完全不相交」的那些：那种情况下不可能是「上游那处本来就用别的尺寸」。
*/
const sizesOf = (map) => {
  const out = new Map();
  for (const v of map.values())
    for (const [n, set] of v.icons)
      out.set(n, new Set([...(out.get(n) ?? []), ...set]));
  return out;
};
const rs = sizesOf(R),
  vs = sizesOf(V);
const disjoint = [];
for (const [name, a] of rs) {
  const b = vs.get(name);
  if (!b) continue;
  if ([...a].some((x) => b.has(x))) continue;
  disjoint.push(
    `   ${name}：React ${[...a].sort((x, y) => x - y).join("/")}px  ` +
      `↔  Vue ${[...b].sort((x, y) => x - y).join("/")}px`,
  );
}
console.log(
  `\n## 尺寸（全仓，只报完全不相交的）  两边都用到的 ${
    [...rs.keys()].filter((n) => vs.has(n)).length
  } 颗`,
);
console.log(disjoint.length ? disjoint.sort().join("\n") : "   无");

console.log(
  `\n共 ${issues + onlyR.length + onlyV.length + disjoint.length} 处待核` +
    `（**都是线索不是结论，逐条回源码确认**）`,
);

/* 拿字符当图标：全仓比，只报「本仓用了、上游一处都没用」的字形。 */
const glyphSites = (map) => {
  const out = new Map();
  for (const v of map.values())
    for (const g of v.glyphs) out.set(g, [...(out.get(g) ?? []), v.file]);
  return out;
};
const rg = glyphSites(R),
  vg = glyphSites(V);
/*
  形状断言：这一档的信号是「Vue 有、React 没有」，**React 那边解析成 0 会让
  每一条 Vue 字形都变成线索**（假阳性洪水），而 React 那边解析成 0 又和
  「上游真的一个都不用」长得一样。上游 `message-list.tsx:1372` 的 `×`
  是一条已知的真样本，拿它当探针（线索 195：任何输出 0 的工具都要能回答
  「这个 0 是算出来的、还是没算」）。
*/
if (!rg.has("\u00D7")) {
  console.error(
    `字符档没解析出来：上游 message-list 的 × 应当被认到，实际 React ${rg.size} 种`,
  );
  process.exit(2);
}
const onlyVueGlyphs = [...vg.entries()].filter(([g]) => !rg.has(g));
console.log(
  `\n## 拿字符当图标（全仓）  React ${rg.size} 种 / Vue ${vg.size} 种`,
);
console.log(
  onlyVueGlyphs.length
    ? onlyVueGlyphs
        .map(
          ([g, files]) =>
            `   ${g}（U+${g.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}）` +
            `只有 Vue 用：${files.join("、")}`,
        )
        .join("\n")
    : "   无（两边用到的符号字符集合一致）",
);
