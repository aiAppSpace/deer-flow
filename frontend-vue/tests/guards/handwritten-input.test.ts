/*
  【文件职责】     钉住「哪些文件还在手写 <input> / <textarea>」这份集合，**双向**。
  【架构位置】     守卫
  【主要导出】     无；vitest 用例
  【依赖关系】     app/components/**、app/pages/**
  【边界与注意】   这份清单是 `handwritten-button` 的同胞，判据也是同一条：
                   不是「手写输入框是缺陷」，而是 **「上游同一处走的是哪条路径」**：

                   - 上游走 `ui/input` / `ui/textarea` 的，本仓也必须走同一个
                     primitive（焦点环、`aria-invalid` 无效态、禁用态、深色 token、
                     `h-9` 统一高度一次全对上）；
                   - **上游自己也手写的，照抄不动**——那不是缺陷。

                   为什么要有这道门：2026-09-11 之前**本仓有 7 份文件在手写**，
                   其中三份干脆把 primitive 的整串基类抄成了本地常量
                   （`inputClass` / `textareaClass` / `editInputClass` …），
                   而抄的那几份都已经漏了 `aria-invalid:` 与 `disabled:` 两段。
                   最贵的一处是 `AgentSettingsDialog.vue` 的两个数字输入：
                   对照台账上 `[role=dialog] height Δ-6.2 / y Δ3.1` 量的就是它，
                   **而把它改回手写不会让任何门禁变红**——这道门就是补这个洞的。

                   **双向**（同 handwritten-button，坑 186）：清单里有、实际没有的
                   条目同样报错。只查一个方向会在池子缩小之后静默留下过期条目，
                   而过期条目会被下一个读者当成「这里还有活没干」。

                   计数按**开标签**算，注释先剥掉（HTML 注释与 JS 块注释都剥）——
                   坑 202：守卫把自己的说明文字报成违规，已经踩过四次。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));

/**
 * 文件 → [手写 input/textarea 的处数, 上游那处是什么]。
 *
 * 按路径字典序，插入位置唯一（同 handwritten-button.test.ts 的 ALLOWED）。
 */
const ALLOWED: Record<string, [number, string]> = {
  "components/chat/AgentBootstrapComposer.vue": [
    1,
    "composer 的输入框。上游走 `ai-elements/prompt-input.tsx` 的 PromptInputTextarea " +
      "→ `ui/input-group` 的 InputGroupTextarea → `<Textarea>` 再盖一层 " +
      "`border-0 shadow-none focus-visible:ring-0`。**本仓没有移植 `ui/input-group`**，" +
      "整块 composer 外壳都是手写的——那是独立的一笔账，不是这里改一个标签能了的",
  ],
  "components/chat/ChatComposer.vue": [
    2,
    "同 AgentBootstrapComposer 的 composer 输入框；另一处是隐藏的上传 file input，" +
      "上游 `ai-elements/prompt-input.tsx:851` 同样手写",
  ],
  "components/chat/HumanInputCard.vue": [
    1,
    "布尔字段的 checkbox，上游 `workspace/messages/human-input-card.tsx:445` 同样手写",
  ],
  "components/ui/input/Input.vue": [1, "primitive 自己"],
  "components/ui/textarea/Textarea.vue": [1, "primitive 自己"],
  "components/workspace/agents/AgentSettingsDialog.vue": [
    2,
    "subagent 绑定的两组 checkbox，上游 `workspace/agents/agent-settings-dialog.tsx:385/412` " +
      "同样手写（同一个对话框里的温度 / 最大 token 已经换成 `ui/input` 了）",
  ],
  "components/workspace/artifacts/ArtifactTablePreview.vue": [
    2,
    "「首行是表头」的 checkbox 与只读单元格的 textarea，上游 " +
      "`workspace/artifacts/artifact-table-preview.tsx:113/274` 两处都手写",
  ],
  "components/workspace/settings/MemorySettings.vue": [
    1,
    "隐藏的导入 file input，上游 `workspace/settings/memory-settings-page.tsx:591` 同样手写",
  ],
  "components/workspace/settings/SkillSettings.vue": [
    1,
    "sr-only 的 .skill file input，上游 `workspace/settings/skill-settings-page.tsx:167` 同样手写",
  ],
  "components/workspace/sidecar/SidecarPanel.vue": [
    2,
    "composer 输入框（同 ChatComposer，上游走 PromptInputTextarea）与隐藏的上传 file input",
  ],
  "pages/login.vue": [
    1,
    "「记住登录」的 checkbox，上游 `auth/remember-session-option.tsx:18` 同样手写",
  ],
  "pages/setup.vue": [1, "同 login.vue，共用同一处上游写法"],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === ".vue") out.push(p);
  }
  return out;
}

/** 注释剥成等长空白：行号不漂，`<input` 只剩真的开标签。 */
function strip(source: string): string {
  const blank = (m: string) => m.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank);
}

const counts = new Map<string, number>();
for (const file of [
  ...walk(join(appDir, "components")),
  ...walk(join(appDir, "pages")),
]) {
  const n = [
    ...strip(readFileSync(file, "utf8")).matchAll(/<input\b|<textarea\b/g),
  ].length;
  if (n > 0) counts.set(relative(appDir, file), n);
}

describe("手写 <input> / <textarea> 的分布", () => {
  /* 形状断言：扫挂了的话下面三条会一起静默通过（坑 176/195）。 */
  it("扫到了两个 primitive 自己", () => {
    expect(counts.get("components/ui/input/Input.vue")).toBe(1);
    expect(counts.get("components/ui/textarea/Textarea.vue")).toBe(1);
  });

  it("没有清单之外的文件在手写输入框", () => {
    const unlisted = [...counts.keys()]
      .filter((file) => !(file in ALLOWED))
      .sort();
    expect(
      unlisted,
      "新增手写 input/textarea 之前先回上游看那一处：上游走 ui/input / ui/textarea 的，" +
        "本仓也要走同一个 primitive，而不是把文件加进 ALLOWED。" +
        "尤其不要把 primitive 的基类串抄成本地常量——抄过的三份都漏了 aria-invalid 与 disabled。",
    ).toEqual([]);
  });

  it("清单里没有过期条目", () => {
    const stale = Object.keys(ALLOWED)
      .filter((file) => !counts.has(file))
      .sort();
    expect(
      stale,
      "这些文件已经没有手写 input/textarea 了：从 ALLOWED 里删掉，别留着当「还有活没干」。",
    ).toEqual([]);
  });

  it("每一份的处数都与清单一致", () => {
    const drift = [...counts.entries()]
      .filter(([file, n]) => file in ALLOWED && ALLOWED[file]![0] !== n)
      .map(([file, n]) => `${file} 清单=${ALLOWED[file]![0]} 实际=${n}`)
      .sort();
    expect(drift).toEqual([]);
  });

  it("ALLOWED 按路径字典序（插入位置唯一）", () => {
    const keys = Object.keys(ALLOWED);
    expect(keys).toEqual([...keys].sort());
  });
});
