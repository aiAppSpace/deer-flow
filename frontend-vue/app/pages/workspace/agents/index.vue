<script setup lang="ts">
/*
  【文件职责】     通过 Vue Query 列出、编辑和删除 DeerFlow custom agents。
  【架构位置】     L3 application page
  【主要导出】     默认 agents page
  【依赖关系】     useAgents · useModels · workspace features · Agent components
  【边界与注意】   feature ready+enabled 才查询；Vue Query 是唯一 server-state owner。

                   flag 关掉时**整页被替换**，页面外壳（标题、页面说明、新建入口）
                   一起消失——上游把这一支放在 `app/workspace/agents/layout.tsx` 里，
                   于是它天然替换掉整个页面。原先本仓是「外壳照旧 + 内容区塞一段
                   带边框的提示」，两边在可访问性树上因此差了 7 行、几何上差了
                   5 项（居中空态 vs 页面内一段提示）。
*/
import { Plus } from "lucide-vue-next";
import { computed, ref } from "vue";

import { buttonVariants } from "@/components/ui/button";
import AgentCard from "@/components/workspace/agents/AgentCard.vue";
import AgentSettingsDialog from "@/components/workspace/agents/AgentSettingsDialog.vue";
import AgentsFeatureDisabled from "@/components/workspace/agents/AgentsFeatureDisabled.vue";
import { useAgents } from "@/composables/useAgents";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { useModels } from "@/composables/useModels";
import { useAgentsApiEnabled } from "@/composables/useWorkspaceFeatures";
import type { Agent, UpdateAgentRequest } from "@/core/agents/types";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
/*
  两条**成功播报**（上游 agent-card.tsx:124 与 agent-settings-dialog.tsx:120）。
  本仓此前只有失败时的内联 actionError——删掉一个 agent、保存一次设置，
  除了卡片消失/对话框关掉之外没有任何确认。判据是 wave 31 定的那条：
  **一刻发生的事走 toaster，一段时间里为真的事留在页面里**；失败仍然内联，
  它是「这一页现在有问题」的状态。
*/
const toast = useWorkspaceToast();
const features = useAgentsApiEnabled();
const featureEnabled = computed(
  () => features.loaded.value && features.agentsApiEnabled.value,
);
const featureDisabled = computed(
  () => features.loaded.value && !features.agentsApiEnabled.value,
);
const agentCatalog = useAgents({ enabled: featureEnabled });
const editing = ref<Agent | null>(null);
/*
  **模型清单等到对话框真的打开才取**（wave 136）。

  上游把 `useModels()` 放在 `agent-settings-dialog.tsx:58` 里，也就是只有编辑对话框
  挂载时才发这个请求；本仓原来写的是 `enabled: featureEnabled`，**进画廊页就取**。
  wave 135 第一次给这一屏做对照时台账当场报出
  `requestsOnlyVue: GET /api/models`——只是来浏览画廊的人不需要模型清单。

  **没有把 `useModels` 搬进对话框组件**：这份工作区的服务端真相一律由页面/composable
  这一层的 Query 持有（ARCHITECTURE「本工作区没有客户端 store」那一节），
  对话框只收 props，单测也是靠 props 挂载的。改 `enabled` 的谓词就够，
  而且与 `ChatComposer.vue:260`、`AgentChat.vue:187` 的既定写法一致。

  关掉对话框之后查询会重新失效，但 `useModels` 是 `staleTime: Infinity`，
  再打开时直接命中缓存、不会重发。
*/
const modelCatalog = useModels({
  enabled: computed(() => featureEnabled.value && editing.value !== null),
});
const actionError = ref("");

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? `${fallback}: ${error.message}`
    : fallback;
}

const listError = computed(() =>
  agentCatalog.error.value
    ? message(agentCatalog.error.value, $i18n.t.value.agents.loadFailed)
    : "",
);
const modelError = computed(() =>
  modelCatalog.error.value
    ? message(
        modelCatalog.error.value,
        $i18n.t.value.agents.settingsModelsFailed,
      )
    : "",
);
const pending = computed(
  () =>
    agentCatalog.update.isPending.value || agentCatalog.remove.isPending.value,
);

function beginEdit(agent: Agent) {
  editing.value = agent;
  actionError.value = "";
}

async function saveEdit(request: UpdateAgentRequest) {
  if (!editing.value || pending.value) return;
  actionError.value = "";
  try {
    await agentCatalog.update.mutateAsync({ agent: editing.value, request });
    toast.success($i18n.t.value.agents.settingsSaved);
    editing.value = null;
  } catch (cause) {
    actionError.value = message(cause, $i18n.t.value.agents.settingsSaveFailed);
  }
}

async function remove(agent: Agent) {
  if (
    pending.value ||
    !globalThis.confirm($i18n.t.value.agents.deleteConfirm)
  ) {
    return;
  }
  actionError.value = "";
  try {
    await agentCatalog.remove.mutateAsync(agent);
    toast.success($i18n.t.value.agents.deleteSuccess);
  } catch (cause) {
    actionError.value = message(cause, $i18n.t.value.agents.deleteFailed);
  }
}
</script>

