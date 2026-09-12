/*
  【文件职责】     钉住「调用点不许用 `as=` 换掉 `ui/` primitive 的标签」，零豁免。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     app/components/ui/**（primitive 名字表）· app/components/** · app/pages/**
  【边界与注意】   `primitive-marker-classes`（标记类）与 `handwritten-primitive-slots`
                   （`data-slot`）的第三个同胞。前两条问「谁在**扮演**那颗 primitive」，
                   这一条问「谁在**篡改**那颗 primitive 的标签」。

                   **规则本来只写在 `DropdownMenuItem.vue` 的一句注释里**
                   （「菜单项渲染成 `<div>`，不要在调用点传 `as="button"`」），
                   而那句话背后是 wave 145 的实测代价：
                   `<button>` 的 `width: auto` 解析成 **fit-content**（表单控件的固有
                   尺寸规则，`display: flex` 也改不了），所以它**不会撑满菜单**——
                   线程行 ⋯ 菜单的「删除」项 React=182 / Vue=81.8（中文 68），
                   而菜单本身两边都是 192。当时是靠在 primitive 的**基类**里写
                   `w-full text-left` 压住的：primitive 为一个调用点的选择买单。
                   2026-09-12 第十三轮按「grep 注释里的断言，再问有没有人守」翻出来，
                   全仓 126 个 primitive 名字、**0 处违规**——这道门把这个 0 钉住。

                   **`as-child` 不在判据里**，它是两码事：`as` 换的是 primitive 自己
                   渲染成什么标签，`as-child` 是把 primitive 的属性与样式合并到
                   **调用点已经写出来的那个元素**上（上游 radix `Slot` 的同一套，
                   本仓 `Button` / `SidebarMenuButton` 都这么用）。要换元素就用 `as-child`
                   套一个真的元素出来，语义与可访问性都由调用点显式写明。

                   **上游没有 `as` 这个出口**：shadcn 的组件只收 `asChild`，
                   `as` 是 reka-ui 的 `Primitive` 多出来的一个参数。也就是说
                   传 `as` 的调用点，上游同一处**一定**走的是别的路径。

                   扫之前先剥注释（坑 202）——这份文件自己的注释里就写着 `as="button"`。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));
const uiDir = join(appDir, "components/ui");

/** 开标签里的静态或动态 `as`（`as-child` / `data-*` / `aria-*` 不匹配）。 */
const AS_ATTR = /(?<![-\w:])(?::?as)\s*=\s*["']/;
/** 一个开标签：属性值里的 `>` 不算结束。 */
const OPEN_TAG = /<([A-Z][A-Za-z]*)((?:[^<>]|"[^"]*"|'[^']*')*?)>/g;

function strip(source: string): string {
  const blank = (match: string) => match.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".vue")) out.push(full);
  }
  return out;
}

/** `ui/` 下每个 `.vue` 的文件名 == 它在模板里的组件名。 */
function primitiveNames(): Set<string> {
  return new Set(
    walk(uiDir).map((file) => file.slice(file.lastIndexOf("/") + 1, -4)),
  );
}

describe("调用点不改 primitive 的标签", () => {
  const names = primitiveNames();
  const offenders: string[] = [];
  let scanned = 0;
  for (const file of walk(appDir)) {
    if (file.startsWith(`${uiDir}/`)) continue;
    const source = strip(readFileSync(file, "utf8"));
    for (const match of source.matchAll(OPEN_TAG)) {
      if (!names.has(match[1]!)) continue;
      scanned += 1;
      if (!AS_ATTR.test(match[2]!)) continue;
      const line = source.slice(0, match.index).split("\n").length;
      offenders.push(`${relative(appDir, file)}:${line} → <${match[1]} as=…>`);
    }
  }

  /* 形状断言：名字表或正则写坏都会让下面那条静默全绿（坑 176/195）。 */
  it("扫到了 primitive 名字，也扫到了它们的调用点", () => {
    expect(names.size).toBeGreaterThan(100);
    expect(names.has("DropdownMenuItem")).toBe(true);
    expect(scanned).toBeGreaterThan(200);
  });

  it("`ui/` 之外没有人给 primitive 传 `as=`", () => {
    expect(
      offenders.sort(),
      "`as=` 换掉的是 primitive 自己渲染成什么标签，而上游没有这个出口（shadcn 只收 " +
        "`asChild`）。要换元素就用 `as-child` 套一个真的元素出来。" +
        'wave 145 实测过代价：`as="button"` 让菜单项宽 81.8 而不是 192。',
    ).toEqual([]);
  });
});
