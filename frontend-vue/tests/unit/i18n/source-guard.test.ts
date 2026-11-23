/*
  【文件职责】     固定Vue SFC 用户可见英文 source guard 与精确豁免边界。
  【架构位置】     tooling unit test
  【主要导出】     无；Vitest cases
  【依赖关系】     scripts/lib/i18n-source-guard.mjs
  【边界与注意】   只豁免动态 backend/user/code/file/URL/协议值和明确测试 fixture。
*/

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  productVueInventory,
  scanProductVueFiles,
  scanVueSource,
} from "../../../scripts/lib/i18n-source-guard.mjs";

const checkoutRoot = fileURLToPath(new URL("../../../", import.meta.url));
const testFixtureFiles = [
  "app/pages/__m0/splitpanes.vue",
  "app/pages/__m0/visual.vue",
  // A compiled stable-slot caller is required to exercise real Presence ref lifetime.
  "tests/unit/ui/fixtures/stable-overlay.fixture.vue",
];

// 从 Git 的实际 checkout 独立枚举，不借用扫描器的目录白名单或 fixture 前缀。
// 新增 SFC 自动进入集合；漏扫、重复、等数量替换都必须失败。
function checkoutVueFiles() {
  return execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "*.vue",
    ],
    { cwd: checkoutRoot, encoding: "utf8" },
  )
    .split("\0")
    .filter((file) => file && existsSync(join(checkoutRoot, file)))
    .sort();
}

describe("i18n source guard", () => {
  it("detects template text, accessible attributes and UI-bound script fallbacks", () => {
    const issues = scanVueSource(
      `
<script setup lang="ts">
const error = ref("")
error.value = "Could not save artifact"
const statusLabel = computed(() => "Loading workspace")
const currentTitle = computed(() => "New Chat")
function toolLabel() { return "Write file" }
function failDemo() { throw new Error("Demo is unavailable") }
</script>
<template>
  <button aria-label="Save artifact">Save artifact</button>
  <p>{{ error }}</p><output>{{ statusLabel }}</output>
  <h2 :title="ready ? 'Open report' : request.title">
    {{ request.title ?? "Clarification" }}
  </h2>
</template>`,
      "app/components/workspace/Fixture.vue",
    );
    expect(issues.map((issue: { text: string }) => issue.text)).toEqual(
      expect.arrayContaining([
        "Could not save artifact",
        "Clarification",
        "Demo is unavailable",
        "Loading workspace",
        "New Chat",
        "Open report",
        "Save artifact",
        "Write file",
      ]),
    );
  });

  it("does not translate dynamic backend, user, code, filename, URL, protocol or test-id values", () => {
    const issues = scanVueSource(
      `
<script setup lang="ts">
const method = "POST"
const contentType = "application/json"
const eventName = "task_started"
const route = "/api/threads/demo"
const errorCode = "permission_denied"
</script>
<template>
  <pre>{{ code }}</pre>
  <span>SKILL.md</span><span>.skill</span><span>1 MiB</span>
  <input placeholder="https://api.example.com/v1" />
  <p>{{ backendError.detail }}</p>
  <p>{{ user.content }}</p>
  <span :title="file.name">{{ file.name }}</span>
  <a :href="url">{{ url }}</a>
  <div data-testid="English-is-not-copy" />
</template>`,
      "app/components/workspace/DynamicFixture.vue",
    );
    expect(issues).toEqual([]);
  });

  it("keeps the full product Vue surface free of untranslated core English", () => {
    const inventory = productVueInventory();
    expect(inventory.checked).toEqual(
      checkoutVueFiles().filter((file) => !testFixtureFiles.includes(file)),
    );
    expect(inventory.checked).toContain("app/app.vue");
    expect(inventory.checked).toContain(
      "app/components/workspace/ProjectAffiliationBadge.vue",
    );
    expect(inventory.checked).toContain(
      "app/components/chat/AssistantTurnActions.vue",
    );
    expect(inventory.checked).toContain(
      "app/components/chat/ComposerAttachmentChip.vue",
    );
    expect(inventory.checked).toContain(
      "app/components/chat/ComposerModelSelector.vue",
    );
    expect(inventory.checked).toContain(
      "app/components/chat/ComposerSurface.vue",
    );
    expect(inventory.checked).toEqual(
      expect.arrayContaining([
        "app/components/chat/ProcessingMessageGroup.vue",
        "app/components/chat/ProcessingTokenSummary.vue",
        "app/components/chat/ProcessingToolStep.vue",
        "app/components/chat/ReasoningDisclosure.vue",
        "app/components/chat/RunActivity.vue",
      ]),
    );
    // UI primitive 层同样在扫描面内。primitive 不持有产品文案——关闭按钮、
    // placeholder 之类的可访问名字一律由调用方传入——所以它们必须是被检查的，
    // 而不是被豁免的。
    expect(inventory.checked).toEqual(
      expect.arrayContaining([
        "app/components/ui/alert-dialog/AlertDialogContent.vue",
        "app/components/ui/code-block/CodeBlock.vue",
        "app/components/ui/command/CommandInput.vue",
        "app/components/ui/dialog/DialogContent.vue",
        "app/components/ui/dropdown-menu/DropdownMenuContent.vue",
        "app/components/ui/popover/PopoverContent.vue",
        "app/components/ui/select/SelectTrigger.vue",
        "app/components/ui/sheet/SheetContent.vue",
        "app/components/ui/switch/Switch.vue",
        "app/components/ui/tabs/TabsTrigger.vue",
        "app/components/ui/tooltip/TooltipContent.vue",
      ]),
    );
    expect(inventory.excludedTestFixtures).toEqual(testFixtureFiles);
    expect(scanProductVueFiles()).toEqual([]);
    /*
      全量产品 SFC 都必须经过 AST 文案扫描，成本随实际文件数增长。
      保留原有 15 秒预算；集合比较不代替文案扫描，也不扩大扫描豁免。
    */
  }, 15_000);

  /*
    目录白名单之外的 SFC 也必须有明确扫描归属。
    独立 checkout 集合校验之外，保留生产 inventory 的 unscanned 诊断合同。
  */
  it("checkout 里没有任何 .vue 落在扫描面之外", () => {
    expect(
      productVueInventory().unscanned,
      "这些 .vue 不在 PRODUCT_ROOTS/PRODUCT_ENTRY_FILES 覆盖范围里，" +
        "所以从来没有被扫过：把它们所在的目录加进 PRODUCT_ROOTS，" +
        "或者说清楚为什么它不是产品 UI。",
    ).toEqual([]);
  });
});
