/*
  【文件职责】     产品层不许自己手搓模态/浮层语义——那是 `components/ui/` 的活。
  【架构位置】     守卫
  【主要导出】     无；vitest 用例
  【依赖关系】     app/**（除 components/ui/）· scripts/lib/strip-comments.mjs
  【边界与注意】   **这条守卫是 wave 148 的产物，起因是量出来的，不是洁癖。**

                   wave 147 第一次把移动端侧栏抽屉挂进对照取样面，量出 30 行差异，
                   根因只有一条：上游的抽屉是 Radix Dialog，**它给兄弟节点打
                   `aria-hidden`**；本仓那一套是手写的——`aria-modal="true"`
                   一句声明、一个 `keydown` 里的 Tab 陷阱、一个 window 上的
                   Escape 分支、一颗 `fixed inset-0` 的背景按钮。
                   `aria-modal` 只是**说**背景不可达，`aria-hidden` 才是**事实**。

                   顺着这一处系统扫全仓，同一根因**另有两处**：
                   外链确认弹窗（`MarkdownLinkSafetyModal.vue`）与 mermaid 全屏
                   （`MermaidFullscreen.vue`），两处都是
                   `role="button" tabindex="0"` 的裸遮罩 + 手写 Escape + 手写
                   引用计数滚动锁，**都没有 dialog 语义、没有焦点陷阱、
                   不给兄弟节点打 `aria-hidden`、关闭后不归还焦点**。
                   三处一起换成 primitive 之后，这四件事由 reka 的
                   `DialogContentModal`（`useHideOthers` + `FocusScope` +
                   `DismissableLayer`）一次给齐。

                   **判据取「零豁免」那一种**（坑 180：放宽判据 → 需要豁免表 →
                   判据选错了）：模态语义的三个标志——`role="dialog"` /
                   `role="alertdialog"`、`aria-modal`、以及 `fixed inset-0` 的
                   全屏遮罩——**只允许出现在 `app/components/ui/` 里**。
                   产品层要模态就用 primitive；primitive 缺什么就去补 primitive。

                   **判据到模态为止，不再往外扩**——wave 148 顺手把「产品层手搓
                   primitive 语义」整类扫了一遍，另外两类**查过上游之后判定照抄不动**：

                   - `role="listbox"` / `role="option"`（`ChatComposer.vue` 的斜杠
                     建议列表）：上游 `input-box.tsx:2160/2177` **一模一样是手写的**。
                   - `aria-expanded`（`SubtaskCard.vue` / `ProcessingMessageGroup.vue`
                     / `TodoList.vue` 共 4 处）：上游 `todo-list.tsx:56`、
                     `subtask-card.tsx:143` 同样写在一颗普通 `<button>` 上——
                     disclosure 本来就不需要 primitive，这是业界主流写法。

                   把这两类也写进判据就得配豁免表，而**需要豁免表说明判据选错了**
                   （坑 180）。剩下的三类（`role="menu*"` / `role="tooltip"` /
                   `aria-haspopup` / `Teleport to="body"`）产品层实测**一处都没有**。

                   注释先剥掉（坑 202 已经踩过三次：守卫把自己的说明文字报成违规），
                   而且模式串在下面是**拼出来**的，不是写成字面量（坑 267：
                   写进源码里的模式串会把守卫自己算进扫描结果）。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { stripComments } from "../../scripts/lib/strip-comments.mjs";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));
const PRIMITIVE_DIR = "components/ui/";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === ".vue" || extname(full) === ".ts")
      out.push(full);
  }
  return out;
}

function codeOf(file: string): string {
  const source = readFileSync(file, "utf8");
  return stripComments(
    source,
    extname(file) === ".vue" ? ["line", "block", "html"] : ["line", "block"],
  );
}

/**
 * 模态语义的三个标志。**拼出来而不是写成字面量**，理由见文件头。
 *
 * - `role="dialog"` / `role="alertdialog"`：产品层不该自己声明对话框角色。
 * - `aria-modal`：同上，而且它只是声明，真正管用的是 primitive 打的 `aria-hidden`。
 * - `fixed inset-0`：全屏遮罩。产品层需要遮罩就意味着它在自己实现一个浮层。
 */
const MARKERS: Array<[string, RegExp]> = [
  ["role=dialog", new RegExp(`role=["']${"dialog"}["']`)],
  ["role=alertdialog", new RegExp(`role=["']${"alertdialog"}["']`)],
  ["role 绑定成 dialog", new RegExp(`['"]${"dialog"}['"]\\s*:\\s*undefined`)],
  ["aria-modal", new RegExp(`${"aria"}-${"modal"}`)],
  ["全屏遮罩", new RegExp(`${"fixed"}\\s+${"inset-0"}`)],
];

function violations(files: string[]): string[] {
  const rows: string[] = [];
  for (const file of files) {
    const code = codeOf(file);
    for (const [label, pattern] of MARKERS) {
      if (pattern.test(code))
        rows.push(`${relative(appDir, file)} —— ${label}`);
    }
  }
  return rows;
}

const all = walk(appDir);
const product = all.filter(
  (file) => !relative(appDir, file).startsWith(PRIMITIVE_DIR),
);
const primitives = all.filter((file) =>
  relative(appDir, file).startsWith(PRIMITIVE_DIR),
);

describe("产品层不许手搓模态语义", () => {
  it("扫描面不是空的，而且两半都有文件（尺子先量自己）", () => {
    // 正则或路径写坏会让下面那条静默全绿（坑 131）。阈值按实测留余量。
    expect(product.length).toBeGreaterThan(150);
    expect(primitives.length).toBeGreaterThan(80);
    expect(product.length + primitives.length).toBe(all.length);
  });

  it("`app/` 里除 `components/ui/` 外，没有任何一处自己声明模态语义", () => {
    expect(
      violations(product),
      "模态语义归 primitive：用 ui/dialog、ui/alert-dialog 或 ui/sheet；" +
        "primitive 缺什么就去补 primitive，不要在产品层再搓一份。" +
        "wave 148 的三处（侧栏抽屉 / 外链确认 / mermaid 全屏）就是这么修的。",
    ).toEqual([]);
  });

  it("primitive 那一半确实有这些标志（否则上一条是在数空气）", () => {
    /*
      反方向：判据把 `app/` 切成两半，另一半必须**真的**是模态语义的所在地。
      哪天 primitive 也不再写这些标志了，说明整套换了实现，
      上一条那个 0 就不再有意义——它该跟着一起响（坑 268 的形状）。
    */
    expect(violations(primitives).length).toBeGreaterThan(3);
  });

  it("检测器对真实的历史违规会响（自证）", () => {
    /*
      重放 wave 148 修掉之前的那三处，各取一行原文。
      没有这一条，上面那个 0 可能只是因为正则从来没匹配过任何东西。
    */
    const before = [
      // ThreadSidebar.vue：抽屉与桌面侧栏共用一个元素，靠三元切模态语义
      `:aria-modal="mobileOpen ? 'true' : undefined"`,
      // MarkdownLinkSafetyModal.vue / MermaidFullscreen.vue：裸遮罩
      `class="bg-background/95 fixed inset-0 z-50 flex items-center"`,
    ];
    for (const line of before) {
      expect(
        MARKERS.some(([, pattern]) => pattern.test(line)),
        `检测器漏掉了这一行历史违规：${line}`,
      ).toBe(true);
    }
  });
});
