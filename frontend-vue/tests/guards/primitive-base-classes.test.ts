/*
  【文件职责】     逐个对比两个应用同名 primitive 的基类字符串，不一致的必须逐条声明。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/** · ../frontend/src/components/ui/**（缺席则整组跳过）
  【边界与注意】   **这条判据是 wave 140 的否定结果逼出来的。** 那一轮加的
                   `primitive-class-overrides` 只管「调用点重复传了基类里已有的类」，
                   而那一轮真正的发现是**两边 primitive 的基类本身不一样**
                   （`DropdownMenuLabel` 把调用点的覆盖烤进了基类，还丢了 `font-medium`）——
                   负向验证 N2 把基类改回原样，那条门禁 4 条全绿。
                   **别把「我加了个门禁」当成「这一类以后有人守了」**（线索 286）。

                   第一跑（wave 141）：37 个同名且两边都读得出基类的组件，**10 个不一致**。
                   四处是漏抄，wave 141 修掉（`CommandShortcut` 的 `tracking-widest`、
                   `DropdownMenuSeparator` 的 `-mx-1`、`TabsContent` 的 `flex-1`、
                   `TooltipContent` 整组进出动画 + `dark:bg-[#050504]` + transform-origin）；
                   另三处 wave 142 修掉（两个 DropdownMenu content 的 `border-border`
                   `text-sm` 与 `shadow-lg`、`HoverCardContent` 的尺寸内距与整组动画）。

                   ~~现在 `DECLARED` 里剩下的 7 条全部只差三类东西~~
                   **⚠ 这个数与这句概括都过期了**（2026-09-16 第三十四轮按表数出来：
                   **实际 12 条**）。**别再往这句话里写条数**——它没有任何机器守着，
                   而下面那条「DECLARED 里不许留着已经一致了的条目」才是真判据。

                   现在表里是四类理由，逐条写在各自的值里：
                   ① z-index（本仓统一的那一层）；② `--reka-*` 对 `--radix-*` 的变量名；
                   ③ Tailwind 的等价写法（`min-w-32` ≡ `min-w-[8rem]`、
                   `top-1/2 -translate-x-1/2` ≡ `top-[50%] translate-x-[-50%]`）；
                   ④ **底层不同构，字面对齐反而让渲染更差**——`CommandInput` 是这一类，
                   它带着实测读数（第三十一轮：字面对齐后对话框高度 Δ-13.1px）。
                   **一条「待修」都不剩了**；再有新条目进来就是新的漂移。

                   **判据形状**：不是「必须一字不差」——两个应用用的是不同的组件库
                   （Radix vs Reka），CSS 变量名天生不同；Tailwind 也有等价的两种写法。
                   所以规则是「**不一致的必须有名有姓地声明，并写清是哪一类**」，
                   与 `CROSS_APP_BY_DESIGN`、`baseline` 的 `HAND_MAINTAINED` 同一个套路。
                   **声明表是双向的**：表里有、实际却已经一致的条目同样报错，
                   否则修好之后声明会永远留着（线索 186 的清单腐烂）。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const vueRoot = fileURLToPath(
  new URL("../../app/components/ui", import.meta.url),
);
const reactRoot = fileURLToPath(
  new URL("../../../frontend/src/components/ui", import.meta.url),
);
const upstreamPresent = existsSync(reactRoot);

/**
 * 基类不一致、但**有理由**的。value 是理由，会被打印出来。
 * 修好一条就从这里删一条——留着不删会被下面那条反向用例报出来。
 */
