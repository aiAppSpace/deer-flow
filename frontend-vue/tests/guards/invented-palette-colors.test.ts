/*
  【文件职责】     钉住「本仓不许自造上游从没用过的固定调色板颜色」，**双向**、零豁免。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     app/**（本仓用到的固定色）· ../frontend/src/**（上游用到的，缺席则整组跳过）
  【边界与注意】   **这条规则本来只写在 `AgentCard.vue` 的一句注释里**
                   （「破坏性动作一律走 `text-destructive`，固定红只留给 diff 增删与状态色」），
                   全仓生效、却没有任何门禁在守——2026-09-12 第十三轮按
                   「grep 注释里的断言，再问有没有人守」找出来的第一条。

                   **它守的是什么**：`--destructive` / `--muted-foreground` 这类 token
                   两套主题各有一份值，而 `text-red-600` / `bg-blue-50` 只有一份。
                   浅色下 `--destructive` 与 `red-600` 几乎同值，**看不出谁用的是 token**；
                   一到深色，写死的那一个就是一块浅色方块浮在暗背景上。
                   `DARK_DIMENSION` 那一维加进来正是为了这件事，但**取样点覆盖不到
                   只在重试 / 发送失败 / 需要管理员时才出现的那几块**——
                   与 `handwritten-variant-colors` 补的是同一个洞：判据不依赖取样点。

                   **判据为什么是「上游用过的子集」而不是「不许用固定色」**：
                   diff 的增删（`text-emerald-500` / `text-red-500`）、状态色、
                   落地页的装饰，上游自己就写固定值，禁掉它们要一张几十条的豁免表
                   （坑 180）。而**本轮实测的三处缺陷全是「本仓自己发明的那一档」**：
                   `text-red-600` / `bg-red-600` / `bg-red-50`（历史三处，注释里还留着）、
                   `bg-blue-50` / `text-blue-700`、`bg-amber-50` / `text-amber-800` /
                   `text-amber-700`、`text-emerald-600`——**上游一处都没用过**。
                   所以判据取「本仓 ⊆ 上游」，而且**允许集是从上游读出来的，不是手抄的**。

                   **色号不能放宽到色系**：上游用 `text-red-500`，历史缺陷写的是
                   `text-red-600`；按色系比，那三处一处都报不出来。

                   **反向那一半是算出来的，不是豁免表**（坑 268）：上游多出来的每个
                   固定色，它的全部出现点必须落在**本仓没有对应实现**的文件里——
                   要么在 `components/landing/**`（落地页双向豁免，见
                   `deerflow-vue-alignment-scope`），要么本仓 `app/**` 里
                   **没有任何同名文件**（上游 kebab-case、本仓 PascalCase，
                   比较时两边都归一成「去掉连字符的小写」）。
                   实测只有两处走这一支：`ui/terminal.tsx`（只被 landing 消费）
                   与 `ai-elements/web-preview.tsx`（上游**零消费者**）。
                   哪天那两个被移植进来而颜色没跟过来，这条会当场红。

                   **同名判据不限于 `ui/`**：只查 `app/components/ui/<同名>` 的话，
                   上游**产品面**文件里的固定色会整类漏在判据之外。

                   注释先剥掉（坑 202）：本仓好几处头注释里写着「原来这里是
                   `bg-red-600`」这种**病历**，不剥就会把病历报成违规。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const vueApp = join(here, "../../app");
const upstream = join(here, "../../../frontend/src");
const upstreamPresent = existsSync(upstream);

/** Tailwind 自带调色板的固定色（带任意变体前缀）。token 颜色不长这样。 */
const PALETTE =
  /\b(?:[a-z-]+:)*(?:text|bg|border|ring|from|to|via|decoration|outline|fill|stroke|shadow|accent|caret|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b/g;

const SKIPPED = new Set(["node_modules", ".nuxt", ".output", "dist", "public"]);

/** 注释剥成等长空白：行号不漂，剩下的才是真的类串。 */
function strip(source: string): string {
  const blank = (match: string) => match.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank)
    .replaceAll(/\/\/[^\n]*/g, blank);
}

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIPPED.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

/** 颜色 → 用到它的文件（去重）。 */
function scan(root: string, exts: string[]): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const file of walk(root, exts)) {
    for (const match of strip(readFileSync(file, "utf8")).matchAll(PALETTE)) {
      const at = found.get(match[0]) ?? new Set<string>();
      at.add(file.slice(root.length + 1));
      found.set(match[0], at);
    }
  }
  return found;
}

describe.skipIf(!upstreamPresent)("本仓不自造固定调色板颜色", () => {
  const mine = scan(vueApp, [".vue", ".ts", ".css"]);
  const theirs = scan(upstream, [".tsx", ".ts", ".css"]);

  /* 形状断言：正则写坏、目录写错都会让下面两条静默全绿（坑 176/195）。 */
  it("两边都扫到了固定色，而且共用的那几个确实在", () => {
    expect(mine.size).toBeGreaterThan(20);
    expect(theirs.size).toBeGreaterThan(20);
    // diff 增删那两档两边都写固定值，它们是「允许」的样本。
    for (const shared of ["text-emerald-500", "text-red-500"]) {
      expect(mine.has(shared), `本仓少了 ${shared}`).toBe(true);
      expect(theirs.has(shared), `上游少了 ${shared}`).toBe(true);
    }
  });

  it("本仓用到的固定色都是上游用过的", () => {
    const invented = [...mine.keys()]
      .filter((color) => !theirs.has(color))
      .sort()
      .map((color) => `${color} ← ${[...mine.get(color)!].sort().join(" ")}`);
    expect(
      invented,
      "上游全仓没用过这个固定色。它多半也没有 `dark:` 变体——" +
        "深色主题下就是一块浅色方块浮在暗背景上。" +
        "改走 token（`text-destructive` / `bg-muted` / `bg-popover` …），" +
        "或者回上游找它同一处用的是哪个值。",
    ).toEqual([]);
  });

  it("上游多出来的固定色，都落在本仓没有对应实现的文件里（反向）", () => {
    /** 本仓 `app/**` 里每个文件名，归一成「去掉连字符的小写」。 */
    const ported = new Set(
      walk(vueApp, [".vue", ".ts", ".css"]).map((file) =>
        basename(file)
          .replace(/\.\w+$/, "")
          .replaceAll("-", "")
          .toLowerCase(),
      ),
    );
    const unexplained: string[] = [];
    for (const [color, files] of theirs) {
      if (mine.has(color)) continue;
      for (const file of files) {
        if (file.startsWith("components/landing/")) continue;
        const name = basename(file)
          .replace(/\.\w+$/, "")
          .replaceAll("-", "")
          .toLowerCase();
        if (!ported.has(name)) continue;
        unexplained.push(`${color} ← ${file}`);
      }
    }
    expect(
      unexplained.sort(),
      "上游在一处**本仓也实现了**的文件里用了这个固定色，而本仓没有——" +
        "要么是移植时漏了颜色，要么是本仓那一处该跟着改。回上游对一下那一处。",
    ).toEqual([]);
  });
});
