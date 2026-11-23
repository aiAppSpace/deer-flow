/*
  【文件职责】     固定「这段内容需不需要 KaTeX」的判据。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/markdown/math.ts
  【边界与注意】   用实际 remark-math 语法固定懒加载准入，覆盖转义、代码上下文和
                   跨行行内公式；正文里真实存在的公式不得因字符串启发式而漏渲染。
*/
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";

import { containsMath } from "@/core/markdown/math";

describe("containsMath", () => {
  it.each([
    ["行内公式", "面积是 $a^2+b^2=c^2$ 对吧"],
    ["显示公式", "推导：\n\n$$\\int_0^1 x\\,dx$$\n"],
    ["多行显示公式", "$$\n\\frac{1}{2}\n$$\n"],
    ["正文中间的显示公式", "before $$x$$ after"],
    ["一段里有多个行内公式", "$a$ 和 $b$"],
  ])("认出%s", (_name, source) => {
    expect(containsMath(source)).toBe(true);
  });

  it.each([
    ["没有美元符号", "普通一句话，没有任何公式。"],
    ["单独一个美元符号", "价格是 $5"],
    ["转义的美元符号", "写作 \\$5 与 \\$10"],
    ["围栏代码里的 shell 变量", "```sh\necho $PATH $HOME\n```\n"],
    ["波浪线围栏代码", "~~~sh\ncd $HOME && echo $USER\n~~~\n"],
    ["行内代码里的变量", "用 `$PATH` 和 `$HOME`"],
  ])("不因%s误报", (_name, source) => {
    expect(containsMath(source)).toBe(false);
  });

  it("代码块之外的公式仍然算数", () => {
    expect(containsMath("```sh\necho $PATH\n```\n\n再看 $E=mc^2$\n")).toBe(
      true,
    );
  });
});

describe("the installed remark-math grammar owns admission", () => {
  const parser = unified()
    .use(remarkParse)
    .use(remarkMath, { singleDollarTextMath: true });
  it.each([
    ["soft line break", "$a\n+b$"],
    ["two escaped backslashes before delimiter", String.raw`\\$a$`],
    ["backticks inside math", "$a ` x `$"],
    ["code then multiline formula", "`$PATH` and $x\n+y$"],
  ])("loads the renderer for %s", (_name, source) => {
    const tree = parser.parse(source);
    type MarkdownNode = { type: string; children?: MarkdownNode[] };
    const pending: MarkdownNode[] = [tree];
    let found = false;
    while (pending.length) {
      const node = pending.pop()!;
      if (node.type === "math" || node.type === "inlineMath") found = true;
      pending.push(...(node.children ?? []));
    }
    expect(found).toBe(true);
    expect(containsMath(source)).toBe(true);
  });
});