const DECLARED: Record<string, string> = {
  DialogContent:
    "① z-index：本仓统一到 80 那一层（已决定，见一页纸清单）；② `top-1/2 -translate-x-1/2` 与上游 `top-[50%] translate-x-[-50%]` 是同一条 CSS 的两种写法。",
  DialogOverlay: "z-index：本仓统一到 80 那一层（已决定）。",
  DropdownMenuContent:
    "① z-index（已决定）；② `--reka-*` 与 `--radix-*` 是两个组件库各自的变量名，天生不同；③ `min-w-32` ≡ `min-w-[8rem]`。wave 142 已把 `border-border`（与 base layer 的 `* { border-color: var(--border) }` 重复）、`text-sm`（上游不在容器上设，菜单项自己设）与 `shadow-lg`→`shadow-md` 三处对齐。",
  DropdownMenuSubContent:
    "同 DropdownMenuContent 的 ①②③；wave 142 已去掉重复的 `border-border` 与容器上的 `text-sm`（`shadow-lg` 与上游一致，保留）。",
  HoverCardContent:
    "① z-index（已决定）；② `--reka-*` 变量名。wave 142 已把 `w-64` / `p-4` / `outline-hidden` 与整组进出动画、transform-origin 补齐。",
  CommandItem:
    '框架属性名：reka 的高亮/禁用是 `data-highlighted` / `data-disabled`，cmdk 是 `data-selected="true"` / `data-disabled="true"`。同 `--reka-*` 那一类，本仓够不着。',
  DropdownMenuItem:
    "本仓多一条 `hover:bg-accent`：reka 只在 `data-highlighted` 时才 focus，鼠标悬停不触发 focus，而 Radix 给高亮项打的就是 focus，上游的 `focus:bg-accent` 在悬停时已经成立（理由写在 DropdownMenuItem.vue 的文件头）。",
  DropdownMenuRadioItem:
    "同 `DropdownMenuItem`：多一条 `hover:bg-accent`，理由同上。",
  DropdownMenuSubTrigger:
    "① 同 `DropdownMenuItem` 的 `hover:bg-accent`，理由同上；② 多一组 `data-[disabled]:pointer-events-none data-[disabled]:opacity-50`——上游这一颗**没有**禁用态样式（兄弟组件 `DropdownMenuItem` 有），禁用的子菜单看上去与可用的一样。保留本仓的（翻案判据：上游哪天补上这两条，这一条就该整个删掉）。",
  CommandInput:
    "两边底层不同构（本仓 Reka `ListboxFilter`、上游 cmdk `Input`），**逐字照抄反而把渲染对齐搞坏**：2026-09-16 第三十一轮试过一次，对照台账当场报出 `role:dialog[Model Selector] height React=135.6 Vue=122.5 Δ-13.1` 等六行几何，而改之前这一屏几何全对。判据取渲染一致而不是类串一致——最终目标是「界面完全一致」，类串只是它的代理。翻案判据：两边底层同构了（或上游换掉 cmdk）就重新逐字对一遍。",
  ScrollArea:
    "本仓根元素多一个 `overflow-hidden`。**原来挂的理由（wave 98：上游那层 `Suggestions` 永远不会真的滚动、决定不跟）2026-09-16 第三十一轮已作废**——本仓把 `Suggestions` 整层补上了，那一族 105 个投影因此清零。这一条留下来的是另一件事：**根元素的类串仍差一个 `overflow-hidden`，而两边渲染一致**（补上这一层之后台账在那些屏上是 0 行）。判据取渲染一致而不是类串一致。翻案判据：哪天台账在 ScrollArea 所在的屏上报出几何差异，就回来逐字对一遍。",
  TooltipContent:
    "① z-index：本仓是 90（tooltip 要压过 80 那一层）；② `--reka-*` 变量名。wave 141 已把整组进出动画与 `dark:bg-[#050504]` 补齐。",
};

/*
  字符串字面量。**三种引号各写一支，而不是一支 `(['"`])([^'"`]*)\1`**——后者
  不许字面量**里面**出现另外两种引号，于是 `[&_svg:not([class*='size-'])]:size-4`
  这一个 shadcn 惯用写法就能让整条读不出来。

  wave 145 实测：那种写法下本仓 21 份读不出、上游 34 处读不出，其中
  **两边同名、都因为嵌套引号被跳过的有 7 个**——`CommandItem`、
  `DropdownMenuItem`、`DropdownMenuRadioItem`、`DropdownMenuSubTrigger`、
  `SelectItem`、`SelectTrigger`、`TabsTrigger`。菜单、选择器、标签这三类最高频的
  交互组件**一个都没进过 `shared`**，于是「基类不一致的每一条都要在 DECLARED 里
  有名有姓」那句话在它们身上是空的：不进集合就不会不一致（线索 289）。
*/
const STRING_LITERAL =
  /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;

/** 三支里哪一支中了，就取哪一支的内容。 */
function literalBody(match: RegExpMatchArray): string {
  return match[1] ?? match[2] ?? match[3] ?? "";
}

