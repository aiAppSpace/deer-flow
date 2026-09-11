/*
  【文件职责】     守住「本仓独有的词典块」里没有死条目。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/core/i18n/locales/* · ../frontend/src/core/i18n/locales/en-US.ts（缺席则只跑第二条）
  【边界与注意】   `make i18n-unused` 的扫描器**按叶子名**匹配（脚本文件头解释了为什么：
                   要容忍 `const larkCopy = copy.settings.integrations.lark` 这种别名）。
                   代价是同名叶子互相遮蔽——一条真正没人用的 key，只要别处有一条同名叶子
                   活着，它就永远进不了 unused 集。

                   wave 33 实测了这个代价：本仓比上游多 8 个顶层块、117 条 key，
                   其中 **10 条是死的，扫描器一条都没报**——`browser.trigger`
                   （被 `common.showBrowser` 顶掉）、`browser.navigationFailed`
                   （只有一条单测在消费）、`messages.{conversation,clarification,subtask}`
                   （分别被顶层 `conversation.*`、`guardrails` 的同名词、`subtasks.subtask` 遮蔽）、
                   `navigation.{settingsAndMore,appearance,light,dark,language}`
                   （被 `workspace.settingsAndMore` 与 `settings.appearance.*` 遮蔽）。

                   **读上游词典是这条守卫的坐标系**，所以它在 `standalone-check` 里
                   登记成 DECLARED（`scripts/standalone-check.mjs` 的
                   `CROSS_APP_BY_DESIGN`），与 `tests/parity/scenario-coverage.test.ts`
                   同一形状：缺席时那条用例 `skipIf` 跳过，BLOCKING 仍是 0。
                   不登记就会把 BLOCKING 从 0 打成 1——那是平替判据本身。

                   **为什么只守这 8 个块**：它们是上游词典里没有的，所以「上游也没人用」
                   这条辩解在这里不成立——一条没人用就是死的。共有块里同样有遮蔽问题，
                   但那要靠别名解析（`= computed(() => copy.value.settings.integrations.lark)`
                   这类跨行别名），实测用正则做不准（一版判据在共有块上误报 122 条），
                   要做得先有类型感知的分析。这条守卫**只覆盖能判准的那部分**。
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** 上游词典里没有的顶层块。改这份清单等于做一次决定，不是顺手。 */
/*
  `browser` 与 `markdown` 在 2026-09-11 之前是本仓独有的两个块。它们不再独有，
  是因为**上游那两片界面在中文下是英文**：浏览器面板整条工具条写死字面量，
  markdown 面的控件全部由 `streamdown` 画而上游从来没给它传 `translations`。
  两边同改之后上游有了同名的块，所以从这张表里拿掉。
*/
const VUE_ONLY_BLOCKS = [
  "artifacts",
  "marketing",
  "messages",
  "navigation",
  "primitives",
  "setup",
];

const appDir = fileURLToPath(new URL("../../../app", import.meta.url));
const upstreamDictionary = fileURLToPath(
  new URL(
    "../../../../frontend/src/core/i18n/locales/en-US.ts",
    import.meta.url,
  ),
);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (
      /\.(ts|vue|mjs)$/.test(entry.name) &&
      !full.includes("locales")
    ) {
      out.push(full);
    }
  }
  return out;
}

const consumers = sourceFiles(appDir)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

function topLevelBlocks(source: string): string[] {
  return [...source.matchAll(/^ {2}([a-zA-Z]+): \{/gm)].map((m) => m[1]!);
}

const vueDictionary = readFileSync(
  join(appDir, "core/i18n/locales/en-US.ts"),
  "utf8",
);

/*
  `foo.bar` 后面不能再跟标识符字符，否则 `navigationFailed` 会被 `…Fallback` 命中。

  **整串都要转义，不能只转义点。** 第一版只把 `.` 转成 `\.`，于是 `["trigger"]`
  这个候选被当成**字符类**（`[` … `]`），几乎匹配任何一个字符——负向验证里
  「把 browser.trigger 加回去」因此是绿的。
*/
function mentions(path: string): boolean {
  const escaped = path.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`${escaped}(?![\\w$])`).test(consumers);
}

