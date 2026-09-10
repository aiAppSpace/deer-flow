/*
  【文件职责】     钉住「哪些文件还在手写 <button>」这份集合，**双向**。
  【架构位置】     守卫
  【主要导出】     无；vitest 用例
  【依赖关系】     app/components/**、app/pages/**
  【边界与注意】   这份清单是 wave 72 的产物。判据不是「手写 button 是缺陷」——
                   而是 **「上游同一颗控件走的是哪条路径」**：

                   - 上游走 `<Button>` / `InputGroupButton` / `ToggleGroup` /
                     `Select` 的，本仓也必须走同一个 primitive（焦点环、hover、
                     cursor、禁用态、字号、深色 hover 一次全对上）；
                   - **上游自己也手写的，照抄不动**——那不是缺陷。

                   所以下面每一条都写清「上游那处是什么」。加一颗新的手写 button
                   之前，先回上游看那一颗；如果上游走 primitive，本仓也要走，
                   而不是把文件加进这份清单。

                   **双向**（坑 186）：清单里有、实际没有的条目同样报错。
                   只查一个方向的清单会在池子缩小之后静默留下过期条目，
                   而过期条目会被下一个读者当成「这里还有活没干」。

                   计数按**开标签**算，注释先剥掉（HTML 注释与 JS 块注释都剥）——
                   坑 202 已经踩过三次：守卫把自己的说明文字报成违规。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));

/**
 * 文件 → [手写 button 的颗数, 上游那处是什么]。
 *
 * 按路径字典序，插入位置唯一（同 architecture.test.ts 的 l2Files）。
 */
