/*
  【文件职责】     产品 SFC 不许拿符号字符当图标——除非上游同一处也这么画。
  【架构位置】     测试（守卫）
  【主要导出】     无
  【依赖关系】     app/components/**、app/pages/** 的 SFC
  【边界与注意】   **这一条守的是「画的是不是同一个东西」，不是「有没有可访问名」。**

                   一个写在标签之间的符号字符跟着**正文字体**渲染：字重、基线、
                   光学重心、以及它到底长什么样，全由系统字体决定。一颗 lucide
                   图标是 24×24 viewBox 里的定宽描边路径。两者念出来完全一样
                   （可访问名来自 `aria-label`），画出来不是一个东西。

                   所以这一类**三样机器全看不见**：`ariaSnapshot()` 只有 role 和
                   可访问名；对照台账比的是 aria 与请求；`dom-parity` 的几何档
                   量的是盒模型与色板，不量字形。`icon-parity` 也看不见——
                   它只解析 `import ... from "lucide-vue-next"` 收上来的名字，
                   而这一类**压根没 import 任何图标**。wave 69 与 wave 70
                   两轮都从它眼皮底下漏过去了。

                   wave 71 实测漏掉的四处（`icon-parity` 报 0、台账 0 行、
                   单测全绿）：

                   | 处                        | 本仓画的      | 上游画的                          |
                   | ------------------------- | ------------- | --------------------------------- |
                   | AgentChat sidecar 触发器  | `◫` U+25EB    | `MessageSquareTextIcon`           |
                   | AgentChat agent 建成那屏  | `✓` U+2713    | `CheckCircleIcon`(=CircleCheckBig) |
                   | AgentChat followup 关闭键 | `×` U+00D7    | `XIcon`                           |
                   | （wave 70 已修）AgentCard | `⚙` / `×`     | `Settings` / `Trash2`             |

                   **但「用了字符」本身不是缺陷。** 上游
                   `message-list.tsx:1372` 的划词关闭键就是
                   `<span aria-hidden="true">×</span>`，本仓照抄是对的
                   （线索 199 的反面：先问「上游那边画的是什么」）。

                   于是这条守卫钉的是**集合本身，双向**（线索 186 的修法：
                   清单要可推导，实测集合 == 清单，多一处少一处都红）。
                   跨应用那一半由 `make icon-parity` 的「拿字符当图标」档回答，
                   它两边一起比、只报本仓独有的字形；这里只保证**新增一处会有人知道**。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === ".vue") out.push(p);
  }
  return out;
}

/*
  只认「独占一个文本节点」的符号：`>` 与 `<` 之间除了空白只有它。
  emoji（U+1F300 以上）不算——scheduled-tasks 的示例配方带着一串
  🔥📰🏷️📅，那是正文内容，不是图标替身。
  口径与 `scripts/icon-parity.mjs` 的 `GLYPH_RE` 保持一致。
*/
const GLYPH_RE = />\s*([×←-⇿∀-⋿⌀-⏿■-◿☀-➿⬀-⯿])\s*</g;

/*
  注释换成等长空白。**这一条是实测补的，不是预防性的**：第一版只剥了
  `<!-- -->`，而 `SidecarTrigger.vue` 的 `<script>` 块注释里正解释着
  「原来这里写的是 `◫`」——于是守卫当场把自己的说明文字报成违规
  （线索 202 的第三例，而且踩它的是专门为这一类写的守卫本人）。
  三种注释都要剥：HTML 注释、块注释、行注释。
*/
const blankComments = (src: string) =>
  src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/./g, " "));

/*
  **实测集合就是这份清单。** 每一条都要写清「上游那一处画的是什么」——
  没有这半句，下一个人无法判断它该不该在这里。
*/
const ALLOWED: Record<string, string> = {
  // 上游 message-list.tsx:1372 的划词关闭键就是 `<span aria-hidden="true">×</span>`。
  "app/components/chat/MessageList.vue": "×",
  /*
    **wave 73 结清了 WorkspaceToaster 那条账，所以这里少了一行。**
    那颗 `×` 是本仓自己加的关闭键，而上游 `<Toaster position="top-center" />`
    没有传 `closeButton`（sonner 的默认值是关的）——上游那一排根本没有关闭键。
    按「React 没有的 Vue 不许有」删掉，`workspace` 下那条独有词条一并删了。
  */
};

describe("不许拿符号字符当图标", () => {
  /*
    **按出现顺序收，不去重**（第十九轮改的）。此前这里是 `Set`：同一个文件里
    多画一个 `×`，集合仍是 `{×}`，下面那条断言照样绿——豁免写的是上游某一处，
    盖住的却是「这个文件里这个字符随便画几次」。用数组的话，第二处会让期望串
    从 `×` 变成 `××`，必须回来说清那一处对应上游哪里。
  */
  const found = new Map<string, string[]>();
  for (const file of [...walk("app/components"), ...walk("app/pages")]) {
    const src = blankComments(readFileSync(file, "utf8"));
    for (const m of src.matchAll(GLYPH_RE)) {
      if (!found.has(file)) found.set(file, []);
      found.get(file)!.push(m[1]!);
    }
  }

  /*
    形状断言：正则失效时下面两条会一起「通过」，而那和「一处都没有」
    长得一模一样（线索 176/195）。拿一条已知为真的样本当探针。
  */
  it("扫描器认得出符号字符，也放得过 emoji 与普通文字", () => {
    const scan = (s: string) => [...s.matchAll(GLYPH_RE)].map((m) => m[1]);
    // 已知为真的三个样本：本轮修掉的那三处画的就是它们。
    expect(scan(">\n  ×\n<")).toEqual(["×"]);
    expect(scan("> ◫ <")).toEqual(["◫"]);
    expect(scan("> ✓ <")).toEqual(["✓"]);
    // emoji 是正文内容，不是图标替身；多字符文本节点也不是。
    expect(scan("> 🔥 <")).toEqual([]);
    expect(scan("> 取消 <")).toEqual([]);
    expect(found.size).toBeGreaterThan(0);
  });

  it("用了符号字符的文件，正好是清单里那些", () => {
    expect([...found.keys()].sort()).toEqual(Object.keys(ALLOWED).sort());
  });

  it("每个文件用的字符与处数，正好是清单写的那些", () => {
    for (const [file, glyphs] of found) {
      expect(glyphs.join(""), `${file}：字符或处数与 ALLOWED 对不上`).toBe(
        ALLOWED[file],
      );
    }
  });
});
