/*
  【文件职责】     把「选中态只靠换色，读屏器听不出来」这一类挡在门外：凡是
                   `variant` 在 `default` / `outline` 之间条件切换的 `<Button>`，
                   选中开关必须带 `aria-pressed`；动作随状态变化的按钮必须有不同的可访问名称。**两个应用一起扫。**
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     scripts/lib/i18n-source-guard.mjs（Vue 扫描面 + unscanned 自证）·
                   scripts/lib/strip-comments.mjs · ../../../frontend/src（缺席则那一条跳过）
  【边界与注意】   **为什么需要它**：对照台账（`e2e-parity`）比的是「两个应用一不一致」。
                   两边**一起**漏掉同一个属性时，aria / 几何 / 请求三档全是 0 行——
                   wave 88 就是这么发现 22 颗权限域按钮 + 2 颗品牌按钮都没有
                   `aria-pressed` 的（线索 238）。双向比对天生看不见这一类，
                   所以它只能靠一条单边的守卫。

                   **为什么判据是 `default`/`outline` 这一对**，而不是「所有条件
                   variant」：这个仓库里选中/未选中的既定写法就是这一对
                   （`scheduled-task-schedule-input.tsx:272` 的星期几按钮、
                   `human-input-card.tsx:167` 的多选项按钮，两边都写着 aria-pressed）。
                   其余条件 variant 是另一回事，实测逐条看过：
                   `secondary`/`ghost` 的面板触发器（sidecar / browser）状态在
                   **可访问名**里（`open ? close : open`），`outline`/`secondary`
                   的渠道连接键是动作键不是开关，`default`/`outline` 的 `<Badge>`
                   压根不可交互、状态就在徽标文字里。
                   **所以这条规则收得住，一条豁免都不需要**——豁免表为空才说明
                   收口选对了（线索 180）。真遇到一颗「就是不该有 aria-pressed」的，
                   先想清楚它凭什么让读屏器听出状态；同一个条件改变不同的动作名
                   （例如 WeChat 连接前 Close、连接后 Done）不需要 aria-pressed。

                   **扫描面要能自证盖全**（线索 229）：Vue 那一半直接复用
                   `productVueInventory()`，并断言它的 `unscanned` 恒为空；
                   React 那一半自己走目录树，断言扫到的文件数不为 0。

                   **兄弟应用缺席时** React 那一条 `it.skipIf` 跳过——是 `it` 不是
                   `describe`，而且读文件在用例体里（线索 225：`describe.skipIf`
                   跳过的是用例、不是收集，工厂里的 readFileSync 照样跑）。
                   已声明进 `scripts/lib/cross-app-by-design.mjs`。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { productVueInventory } from "../../scripts/lib/i18n-source-guard.mjs";
import { stripComments } from "../../scripts/lib/strip-comments.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(here, "../..");
const upstreamSrc = join(here, "../../../frontend/src");
const upstreamPresent = existsSync(upstreamSrc);

/**
 * 取出一个文件里所有 `<Button …>` 开标签的**完整文本**。
 *
 * 不能用 `/<Button[^>]*>/`：JSX 的属性值里全是 `onClick={() => …}`，
 * 那个 `>` 会把标签截断成半截，`aria-pressed` 恰好写在后半截时就静默放过了。
 * 这里按字符走，跟踪引号与 `{}` 深度，深度归零且不在引号里的 `>` 才是结束。
 */
export function buttonTags(source: string): string[] {
  const tags: string[] = [];
  const opener = /<Button\b/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source))) {
    let depth = 0;
    let quote = "";
    let index = match.index + match[0].length;
    for (; index < source.length; index += 1) {
      const ch = source[index]!;
      if (quote) {
        if (ch === "\\") index += 1;
        else if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth <= 0) break;
    }
    tags.push(source.slice(match.index, index + 1));
    opener.lastIndex = index + 1;
  }
  return tags;
}

/** `variant` 在 `default` 与 `outline` 之间条件切换 —— 本仓的「选中/未选中」写法。 */
export function isSelectionToggle(tag: string): boolean {
  const variant = /\bvariant=(\{[^]*?\}|"[^"]*")/.exec(tag);
  if (!variant) return false;
  const value = variant[1]!;
  return (
    value.includes("?") &&
    /["']default["']/.test(value) &&
    /["']outline["']/.test(value)
  );
}

const hasPressed = (tag: string) => /\baria-pressed\b/.test(tag);

/** 开标签之后、`</Button>` 之前的按钮内容；可访问名可能就写在这里。 */
function buttonBody(source: string, tag: string): string {
  const start = source.indexOf(tag);
  if (start < 0) return "";
  const from = start + tag.length;
  const end = source.indexOf("</Button>", from);
  return end < 0 ? "" : source.slice(from, end);
}

/**
 * 状态改变动作名称（例如连接后 Done、连接前 Close）不是选择开关。
 * 名称写在 `aria-label` 里，或写在按钮文字里（JSX `{c ? a : b}` / Vue
 * `{{ c ? a : b }}`）都算，但条件必须与 variant 的条件相同、两支必须不同。
 */
function hasNamedStateAction(tag: string, body = ""): boolean {
  const variantCondition =
    /\bvariant=\{([^?{}]+)\?/.exec(tag)?.[1] ??
    /:variant="([^?"]+)\?/.exec(tag)?.[1];
  const normalize = (value: string | undefined) => value?.replace(/\s+/g, "");
  const names = (expression: string | undefined) => {
    if (!expression) return false;
    const branches = /^(.+?)\?\s*([^?:]+)\s*:\s*([^?:]+)$/s.exec(
      expression.trim(),
    );
    return Boolean(
      branches &&
      normalize(branches[1]) === normalize(variantCondition) &&
      branches[2]?.trim() !== branches[3]?.trim(),
    );
  };
  const label =
    /\baria-label=\{([^{}]+)\}/.exec(tag)?.[1] ??
    /:aria-label="([^"]+)"/.exec(tag)?.[1];
  if (label) return names(label);
  return [...body.matchAll(/\{\{?([^{}]+)\}\}?/g)].some((match) =>
    names(match[1]),
  );
}