/*
  `cva()` 定义的那一类（wave 143）。上一轮的比对只覆盖「基类是字符串字面量」的写法，
  **`Button` / `Badge` / `Alert` 这三个最高频的组件一个都没比过**——它们的类串在
  `cva(base, { variants: {...} })` 里。第一跑三个**一字不差**，
  这条检查是用来**维持**那个 0 的（一个没人维持的 0 会烂掉）。

  **只比同名的那几个**：上游有 12 个 `cva`、本仓 5 个（wave 145 把 `tabsListVariants`
  搬了过来，同名的从 3 个变成 4 个），其余是本仓没有的组件
  （`inputGroup*` / `item*` / `sidebarMenuButton` / `buttonGroup` / `emptyMedia`）
  或本仓没用 variants 表达的（`toggle`）。**那是另一件事**——
  「上游用 variants 参数化、本仓写死」不是类串漂移，不在这条判据里判。

  而 wave 145 正好量出「那是另一件事」也会咬人：`tabsList` 少这一档的后果不是
  「参数化程度不同」，是**本仓根本画不出 line 那一档**——技能页那一屏 14 行差异。
*/
const CVA_DEFINITION = /const\s+(\w*[Vv]ariants)\s*=\s*cva\(/g;

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (entry.endsWith(ext)) out.push(full);
  }
  return out;
}

/**
 * 找出源码里每一处 `cn(...)` 的**实参文本**，用配平括号扫，而不是正则。
 *
 * **为什么不用正则**（2026-09-16 第三十一轮实测）：原来两边各是一条
 * `cn\(([\s\S]*?),\s*props\.class\s*,?\s*\)` 式的非贪婪正则。
 * 它有一个静默失效：只要文件里**更早**有一处 `cn(` 的实参里带别的 `props.xxx`，
 * 非贪婪匹配会从那一处起跳、跨行吞到后面真正的 `props.class`，
 * 交出一段混着模板与 `</script>` 的垃圾实参 —— `literalTokens` 判它不是纯字面量、
 * 返回 null、`continue`，于是**这个组件整个从比对集合里消失，而没有任何提示**。
 *
 * 当轮就是这么撞上的：给 `ScrollArea` 加了 `props.scrollbarClass` 之后，
 * ScrollArea 从 `vueBases()` 里消失，两边「不再有差异」，
 * 只有「DECLARED 里不许留着已经一致了的条目」那条断言把它捞了出来。
 * **尺子坏了会让它守的那件事静默全绿**（线索 131 的形状）。
 */
function cnCallArgs(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/\bcn\(/g)) {
    let index = match.index + match[0].length;
    let depth = 1;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      index += 1;
    }
    if (depth === 0)
      out.push(source.slice(match.index + match[0].length, index - 1));
  }
  return out;
}

/**
 * 一处 `cn(...)` 的实参文本里，**最后一个顶层实参**。
 *
 * 判据是「最后一个实参是不是调用方传进来的 class」——那正是「基类 + 调用方覆盖」
 * 这个写法的形状。按顶层逗号切，所以实参里嵌套的 `cn()` / 对象不会切歪。
 */
function splitTopLevelArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(args.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(args.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** 只有「全是字符串字面量」的那一种读得出基类；混了运行时表达式的读不出。 */
function literalTokens(args: string): string[] | null {
  const literals = [...args.matchAll(STRING_LITERAL)].map(literalBody);
  const rest = args.replace(STRING_LITERAL, "").replace(/[\s,]/g, "");
  if (rest.length > 0 || literals.length === 0) return null;
  return literals.join(" ").split(/\s+/).filter(Boolean);
}

function vueBases(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of walk(vueRoot, ".vue")) {
    const source = readFileSync(file, "utf8");
    for (const args of cnCallArgs(source)) {
      const parts = splitTopLevelArgs(args);
      if (parts.length < 2 || parts.at(-1) !== "props.class") continue;
      const tokens = literalTokens(parts.slice(0, -1).join(", "));
      if (!tokens) continue;
      out.set(
        file.slice(file.lastIndexOf("/") + 1).replace(/\.vue$/, ""),
        tokens,
      );
      break;
    }
  }
  return out;
}

function reactBases(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  /*
    **兄弟应用不在时直接返回空表。**`describe.skipIf` 跳过的是**用例**、不是**收集**
    ——下面 `describe` 的回调体在收集阶段就会跑，那里读 `../frontend` 会当场 ENOENT，
    `make verify` 直接红（wave 83 在 `upstream-key-coverage` 上踩过一模一样的一次）。
  */
  if (!upstreamPresent) return out;
  for (const file of walk(reactRoot, ".tsx")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bcn\(/g)) {
      let index = match.index + match[0].length;
      let depth = 1;
      while (index < source.length && depth > 0) {
        const char = source[index];
        if (char === "(") depth += 1;
        else if (char === ")") depth -= 1;
        index += 1;
      }
      if (depth !== 0) continue;
      const parts = splitTopLevelArgs(
        source.slice(match.index + match[0].length, index - 1),
      );
      if (parts.length < 2 || parts.at(-1) !== "className") continue;
      // 组件名取这次 cn() 之前最近的一个 `function X` / `const X`。
      const declaration = [
        ...source
          .slice(0, match.index)
          .matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g),
      ].pop();
      if (!declaration) continue;
      const tokens = literalTokens(parts.slice(0, -1).join(", "));
      if (!tokens) continue;
      out.set(declaration[1]!, tokens);
    }
  }
  return out;
}

