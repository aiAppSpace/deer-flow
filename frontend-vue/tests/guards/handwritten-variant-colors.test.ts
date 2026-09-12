/*
  【文件职责】     钉住「哪些文件在手写 primitive 的**变体色对**」这份集合，**双向**。
  【架构位置】     守卫
  【主要导出】     无；vitest 用例
  【依赖关系】     app/components/ui/{badge,button}/variants.ts · app/components/** · app/pages/**
  【边界与注意】   这是 `handwritten-button` / `handwritten-input` 的第三个同胞，
                   判据同源：**不是「手写颜色是缺陷」，而是「上游同一处走的是哪条路径」**。

                   **为什么要有它（2026-09-12 第十、十一两轮连着踩）**：
                   第十轮给几何档加上 `borderRadius` 之后，第一次跑就报出
                   `ProcessingToolStep.vue` 三颗芯片手抄了 `ui/badge` 的外观
                   （上游 `rounded-full`、本仓 `rounded-md`）。修完三颗，
                   **第十一轮全仓一扫，同一份文件里还有第四颗**——
                   它没被量出来只是因为**没有任何锚点落在它上面**。
                   同一轮还扫出 `AgentChat.vue` 那两颗「开始对话 / 返回画廊」
                   手抄了 `buttonVariants`（丢掉 `font-medium` / 焦点环 / `h-9` /
                   `hover:` / `transition-all` / `disabled:` 与 `aria-invalid:` 两组状态）。

                   **所以这道门补的洞是**：台账只看得见取样点上的差异，
                   而「手抄 primitive」是一种**分布式**的缺陷——它长在哪里，
                   哪里就得恰好有个锚点才看得见。这条判据不依赖取样点。

                   **判据为什么只取「变体色对」而不是任意主题色**：
                   `bg-muted text-muted-foreground` / `bg-popover text-popover-foreground`
                   这类是**主题 token 的正常用法**（横幅、toast、面板），上游同样直接写，
                   把它们算进来就需要一张几十条的豁免表——而「要豁免表多半是判据没选对」
                   （坑 180）。真正与 primitive 一一对应的只有 `badgeVariants` /
                   `buttonVariants` 里声明的那几对，**而且这份清单是从那两个文件里
                   读出来的，不是手抄的**：primitive 改了变体，扫描面自己跟着变。

                   **双向**（同两个同胞，坑 186）：清单里有、实际没有的条目同样报错。

                   注释先剥掉（HTML 与 JS 块注释都剥），坑 202 已经踩过四次。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));

/**
 * 文件 → [处数, 上游那处是什么]。按路径字典序，插入位置唯一。
 */
const ALLOWED: Record<string, [number, string]> = {
  "components/chat/HumanInputCard.vue": [
    1,
    "选项卡选中态，上游 `workspace/messages/human-input-card.tsx:188` 逐字相同地手写",
  ],
  "components/chat/MarkdownLink.vue": [
    1,
    "引用角标。上游这一层由 streamdown 自己渲染（本仓的 markdown 链接是重写的），" +
      "没有可对的调用点；它也不是 Badge——没有边框、带 `hover:bg-secondary/80` 与 " +
      "`mx-0.5` 的行内定位",
  ],
  "components/markdown/MarkdownLinkSafetyModal.vue": [
    1,
    "外链确认弹窗的主操作。**上游没有这个组件**——那个弹窗在上游是 streamdown " +
      "包内部渲染的（`markdown.openExternalLink` 这条词条上游有、渲染点没有），" +
      "所以没有可照抄的写法",
  ],
  "components/workspace/ThreadBackgroundTasks.vue": [
    1,
    "计数小圆点，上游 `workspace/thread-background-tasks.tsx:69` 逐字相同地手写",
  ],
  "components/workspace/ThreadSubagentBatches.vue": [
    1,
    "计数小圆点，上游 `workspace/thread-subagent-batches.tsx:75` 逐字相同地手写",
  ],
  "components/workspace/settings/SettingsDialog.vue": [
    1,
    "左侧导航的选中态，上游 `workspace/settings/settings-dialog.tsx:237` 逐字相同地手写",
  ],
  "pages/__m0/visual.vue": [
    1,
    "视觉基线的夹具页，**不是产品面**（`i18n-source-guard` 的 `__m0` 排除项同源）：" +
      "它故意把按钮的基类摊平写出来，用来证明截图里那几档样式真的生效",
  ],
};

/** 与 primitive 一一对应的变体色对，**从 variants.ts 里读出来**，不手抄。 */
function variantColorPairs(): string[] {
  const sources = [
    join(appDir, "components/ui/badge/variants.ts"),
    join(appDir, "components/ui/button/variants.ts"),
  ].map((file) => readFileSync(file, "utf8"));
  const pairs = new Set<string>();
  for (const source of sources)
    for (const match of source.matchAll(
      /\b(bg-(?:primary|secondary|destructive))\s+(text-(?:primary|secondary)-foreground|text-white)\b/g,
    ))
      pairs.add(`${match[1]} ${match[2]}`);
  return [...pairs].sort();
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === ".vue") out.push(p);
  }
  return out;
}

/** 注释剥成等长空白：行号不漂，剩下的都是真的 class 串。 */
function strip(source: string): string {
  const blank = (m: string) => m.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank);
}

const pairs = variantColorPairs();
const counts = new Map<string, number>();
for (const file of [
  ...walk(join(appDir, "components")),
  ...walk(join(appDir, "pages")),
]) {
  const rel = relative(appDir, file);
  // primitive 自己就是这些色对的定义处。
  if (rel.startsWith("components/ui/")) continue;
  const source = strip(readFileSync(file, "utf8"));
  const n = pairs.reduce(
    (total, pair) => total + source.split(pair).length - 1,
    0,
  );
  if (n > 0) counts.set(rel, n);
}

describe("手写 primitive 变体色对的分布", () => {
  /* 形状断言：扫挂了的话下面三条会一起静默通过（坑 176/195）。 */
  it("色对是从 variants.ts 里读出来的，而且真的读到了", () => {
    expect(pairs).toEqual([
      "bg-destructive text-white",
      "bg-primary text-primary-foreground",
      "bg-secondary text-secondary-foreground",
    ]);
  });

  it("没有清单之外的文件在手写变体色对", () => {
    const unlisted = [...counts.keys()]
      .filter((file) => !(file in ALLOWED))
      .sort();
    expect(
      unlisted,
      "新出现的这几份要么改走 `ui/badge` / `ui/button`，要么进上面那张表并注明上游那处是什么",
    ).toEqual([]);
  });

  it("清单里的每一条都还对得上处数（多了少了都报）", () => {
    const drift = Object.entries(ALLOWED)
      .map(([file, [expected]]) => [file, expected, counts.get(file) ?? 0])
      .filter(([, expected, actual]) => expected !== actual);
    expect(drift, "处数变了：改完请同步这张表，或者说明为什么").toEqual([]);
  });

  it("清单里没有已经不存在的条目（双向）", () => {
    const stale = Object.keys(ALLOWED)
      .filter((file) => !counts.has(file))
      .sort();
    expect(stale, "这几条已经不手写了，从表里删掉").toEqual([]);
  });
});
