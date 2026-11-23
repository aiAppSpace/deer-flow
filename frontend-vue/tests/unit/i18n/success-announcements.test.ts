/*
  【文件职责】     钉住「写操作成功了要说一句」这一簇，逐处对着上游的 toast。
  【架构位置】     测试（只读源码，不挂载）
  【主要导出】     无
  【依赖关系】     五个产品文件的源码
  【边界与注意】   **不能只靠 i18n 基线兜底。** 直觉上「把 toast 删掉，那条 key 就回到
                   unused 集，`make i18n-unused` 会红」——**对叶子名撞车的 key 不成立**
                   （线索 148）。wave 34 的负向验证当场抓到三条假绿：
                   `settings.memory.exportSuccess` 被 `common.exportSuccess` 遮蔽；
                   `agents.deleteSuccess` 与 `sidecar.deleteSuccess` **互相**遮蔽——
                   删掉任何一处，另一处还活着，unused 集纹丝不动。

                   所以这一簇要有自己的守卫。行为层面的验收在
                   `tests/unit/settings/settings-components.dom.test.ts`（memory 两处）
                   与 `tests/unit/chat/citation-copy-feedback.dom.test.ts`（复制两支）；
                   这里钉的是**每一处都还在**，挂载那几个页面的代价远大于收益。

                   **对照台账天生看不见这一簇**：settings 的七个面板里只有
                   `settings-notification` 有合法的场景 id，agents 列表页、sidecar 删除、
                   artifact 保存都要先写一次后端状态才走得到（第①与第⑥类）。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

function sourceOf(relative: string) {
  return readFileSync(
    fileURLToPath(new URL(`../../../${relative}`, import.meta.url)),
    "utf8",
  ).replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** 每一行都对着上游的一处 `toast.success` / `toast.error`。 */
const SITES: { file: string; upstream: string; call: string }[] = [
  {
    file: "app/components/workspace/settings/MemorySettings.vue",
    upstream: "memory-settings-page.tsx:396",
    call: "toast.success(t.value.settings.memory.exportSuccess)",
  },
  {
    file: "app/components/workspace/settings/MemorySettings.vue",
    upstream: "memory-settings-page.tsx:435",
    call: "toast.success(t.value.settings.memory.importSuccess)",
  },
  {
    file: "app/components/workspace/settings/MemorySettings.vue",
    upstream: "memory-settings-page.tsx:445",
    call: "toast.success(t.value.settings.memory.clearAllSuccess)",
  },
  {
    file: "app/components/workspace/settings/MemorySettings.vue",
    upstream: "memory-settings-page.tsx:457",
    call: "toast.success(t.value.settings.memory.factDeleteSuccess)",
  },
  {
    file: "app/components/workspace/settings/MemorySettings.vue",
    upstream: "memory-settings-page.tsx:510",
    call: "t.value.settings.memory.editFactSuccess",
  },
  {
    file: "app/components/workspace/settings/MemorySettings.vue",
    upstream: "memory-settings-page.tsx:513",
    call: "t.value.settings.memory.addFactSuccess",
  },
  {
    file: "app/pages/workspace/agents/index.vue",
    upstream: "agent-card.tsx:124",
    call: "toast.success($i18n.t.value.agents.deleteSuccess)",
  },
  {
    file: "app/pages/workspace/agents/index.vue",
    upstream: "agent-settings-dialog.tsx:120",
    call: "toast.success($i18n.t.value.agents.settingsSaved)",
  },
  {
    file: "app/components/workspace/artifacts/ArtifactPanel.vue",
    upstream: "artifact-file-detail.tsx:333",
    call: "toast.success($i18n.t.value.artifactEditing.saved)",
  },
  {
    file: "app/components/workspace/sidecar/SidecarPanel.vue",
    upstream: "sidecar-panel.tsx:511",
    call: "toast.success($i18n.t.value.sidecar.deleteSuccess)",
  },
  {
    file: "app/components/chat/CitationSourceCopyButton.vue",
    upstream: "citation-sources-panel.tsx:105",
    call: "toast.success($i18n.t.value.clipboard.copiedToClipboard)",
  },
  {
    file: "app/components/chat/CitationSourceCopyButton.vue",
    upstream: "citation-sources-panel.tsx:100",
    call: "toast.error($i18n.t.value.clipboard.failedToCopyToClipboard)",
  },
];

describe("写操作成功要说一句", () => {
  it.each(SITES)("$file 还带着对应 $upstream 的那条播报", ({ file, call }) => {
    expect(
      sourceOf(file),
      `少了 ${call} —— 这一处成功之后用户看不到任何确认。`,
    ).toContain(call);
  });
});