const ALLOWED: Record<string, [number, string]> = {
  "components/chat/AgentChat.vue": [
    2,
    "发送失败重试 / 建 agent 出错重试：上游没有错误态，沿用 recent-chat-list.tsx:468 " +
      "的 `underline` 写法。保存 agent 那颗 wave 78 已经搬进页头的 ⋯ 菜单 " +
      "（同上游 agents/new/page.tsx:309 的 DropdownMenuItem + SaveIcon），不再手写",
  ],
  "components/chat/ChatComposer.vue": [
    2,
    "input-box.tsx:2149（斜杠建议项）与 :2227（技能 chip 的移除键），两处上游也手写",
  ],
  "components/chat/CitationSourcesPanel.vue": [
    1,
    "citation-sources-panel.tsx:122，上游也手写",
  ],
  "components/chat/MessageList.vue": [
    1,
    "历史加载失败的重试，上游没有错误态。artifactTargets 那排文件名键 wave 78 " +
      "已删：带写文件调用的消息两边都归 assistant:processing 组画成 " +
      "chain-of-thought 的一步，上游的 assistant:subagent 分支也不画文件名键",
  ],
  "components/chat/ProcessingToolStep.vue": [
    1,
    "message-group.tsx:676，逐字相同",
  ],
  "components/chat/SubtaskCard.vue": [
    1,
    "子任务步骤的重试链接，同 recent-chat-list.tsx:468 的 `mt-1 underline` 写法",
  ],
  /*
    markdown/ 整片逐字抄自 streamdown 的 dist——**上游自己就是手写 button**。
    实测出处 streamdown 2.5.0 的 `dist/chunk-BO2N2NFS.js`（同 MarkdownLinkSafetyModal
    文件头引的那一份）：
    复制 / 下载 / 全屏那一档的 className 是
    `cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground
     disabled:cursor-not-allowed disabled:opacity-50`，与本仓逐字相同。
  */
  "components/markdown/CodeBlock.vue": [1, "streamdown code-block-copy-button"],
  "components/markdown/MarkdownCopyButton.vue": [1, "streamdown 复制键"],
  "components/markdown/MarkdownImage.vue": [1, "streamdown 图片下载键"],
  "components/markdown/MarkdownLinkSafetyModal.vue": [
    2,
    "streamdown link-safety modal 的复制链接 + 打开链接。**关闭那颗 wave 148 " +
      "没了**：壳子换成 ui/dialog 之后由 DialogContent 自带的关闭键承担",
  ],
  "components/markdown/MarkdownSafeLink.vue": [1, "streamdown 外链按钮"],
  "components/markdown/MarkdownTable.vue": [
    3,
    "streamdown 表格的复制 / 下载 / 全屏",
  ],
  "components/markdown/MermaidDownloadMenu.vue": [
    4,
    "streamdown MermaidDownloadButton：触发器 + 三个格式项",
  ],
  "components/markdown/MermaidFullscreen.vue": [
    1,
    "streamdown 全屏触发器。**退出键 wave 148 没了**：壳子换成 ui/dialog " +
      "之后由 DialogContent 自带的关闭键承担",
  ],
  "components/markdown/MermaidZoomPan.vue": [
    3,
    "streamdown ZoomPan 的放大 / 缩小 / 重置",
  ],
  "components/ui/button/Button.vue": [1, "Button primitive 本体"],
  "components/workspace/GatewayStatusBanner.vue": [
    2,
    "gateway-offline-banner.tsx:119（退出）；重试那颗是本仓补的出路，同一种写法",
  ],
  "components/workspace/ThreadActionsMenu.vue": [
    1,
    "ui/sidebar.tsx 的 SidebarMenuAction，上游也手写",
  ],
  "components/workspace/ThreadSidebar.vue": [
    4,
    "ui/sidebar.tsx 的 SidebarMenuButton ×2 / SidebarRail；" +
      "删除失败的重试链接同 recent-chat-list.tsx:468。**窄屏遮罩那颗 wave 148 " +
      "没了**：抽屉换成 ui/sheet 之后遮罩由 DialogOverlay 承担",
  ],
  "components/workspace/TodoList.vue": [
    1,
    "上游 todo-list.tsx:45 是挂 onClick 的 <header>；本仓改成 button 是有意的" +
      "（那是上游的键盘可达性缺陷），外观逐条对齐",
  ],
  "components/workspace/artifacts/ArtifactTablePreview.vue": [
    1,
    "长单元格的展开键：要在 truncate 的一行里当省略文本本身点，" +
      "Button primitive 的 inline-flex + 内边距会把这行撑开。" +
      "上游同一颗也是手写的（artifact-table-preview.tsx 的 `max-w-full " +
      "cursor-pointer truncate text-left underline underline-offset-4`）",
  ],
  "components/workspace/browser-view/BrowserPanel.vue": [
    2,
    "浏览器面板的两条错误重试，上游没有错误态",
  ],
  "components/workspace/changes/WorkspaceChangesBadge.vue": [
    3,
    "两条错误重试（上游没有）+ workspace-change-badge.tsx:60 那颗，逐字相同",
  ],
  "components/workspace/scheduled-tasks/ScheduledTaskList.vue": [
    1,
    "workspace/scheduled-tasks/page.tsx:403，逐字相同",
  ],
  "components/workspace/settings/AppearanceSettings.vue": [
    1,
    "appearance-settings-page.tsx:134，上游也手写",
  ],
  "components/workspace/settings/SettingsDialog.vue": [
    1,
    "settings-dialog.tsx:192，上游也手写",
  ],
  "pages/__m0/splitpanes.vue": [2, "M0 测试夹具页，非产品面"],
  "pages/__m0/visual.vue": [1, "M0 测试夹具页，非产品面"],
  "pages/login.vue": [
    1,
    "(auth)/login/page.tsx:348 的登录/注册切换链接，上游也手写",
  ],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === ".vue") out.push(p);
  }
  return out;
}

/** 注释剥成等长空白：行号不漂，`<button` 只剩真的开标签。 */
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
  const n = [...strip(readFileSync(file, "utf8")).matchAll(/<button\b/g)]
    .length;
  if (n > 0) counts.set(relative(appDir, file), n);
}

describe("手写 <button> 的分布", () => {
  /* 形状断言：扫挂了的话下面三条会一起静默通过（坑 176/195）。 */
  it("扫到了 markdown/ 那片按契约永远手写的", () => {
    expect(counts.get("components/markdown/MermaidZoomPan.vue")).toBe(3);
    expect(counts.get("components/ui/button/Button.vue")).toBe(1);
  });

  it("没有清单之外的文件在手写 button", () => {
    const unlisted = [...counts.keys()]
      .filter((file) => !(file in ALLOWED))
      .sort();
    expect(
      unlisted,
      "新增手写 button 之前先回上游看那一颗：上游走 Button/ToggleGroup/Select 的，" +
        "本仓也要走同一个 primitive，而不是把文件加进 ALLOWED。",
    ).toEqual([]);
  });

  it("清单里没有过期条目", () => {
    const stale = Object.keys(ALLOWED)
      .filter((file) => !counts.has(file))
      .sort();
    expect(
      stale,
      "这些文件已经没有手写 button 了：从 ALLOWED 里删掉，别留着当「还有活没干」。",
    ).toEqual([]);
  });

  it("每一份的颗数都与清单一致", () => {
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