/** 从 `cva(` 开始配平括号，取出它的全部实参文本。 */
function cvaBodies(root: string): Map<string, Map<string, string[]>> {
  const out = new Map<string, Map<string, string[]>>();
  if (!existsSync(root)) return out;
  for (const file of [
    ...walk(root, ".ts"),
    ...walk(root, ".tsx"),
    ...walk(root, ".vue"),
  ]) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(CVA_DEFINITION)) {
      let index = match.index + match[0].length;
      let depth = 1;
      while (index < source.length && depth > 0) {
        const char = source[index];
        if (char === "(") depth += 1;
        else if (char === ")") depth -= 1;
        index += 1;
      }
      const body = source.slice(match.index + match[0].length, index - 1);
      const entries = new Map<string, string[]>();
      const base = body.match(new RegExp(`^\\s*(?:${STRING_LITERAL.source})`));
      if (base)
        entries.set("(base)", literalBody(base).split(/\s+/).filter(Boolean));
      // 各档同理：`(\w+):` 后面跟一个字面量，读法与上面共用一套。
      for (const pair of body.matchAll(
        new RegExp(`(\\w+):\\s*(?:${STRING_LITERAL.source})`, "g"),
      ))
        entries.set(
          pair[1]!,
          (pair[2] ?? pair[3] ?? pair[4] ?? "").split(/\s+/).filter(Boolean),
        );
      // 本仓把它叫 `rawButtonVariants`（外面再包一层 cn），去掉前缀再比名字。
      const raw = match[1]!.replace(/^raw/, "");
      out.set(raw[0]!.toLowerCase() + raw.slice(1), entries);
    }
  }
  return out;
}

describe.skipIf(!upstreamPresent)("两个应用的 primitive 基类", () => {
  const vue = vueBases();
  const react = reactBases();
  const shared = [...vue.keys()].filter((name) => react.has(name)).sort();
  const differing = shared.filter((name) => {
    const a = new Set(react.get(name)!);
    const b = new Set(vue.get(name)!);
    return (
      [...a].some((token) => !b.has(token)) ||
      [...b].some((token) => !a.has(token))
    );
  });

  it("两边都读出了基类，而且对得上名字的不是零（两边空掉时不能假绿）", () => {
    // 正则写坏会让下面两条静默全绿（同线索 131）。阈值按实测留余量。
    expect(vue.size).toBeGreaterThan(40);
    expect(react.size).toBeGreaterThan(60);
    expect(shared.length).toBeGreaterThan(25);
  });

  it("基类不一致的，每一条都要在 DECLARED 里有名有姓", () => {
    expect(differing.filter((name) => !(name in DECLARED))).toEqual([]);
  });

  it("DECLARED 里不许留着已经一致了的条目（过期声明）", () => {
    expect(
      Object.keys(DECLARED).filter((name) => !differing.includes(name)),
    ).toEqual([]);
  });

  const vueCva = cvaBodies(vueRoot);
  const reactCva = cvaBodies(reactRoot);
  const sharedCva = [...vueCva.keys()]
    .filter((name) => reactCva.has(name))
    .sort();

  it("cva 那一类也扫到了，而且同名的不是零", () => {
    // 同上：正则写坏会让下面那条静默全绿。实测本仓 5 个、上游 12 个、同名 4 个。
    expect(sharedCva.length).toBeGreaterThanOrEqual(4);
  });

  it("同名的 cva 定义，每一档类串都要一致", () => {
    const lines: string[] = [];
    for (const name of sharedCva) {
      const react = reactCva.get(name)!;
      const vue = vueCva.get(name)!;
      for (const key of [...new Set([...react.keys(), ...vue.keys()])].sort()) {
        const a = new Set(react.get(key) ?? []);
        const b = new Set(vue.get(key) ?? []);
        const onlyReact = [...a].filter((token) => !b.has(token));
        const onlyVue = [...b].filter((token) => !a.has(token));
        if (!onlyReact.length && !onlyVue.length) continue;
        lines.push(
          `${name}.${key} 只在上游[${onlyReact.join(" ")}] 只在本仓[${onlyVue.join(" ")}]`,
        );
      }
    }
    expect(
      lines,
      "cva 的每一档类串都是与上游的合同；第一跑（wave 143）三个组件一字不差",
    ).toEqual([]);
  });
});
