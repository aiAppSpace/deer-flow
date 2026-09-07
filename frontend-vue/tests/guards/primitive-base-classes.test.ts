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

                   第一跑：37 个同名且两边都读得出基类的组件，**10 个不一致**。
                   其中四处是漏抄，已在同一轮修掉（`CommandShortcut` 的 `tracking-widest`、
                   `DropdownMenuSeparator` 的 `-mx-1`、`TabsContent` 的 `flex-1`、
                   `TooltipContent` 整组进出动画 + `dark:bg-[#050504]` + transform-origin）。
                   剩下 7 个逐条写在 `DECLARED` 里。

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
    "① z-index（已决定）；② `--reka-*` 与 `--radix-*` 是两个组件库各自的变量名，天生不同；③ `min-w-32` ≡ `min-w-[8rem]`；④ **本仓多 `border-border` `text-sm`、`shadow-lg` 对上游 `shadow-md`——这三条是真差异，待修**。",
  DropdownMenuSubContent:
    "同 DropdownMenuContent 的 ①②③；**本仓多 `border-border` `text-sm` 是真差异，待修**。",
  HoverCardContent:
    "① z-index（已决定）；② `--radix-*` 变量名；③ **`w-80` 对上游 `w-64`、`p-3` 对 `p-4`、`outline-none` 对 `outline-hidden`，还缺整组进出动画——都是真差异，待修**。",
  ScrollArea:
    "本仓多一个 `overflow-hidden`。ScrollArea 这一整类差异 wave 98 已判过（上游那层 `Suggestions` 永远不会真的滚动，决定不跟）；这一条随那笔账。",
  TooltipContent:
    "① z-index：本仓是 90（tooltip 要压过 80 那一层）；② `--reka-*` 变量名。wave 141 已把整组进出动画与 `dark:bg-[#050504]` 补齐。",
};

const STRING_LITERAL = /(['"`])([^'"`]*)\1/g;

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (entry.endsWith(ext)) out.push(full);
  }
  return out;
}

/** 只有「全是字符串字面量」的那一种读得出基类；混了运行时表达式的读不出。 */
function literalTokens(args: string): string[] | null {
  const literals = [...args.matchAll(STRING_LITERAL)].map((one) => one[2]!);
  const rest = args.replace(STRING_LITERAL, "").replace(/[\s,]/g, "");
  if (rest.length > 0 || literals.length === 0) return null;
  return literals.join(" ").split(/\s+/).filter(Boolean);
}

function vueBases(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of walk(vueRoot, ".vue")) {
    const source = readFileSync(file, "utf8");
    const match = source.match(/cn\(([\s\S]*?),\s*props\.class\s*,?\s*\)/);
    if (!match) continue;
    const tokens = literalTokens(match[1]!);
    if (!tokens) continue;
    out.set(
      file.slice(file.lastIndexOf("/") + 1).replace(/\.vue$/, ""),
      tokens,
    );
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
    for (const match of source.matchAll(
      /cn\(([\s\S]*?),\s*className,?\s*\)/g,
    )) {
      // 组件名取这次 cn() 之前最近的一个 `function X` / `const X`。
      const declaration = [
        ...source
          .slice(0, match.index)
          .matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g),
      ].pop();
      if (!declaration) continue;
      const tokens = literalTokens(match[1]!);
      if (!tokens) continue;
      out.set(declaration[1]!, tokens);
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
});
