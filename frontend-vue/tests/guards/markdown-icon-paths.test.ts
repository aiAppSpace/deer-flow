/*
  【文件职责】     钉住 `MarkdownIcon.vue` 那 9 条 SVG 路径逐字来自上游装的 streamdown，
                   外框与 path 的属性也一致。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     app/components/markdown/MarkdownIcon.vue ·
                   ../frontend/node_modules/streamdown/dist/*.js（缺席则整组跳过）
  【边界与注意】   **这道门补的是一句「claimed guard 只盖了三分之一」**
                   （2026-09-12 第十四轮）。`MarkdownIcon.vue` 的头注释写着
                   「不是 lucide，也不许换成 lucide……换成 lucide 的同名图标，
                   路径数据、stroke 画法、外框尺寸全都不一样——**DOM 等价 gate 会逐属性红**」。
                   实测：golden 夹具（`tests/fixtures/react-markdown-dom.json`）里
                   **只对得上 9 条里的 3 条**（CopyIcon / DownloadIcon / Maximize2Icon）。
                   另外 6 条——CheckIcon（复制后的瞬时态）、ExternalLinkIcon（外链弹窗）、
                   RotateCcw / X / ZoomIn / ZoomOut（mermaid 全屏控件）——
                   **在夹具里一次都没出现过**，那句「会逐属性红」对它们不成立。
                   线索 229 的同一形状：判据由一个看不见新东西的数字撑着。

                   **判据取「逐字出现在上游装的 streamdown 产物里」**，因为那就是
                   这 9 条路径的唯一出处（上游不用图标库，把它们内联在 dist 的 chunk 里）。
                   允许集**从 node_modules 读出来，不手抄**：streamdown 一升级，
                   路径变了这道门当场红——而那正是要的行为（本仓要跟着改）。

                   **不写死 chunk 的文件名**：`chunk-BO2N2NFS.js` 里那串 hash 每次
                   构建都会变，写死等于把判据钉在某一次安装上。扫整个 `dist/*.js`。

                   **这条判据不钉「名字 ↔ 路径的对应」**，是写下来的边界：
                   上游产物是压缩过的，图标组件只剩 `jt` 这类标识符，**名字拿不到**。
                   也就是说把 `CopyIcon` 与 `DownloadIcon` 的路径对调，这道门不会响
                   （夹具覆盖的那 3 条会被 DOM 等价 gate 逮到，其余 6 条目前无人守）。
                   真要守那一半，得先有办法把 chunk 里的组件与它的使用点对上。
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const iconFile = join(here, "../../app/components/markdown/MarkdownIcon.vue");
const streamdownDist = join(
  here,
  "../../../frontend/node_modules/streamdown/dist",
);
const present = existsSync(streamdownDist);

/** `PATHS` 表里的 `名字: "M…"`。 */
function declaredPaths(): Map<string, string> {
  const source = readFileSync(iconFile, "utf8");
  const table = source.slice(source.indexOf("const PATHS"));
  return new Map(
    [...table.matchAll(/(\w+Icon):\s*\n?\s*"(M[^"]+)"/g)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );
}

/** `MarkdownIconName` 联合里声明的名字。 */
function declaredNames(): string[] {
  const source = readFileSync(iconFile, "utf8");
  const union = source.slice(
    source.indexOf("MarkdownIconName ="),
    source.indexOf("const PATHS"),
  );
  return [...union.matchAll(/"(\w+Icon)"/g)].map((match) => match[1]!);
}

function streamdownSource(): string {
  return readdirSync(streamdownDist)
    .filter((entry) => entry.endsWith(".js"))
    .map((entry) => readFileSync(join(streamdownDist, entry), "utf8"))
    .join("\n");
}

describe.skipIf(!present)("markdown 图标的路径来自上游的 streamdown", () => {
  const paths = declaredPaths();
  const names = declaredNames();

  /* 形状断言：表解析坏了会让下面几条静默全绿（坑 176/195）。 */
  it("表解析出来了，而且与类型联合一一对应", () => {
    expect(paths.size).toBeGreaterThan(5);
    expect([...paths.keys()].sort()).toEqual([...names].sort());
    // 每条路径唯一：重复就说明表里有一条抄错成了另一条。
    expect(new Set(paths.values()).size).toBe(paths.size);
  });

  it("每一条都逐字出现在上游装的 streamdown 产物里", () => {
    const source = streamdownSource();
    const missing = [...paths]
      .filter(([, d]) => !source.includes(d))
      .map(([name]) => name)
      .sort();
    expect(
      missing,
      "上游 streamdown 的产物里找不到这条路径。要么本仓把它改成了别的图标" +
        "（**不许换成 lucide**，见 MarkdownIcon.vue 的头注释），" +
        "要么 streamdown 升级后改了图标——那就回去照抄新的。",
    ).toEqual([]);
  });

  it("外框与 path 的属性也照抄了上游", () => {
    const source = streamdownSource();
    const vue = readFileSync(iconFile, "utf8");
    // 上游：jsx("svg",{color,height:16,strokeLinejoin:"round",viewBox:"0 0 16 16",width:16}
    //       → jsx("path",{clipRule:"evenodd",d,fill:"currentColor",fillRule:"evenodd"})
    for (const [attr, upstream] of [
      ['color="currentColor"', 'color:"currentColor"'],
      ['height="16"', "height:16"],
      ['stroke-linejoin="round"', 'strokeLinejoin:"round"'],
      ['viewBox="0 0 16 16"', 'viewBox:"0 0 16 16"'],
      ['width="16"', "width:16"],
      ['clip-rule="evenodd"', 'clipRule:"evenodd"'],
      ['fill="currentColor"', 'fill:"currentColor"'],
      ['fill-rule="evenodd"', 'fillRule:"evenodd"'],
    ] as const) {
      expect(vue, `本仓的 svg 少了 ${attr}`).toContain(attr);
      expect(source, `上游产物里没有 ${upstream}——判据的坐标系变了`).toContain(
        upstream,
      );
    }
  });
});
