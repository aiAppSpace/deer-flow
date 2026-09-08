/*
  【文件职责】     钉住「用户打字的 textarea 不许用 disabled 锁」这一条，零豁免。
  【架构位置】     守卫用例（vitest）
  【主要导出】     无
  【依赖关系】     app 目录下的全部 .vue
  【边界与注意】   给一个**正被聚焦**的控件置 `disabled`，浏览器会当场把它失焦
                   （`focusout`，`relatedTarget` 为 null），而**摘掉 `disabled` 不会把
                   焦点还回来**。2026-09-08 在上游实测：发一条消息时锁只闪了 12ms，
                   足够把键盘用户丢到 `<body>` 上；本仓那条路上锁没翻，焦点还在输入框里
                   ——对照台账那一行 `focus: React=body Vue=textarea` 就是这么照出来的。

                   对的工具是 `readonly`：挡住编辑、保住焦点、留在 Tab 序里，
                   配 `aria-disabled` 照样播报「不可用」。代价是 **readonly 的 textarea
                   收得到按键**，所以每一条此前靠 disabled 顺带吞掉的提交快捷键，
                   现在都要自己判锁。

                   **零豁免是有意的**：本仓每一处 textarea 上的动态 `disabled` 都是同一个
                   缺陷，列一张「这些可以」的表，记的只是我们决定不修哪些键盘用户（坑 180）。

                   扫描前先剥注释——本文件与各调用点的说明里 `disabled` 这个词到处都是，
                   不剥的话变异过的代码看上去照样干净（坑 202/316）。
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const appDir = path.join(__dirname, "../../app");

/** 会渲染出 `<textarea>` 的标签：原生的，加上本仓那一层 ui 包装。 */
const TEXTAREA_TAGS = ["textarea", "Textarea"];

function vueFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...vueFiles(full));
    else if (entry.endsWith(".vue")) found.push(full);
  }
  return found;
}

function stripComments(text: string): string {
  return text
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, "$1");
}

type Element = { file: string; tag: string; line: number; attrs: string };

/** 读到闭合这个开标签的 `>` 为止，属性值里的引号不算数。 */
function openingTags(file: string, text: string): Element[] {
  const found: Element[] = [];
  for (const tag of TEXTAREA_TAGS) {
    const opener = new RegExp(`<${tag}(?=[\\s/>])`, "g");
    for (const match of text.matchAll(opener)) {
      let index = match.index + match[0].length;
      let quote: string | null = null;
      while (index < text.length) {
        const char = text[index]!;
        if (quote) {
          if (char === quote) quote = null;
        } else if (char === '"' || char === "'") quote = char;
        else if (char === ">") break;
        index += 1;
      }
      found.push({
        file: path.relative(appDir, file),
        tag,
        line: text.slice(0, match.index).split("\n").length,
        attrs: text.slice(match.index + match[0].length, index),
      });
    }
  }
  return found;
}

const elements = vueFiles(appDir).flatMap((file) =>
  openingTags(file, stripComments(readFileSync(file, "utf8"))),
);

describe("textarea 不用 disabled 锁", () => {
  it("扫描面里确实有 textarea", () => {
    /*
      少了这一条，标签改名或扫描根挪走之后整份文件照样全绿，
      而那个绿的意思是「一个都没找到」。
    */
    expect(elements.length).toBeGreaterThanOrEqual(8);
    expect(
      new Set(elements.map((element) => element.file)).size,
    ).toBeGreaterThan(3);
  });

  it("没有任何 textarea 把 disabled 绑在表达式上", () => {
    const locked = elements
      .filter((element) =>
        /(^|\s)(?::|v-bind:)disabled\s*=/.test(element.attrs),
      )
      .map((element) => `${element.file}:${element.line} <${element.tag}>`);
    expect(locked).toEqual([]);
  });

  it("composer 仍然锁得住，用的是 readonly", () => {
    /*
      上一条光靠**删掉锁**也能满足，那会让用户在一个发不出去的输入框里打字。
      每一个 composer 的草稿控件（`data-slot="input-group-control"`）都必须带
      readonly 锁并且说得出「不可用」。
    */
    const composers = elements.filter((element) =>
      element.attrs.includes('data-slot="input-group-control"'),
    );
    expect(composers.length).toBeGreaterThanOrEqual(3);
    for (const composer of composers) {
      const where = `${composer.file}:${composer.line}`;
      expect(
        /(^|\s)(?::|v-bind:)readonly\s*=/.test(composer.attrs),
        `${where} 没有 readonly 锁`,
      ).toBe(true);
      expect(
        /(^|\s)(?::|v-bind:)aria-disabled\s*=/.test(composer.attrs),
        `${where} 没有把「不可用」播报出去`,
      ).toBe(true);
    }
  });
});