/** 报告一行：文件 + 那颗按钮的 variant 表达式（够定位，又不至于贴一整段 JSX）。 */
function offenders(file: string, source: string): string[] {
  return buttonTags(source)
    .filter(
      (tag) =>
        isSelectionToggle(tag) &&
        !hasPressed(tag) &&
        !hasNamedStateAction(tag, buttonBody(source, tag)),
    )
    .map((tag) => {
      const variant = /\bvariant=(\{[^]*?\}|"[^"]*")/.exec(tag)![1]!;
      return `${file}  variant=${variant.replace(/\s+/g, " ")}`;
    });
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("选中态必须念得出来", () => {
  it("distinguishes named actions from an unnamed selection toggle", () => {
    expect(
      offenders(
        "fixture.tsx",
        '<Button variant={connected ? "default" : "outline"} aria-label={connected ? done : close} onClick={onDone}>Done</Button>',
      ),
    ).toEqual([]);
    expect(
      offenders(
        "fixture.vue",
        `<Button :variant="stage === 'connected' ? 'default' : 'outline'" :aria-label="stage === 'connected' ? done : close">Done</Button>`,
      ),
    ).toEqual([]);
    expect(
      offenders(
        "fixture.vue",
        `<Button :variant="selected ? 'default' : 'outline'" :aria-label="other ? done : close">Done</Button>`,
      ),
    ).toHaveLength(1);
    expect(
      offenders(
        "fixture.tsx",
        '<Button variant={selected ? "default" : "outline"}>Daily</Button>',
      ),
    ).toHaveLength(1);
    expect(
      offenders(
        "fixture.tsx",
        '<Button variant={selected ? "default" : "outline"} aria-label={other ? done : close}>Done</Button>',
      ),
    ).toHaveLength(1);

    expect(
      offenders(
        "fixture.tsx",
        '<Button variant={selected ? "default" : "outline"} aria-label={selected ? daily : daily}>Daily</Button>',
      ),
    ).toHaveLength(1);

    expect(
      offenders(
        "fixture.tsx",
        '<Button variant={stage === "connected" ? "default" : "outline"} onClick={onDone}>{stage === "connected" ? text.done : t.common.close}</Button>',
      ),
    ).toEqual([]);
    expect(
      offenders(
        "fixture.vue",
        `<Button :variant="stage === 'connected' ? 'default' : 'outline'">{{ stage === 'connected' ? done : close }}</Button>`,
      ),
    ).toEqual([]);
    expect(
      offenders(
        "fixture.tsx",
        '<Button variant={selected ? "default" : "outline"}>{other ? done : close}</Button>',
      ),
    ).toHaveLength(1);
    expect(
      offenders(
        "fixture.tsx",
        '<Button variant={selected ? "default" : "outline"}>{selected ? daily : daily}</Button>',
      ),
    ).toHaveLength(1);
  });

  it("Vue 产品 SFC 里没有只靠换色表达选中的 Button", () => {
    const inventory = productVueInventory() as {
      checked: string[];
      unscanned: string[];
    };
    // 扫描面自证：白名单没盖住的 `.vue` 必须一个都没有（线索 229）。
    expect(inventory.unscanned).toEqual([]);
    expect(inventory.checked.length).toBeGreaterThan(0);

    const found = inventory.checked.flatMap((file) =>
      offenders(
        file,
        stripComments(readFileSync(join(repoRoot, file), "utf8"), [
          "html",
          "block",
          "line",
        ]),
      ),
    );
    expect(found).toEqual([]);
  });

  it.skipIf(!upstreamPresent)(
    "上游 tsx 里没有只靠换色表达选中的 Button",
    () => {
      const files = tsxFiles(upstreamSrc);
      expect(files.length).toBeGreaterThan(0);
      const found = files.flatMap((file) =>
        offenders(
          relative(join(here, "../../.."), file),
          stripComments(readFileSync(file, "utf8"), ["block", "line"]),
        ),
      );
      expect(found).toEqual([]);
    },
  );
});