<template>
  <AgentsFeatureDisabled v-if="featureDisabled" />
  <div v-else class="size-full">
    <section class="flex size-full flex-col">
      <header class="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $i18n.t.value.agents.title }}
          </h1>
          <p class="text-muted-foreground text-sm">
            {{ $i18n.t.value.agents.description }}
          </p>
        </div>
        <!--
          **样式走 `buttonVariants()`，不是手写一版**（wave 135）。上游那一颗是
          `<Button onClick={handleNewAgent}><PlusIcon className="mr-1.5 h-4 w-4" />…`
          （`agent-gallery.tsx:31`）：default 尺寸 h-9、`text-sm`、**带一个加号图标**。
          手写的 `px-3 py-2` 那一版没有图标、字号也大一档，wave 135 第一次让这一屏
          进取样面时几何档当场报出 `width Δ-22.6 / height Δ4 / fontSize 16px vs 14px`。
          （同一份代码库里 `SkillSettings.vue` 那颗「创建技能」早就记着同一条教训。）

          **元素是 `<a>` 而不是 `<button>`**：这是一个「点了就跳到某个 URL」的控件，
          业界主流写法是链接——可以中键新标签页打开、可以复制链接、读屏器念成链接。
          上游原来那颗 `<Button onClick={router.push}>` 三样都做不到；
          **2026-09-11 上游已按同一条改成 `<Button asChild><Link>`**
          （`agent-gallery.tsx` 的两处入口与 `agent-card.tsx` 的聊天键一起），
          这条翻案判据就是那一轮兑现的，台账上那 4 行随之清零。

          **加了图标之后不要再拿它的文本当对照锚点**：Vue 模板会在 `<Plus />` 与插值之间
          留一个空白文本节点，`textContent` 是 `" New Agent "`，而上游 JSX 里图标与文字
          紧挨着；**Playwright 的 `getByText` 用正则时不做空白归一**，于是同一条锚点
          在本仓这一侧等不到、在上游那一侧照常匹配（wave 135 实测）。手动挤掉那个空白
          会被 `prettier --write` 格式化回来。**可访问名不受影响**（两边都是 `New Agent`），
          所以场景那边改用 `role: "heading"` 的锚点，这里保持惯用写法。
        -->
        <NuxtLink
          v-if="featureEnabled"
          to="/workspace/agents/new"
          :class="buttonVariants()"
        >
          <Plus class="mr-1.5 size-4" />
          {{ $i18n.t.value.agents.newAgent }}
        </NuxtLink>
      </header>
      <div class="flex-1 overflow-y-auto p-6">
        <!--
          加载占位是一个**居中的 h-40 盒子**，不是左上角一行字：上游
          `frontend/src/components/workspace/agents/agent-gallery.tsx:40` 是
          `<div className="text-muted-foreground flex h-40 items-center justify-center text-sm">`。
          wave 135 第一次让这一屏进取样面，几何档当场报出
          `height React=160 Vue=24 Δ-136` 与 `fontSize React=14px Vue=16px`。

          **`role="status"` 与那条更具体的文案**（`agents.loading`「正在加载智能体…」）
          原来只有本仓有：上游是一个没有 role 的 `<div>` 加通用的 `t.common.loading`，
          读屏器既听不到「在加载」，也听不出在加载什么。**2026-09-11 两边同改**，
          上游补了 `role="status"` 与同名的 `agents.loading`。
        -->
        <p
          v-if="!features.loaded.value || agentCatalog.loading.value"
          role="status"
          class="text-muted-foreground flex h-40 items-center justify-center text-sm"
        >
          {{ $i18n.t.value.agents.loading }}
        </p>
        <p
          v-if="listError || (!editing && actionError)"
          role="alert"
          class="mb-4 text-sm text-red-600"
        >
          {{ listError || actionError }}
        </p>
        <div
          v-if="featureEnabled && !agentCatalog.loading.value && !listError"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AgentCard
            v-for="agent in agentCatalog.agents.value"
            :key="agent.name"
            :agent="agent"
            :pending="pending"
            @settings="beginEdit"
            @delete="remove"
          />
          <div
            v-if="agentCatalog.agents.value.length === 0"
            class="text-muted-foreground col-span-full rounded-xl border p-8 text-center"
          >
            <strong class="text-foreground block">{{
              $i18n.t.value.agents.emptyTitle
            }}</strong>
            {{ $i18n.t.value.agents.emptyDescription }}
          </div>
        </div>
      </div>
    </section>

    <AgentSettingsDialog
      v-if="editing"
      :agent="editing"
      :models="modelCatalog.models.value"
      :models-loading="modelCatalog.loading.value"
      :model-error="modelError"
      :pending="agentCatalog.update.isPending.value"
      :submit-error="actionError"
      @cancel="editing = null"
      @save="saveEdit"
    />
  </div>
</template>