/** 单行别名：`const larkCopy = <expr>.lark` → 之后 `larkCopy.title` 也算消费。 */
function aliasesOf(block: string): string[] {
  return [
    ...consumers.matchAll(
      new RegExp(
        `(?:const|let)\\s+(\\w+)\\s*=\\s*[^;\\n]*\\.${block}(?![\\w$])`,
        "g",
      ),
    ),
  ].map((m) => m[1]!);
}

/*
  key 列表**取自基线**，不自己再解析一遍词典。第一版手写了一个括号计数的解析器，
  在 `marketing.caseStudyItems` 这种**对象数组**上直接跑偏——它把数组里六个
  `{ title, description }` 都算成了 `marketing.title` / `marketing.description`。
  `baseline/i18n-keys.json` 由 `make i18n-refresh` 用真正的解析器生成，
  又被 `make i18n-check` 钉住，是这份清单唯一可信的来源。
*/
const baselineKeys = (
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../../../baseline/i18n-keys.json", import.meta.url),
      ),
      "utf8",
    ),
  ) as { keys: string[] }
).keys;

describe("本仓独有的词典块", () => {
  it.skipIf(!existsSync(upstreamDictionary))(
    "清单与「上游没有的块」逐条相同",
    () => {
      const upstream = new Set(
        topLevelBlocks(readFileSync(upstreamDictionary, "utf8")),
      );
      const actual = topLevelBlocks(vueDictionary)
        .filter((block) => !upstream.has(block))
        .sort();
      expect(
        actual,
        "上游词典的块变了：新增的本仓独有块要写进 VUE_ONLY_BLOCKS 并逐条核实有没有消费者。",
      ).toEqual([...VUE_ONLY_BLOCKS].sort());
    },
  );

  /*
    `primitives.*` 是**上游写死英文**的那几个可访问名（`ui/command.tsx` 的
    "Command Palette"、`ui/sidebar.tsx` 的 "Toggle Sidebar"、`ui/dialog.tsx` 的
    "Close"…）。上游不把它们放进自己的 i18n，所以在中文界面上读屏器听到的也是英文；
    本仓照抄这一侧，把它们放进词典只是为了让这个决定留在一个能被 review、
    也能在上游接入 i18n 之后一次性翻掉的位置（I18N_INVENTORY 有同样的说明）。

    **这条规矩此前没有任何守卫**：把它们翻成中文不会让任何门禁变红，而那一刻
    zh-CN 界面就与上游不是同一句了。
  */
  it("primitives 两个 locale 一字不差（照抄上游写死的英文）", () => {
    /* 注释先剥掉：两份文件里的说明不必逐字相同，值才必须。 */
    const read = (locale: "en-US" | "zh-CN") => {
      const source = readFileSync(
        join(appDir, `core/i18n/locales/${locale}.ts`),
        "utf8",
      );
      const start = source.indexOf("\n  primitives: {");
      return source
        .slice(start, source.indexOf("\n  },", start))
        .replaceAll(/\/\*[\s\S]*?\*\//g, "")
        .replaceAll(/\n\s*\n/g, "\n");
    };
    expect(
      read("zh-CN"),
      "primitives 是上游写死的英文，两个 locale 必须逐字相同。",
    ).toBe(read("en-US"));
  });

  it("每一条都有消费者（上游没有这些块，所以「上游也没人用」不成立）", () => {
    const dead: string[] = [];
    for (const block of VUE_ONLY_BLOCKS) {
      const aliases = aliasesOf(block);
      for (const key of baselineKeys.filter((key) =>
        key.startsWith(`${block}.`),
      )) {
        const segments = key.split(".");
        const candidates = [key];
        if (segments.length >= 3) candidates.push(segments.slice(-2).join("."));
        for (const alias of aliases) {
          candidates.push([alias, ...segments.slice(1)].join("."));
        }
        candidates.push(`["${segments.at(-1)}"]`);
        if (!candidates.some((candidate) => mentions(candidate))) {
          dead.push(key);
        }
      }
    }
    expect(
      dead,
      "这些 key 没有任何消费者，而且上游也没有它们：要么接上 UI，要么从三个 locale 文件里删掉。",
    ).toEqual([]);
  });
});
