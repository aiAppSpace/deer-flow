/*
  【文件职责】     钉住聊天头部的构成：两态 class 的合并方式、右侧分组容器、标题层。
  【架构位置】     L3 单元测试（只读源码，不挂载）
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/AgentChat.vue
  【边界与注意】   几何本身由 e2e-parity 的 browser-feature 场景钉着（browser-trigger
                   的 x 直接受右侧那排控件的宽度支配）。这里补的是几何看不见的四件事：

                   1. 两态 class 必须走一个 cn()。写成 `class` + `:class` 两个属性时
                      `bg-background/80` 与 `bg-background/0` 会同时留在 class 上，
                      赢家由样式表顺序决定而不是模板顺序——同一份模板在不同的样式
                      产物里会画出不同的东西。
                   2. 右侧控件的分组容器。普通聊天沿用上游 gap-2；Agent 页沿用上游
                      的无 gap + sm:mr-4，避免 200% 文本缩放时额外挤掉 24px 主面板。
                      两路都必须保持 shrink-0，标题变长时只能缩标题。
                   3. 标题走 FlipDisplay，与上游 ThreadTitle 同构。
                   4. 会话页真的挂了 useHead——本仓此前一个都不设，标签页永远停在
                      根标题。

                   只读源码：挂载 AgentChat 要连上 stream/threads/query 一整套，
                   代价远大于它能多钉住的东西，而这四条都是模板里的结构事实。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const raw = readFileSync(
  new URL("../../../app/components/chat/AgentChat.vue", import.meta.url),
  "utf8",
);

/*
  注释先剥掉再比对。这里钉的每一条结构在文件里都**同时**出现在解释它的注释里
  （注释就是在讲那个 class 串），不剥的话把模板改坏了守卫照样绿——
  「负向验证跑出绿，第一嫌疑是自己没改到」的同一个坑，换了个地方。
*/
const source = raw
  .replaceAll(/<!--[\s\S]*?-->/g, "")
  .replaceAll(/\/\*[\s\S]*?\*\//g, "");

const headerTag = source.slice(
  source.indexOf("<header"),
  source.indexOf(">", source.indexOf("<header")) + 1,
);

describe("chat header composition", () => {
  it("binds the header class through a single cn() computed", () => {
    expect(headerTag).toBe('<header :class="headerClass">');
    // 静态 class 与动态 :class 并存 = 冲突类由样式表顺序决胜。
    expect(headerTag).not.toContain(" class=");
    expect(source).toContain("const headerClass = computed(() =>");
  });

  it("keeps the header at the upstream stacking level", () => {
    // 上游 chat-page.tsx 是 z-30；z-40 会把头部压到面板那一档之上。
    expect(source).toMatch(/z-30 flex h-12 shrink-0 items-center gap-2/);
    expect(source).not.toContain("z-40 flex h-12");
  });

  it("keeps the right controls non-shrinking with route-specific spacing", () => {
    expect(source).toMatch(
      /<div\s+class="flex shrink-0 items-center [^"]*"\s+:class="agentName \? 'sm:mr-4' : 'gap-2'"\s*>/,
    );
    expect(source).toContain("max-[361px]:min-w-0 max-[361px]:flex-1");
    expect(source).toContain("max-[361px]:shrink");
    // 不能退回普通页和 Agent 页共享静态 gap；它曾令 Agent 主面板在 200% 下多裁 24px。
    expect(source).not.toContain(
      '<div class="flex shrink-0 items-center gap-2">',
    );
  });

  it("names the browser tab after the thread", () => {
    // helper 存在不等于用上了：这条钉的是会话页真的挂了 useHead。
    expect(source).toContain("useHead(() => ({");
    expect(source).toContain("documentTitleOfThread({");
    expect(source).toContain("isLoading: stream.isHistoryLoading.value,");
  });

  it("renders the thread title through FlipDisplay", () => {
    expect(source).toContain(
      '<div class="flex min-w-0 flex-1 items-center text-sm font-medium">',
    );
    expect(source).toMatch(/<FlipDisplay\s+v-if="headerTitle"/);
  });
});

/*
  只读案例页（`demo` prop → isDemo）上头部该有什么。

  **对照台账看不到这一屏**：每个对照场景都是可写的工作区会话，而 /showcase/<id>
  没有同名的 React spec 文件，进不了取样面（线索 107）。所以这几条只能在这里钉。

  判据一律是「上游那一处有没有 isMock 判据」——上游 chat-page.tsx 把只读案例页
  当成**功能受限的工作区**：导出、用量指示器都照画，写入路径才关掉。
*/
describe("read-only showcase header", () => {
  it("does not gate the export trigger on demo mode", () => {
    // 上游 chat-page.tsx:312 是裸的 <ExportTrigger threadId={threadId} />。
    expect(source).toMatch(
      /<ExportTrigger\s+v-if="routeThreadId && currentThread && !isWelcomeMode"/,
    );
  });

  it("does not gate the usage indicators on demo mode", () => {
    // 上游是 `tokenUsageEnabled ? <TokenUsageIndicator/> : <ContextUsageBadge/>`。
    expect(source).toMatch(
      /<TokenUsageIndicator\s+v-if="modelCatalog\.tokenUsageEnabled\.value"/,
    );
    expect(source).toContain(
      '<ContextUsageBadge v-else :context-usage="contextUsage" />',
    );
  });

  it("fetches the model catalogue on the showcase page too", () => {
    /*
      上游 chat-page.tsx:77 是裸的 useModels()。关掉它不只是少一个请求：
      tokenUsageEnabled 恒为 false，用量指示器整条分支就再也走不到。
    */
    expect(source).toContain("const modelCatalog = useModels();");
    expect(source).not.toContain("useModels({ enabled:");
  });

  it("keeps the sidebar trigger and scheduled-tasks link out of demo mode", () => {
    // 这两条上游**确实**有 isMock 判据，不要顺手一起放开。
    expect(source).toMatch(/<SidebarTrigger\s+v-if="!isDemo"/);
    expect(source).toContain('v-if="routeThreadId && !agentName && !isDemo"');
  });
});
