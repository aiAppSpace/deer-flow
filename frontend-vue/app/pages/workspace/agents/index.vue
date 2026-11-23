<script setup lang="ts">
/*
  【文件职责】     通过 Vue Query 列出、编辑和删除 DeerFlow custom agents。
  【架构位置】     L3 application page
  【主要导出】     默认 agents page
  【依赖关系】     useAgents · useModels · Agent components
  【边界与注意】   agents.vue 父路由独占能力门禁，允许后才挂载目录；
                   Vue Query 是唯一 server-state owner。能力撤销会卸载整个目录，
                   包括导入和设置对话框，不在目录再建一个 feature observer。
*/
import { Bot, Plus, Upload } from "lucide-vue-next";
import { computed, ref } from "vue";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AgentCard from "@/components/workspace/agents/AgentCard.vue";
import AgentSettingsDialog from "@/components/workspace/agents/AgentSettingsDialog.vue";
import { useAgents } from "@/composables/useAgents";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { useModels } from "@/composables/useModels";
import type { Agent, UpdateAgentRequest } from "@/core/agents/types";
import { packageSuggestedName } from "@/core/agents/package-download";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";

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
const captureOwner = useWorkspaceAsyncOwner();
const agentCatalog = useAgents({ enabled: true });
const editing = ref<Agent | null>(null);
/*
  **模型清单等到对话框真的打开才取**（wave 136）。

  上游把 `useModels()` 放在 `agent-settings-dialog.tsx:58` 里，也就是只有编辑对话框
  挂载时才发这个请求；父路由允许目录挂载不代表用户已经打开编辑。
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
  enabled: computed(() => editing.value !== null),
});
const actionError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const packageDocument = ref<unknown>(null);
const importName = ref("");
let importGeneration = 0;
function closeImport() {
  importGeneration++;
  packageDocument.value = null;
  importName.value = "";
}
async function importFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  const generation = ++importGeneration;
  const ownsWorkspace = captureOwner();
  const isCurrent = () => ownsWorkspace() && generation === importGeneration;
  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isCurrent()) return;
    packageDocument.value = parsed;
    importName.value = packageSuggestedName(parsed);
  } catch {
    if (!isCurrent()) return;
    toast.error($i18n.t.value.agents.importInvalidFile);
  }
}
async function importPackage() {
  if (
    packageDocument.value === null ||
    agentCatalog.importPackage.isPending.value
  )
    return;
  const generation = importGeneration;
  const ownsWorkspace = captureOwner();
  const isCurrent = () => ownsWorkspace() && generation === importGeneration;
  try {
    await agentCatalog.importPackage.mutateAsync({
      agentPackage: packageDocument.value,
      name: importName.value.trim() || undefined,
    });
    if (!isCurrent()) return;
    toast.success($i18n.t.value.agents.importSuccess);
    closeImport();
  } catch (error) {
    if (!isCurrent()) return;
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

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
  const isCurrent = captureOwner();
  try {
    await agentCatalog.update.mutateAsync({ agent: editing.value, request });
    if (!isCurrent()) return;
    toast.success($i18n.t.value.agents.settingsSaved);
    editing.value = null;
  } catch (cause) {
    if (!isCurrent()) return;
    actionError.value = message(cause, $i18n.t.value.agents.settingsSaveFailed);
  }
}

async function remove(agent: Agent) {
  if (pending.value) {
    return;
  }
  actionError.value = "";
  const isCurrent = captureOwner();
  try {
    await agentCatalog.remove.mutateAsync(agent);
    if (!isCurrent()) return;
    toast.success($i18n.t.value.agents.deleteSuccess);
  } catch (cause) {
    if (!isCurrent()) return;
    actionError.value = message(cause, $i18n.t.value.agents.deleteFailed);
  }
}
</script>

<template>
  <div class="size-full">
    <section class="flex size-full flex-col">
      <header
        class="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6"
      >
        <div class="min-w-0">
          <h1 class="text-xl font-semibold">
            {{ $i18n.t.value.agents.title }}
          </h1>
          <p class="text-muted-foreground mt-0.5 text-sm">
            {{ $i18n.t.value.agents.description }}
          </p>
        </div>
        <!--
          **样式走 `buttonVariants()`，不是手写一版**（wave 135）。上游那一颗是
          `<Button onClick={handleNewAgent}><PlusIcon className="mr-1.5 h-4 w-4" />…`
          （`agent-gallery.tsx:31`）：default 尺寸 h-9、`text-sm`、**带一个加号图标**。
          手写的 `px-3 py-2` 那一版没有图标、字号也大一档，wave 135 第一次让这一屏
          进取样面时几何档当场报出 `width Δ-22.6 / height Δ4 / fontSize 16px vs 14px`。

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
        <div class="flex max-w-full flex-wrap items-center gap-2">
          <input
            ref="fileInput"
            class="hidden"
            type="file"
            accept="application/json,.json"
            @change="importFile"
          />
          <Button variant="outline" @click="fileInput?.click()"
            ><Upload class="mr-1.5 size-4" />{{
              $i18n.t.value.agents.importAgent
            }}</Button
          >
          <NuxtLink to="/workspace/agents/new" :class="buttonVariants()">
            <Plus class="mr-1.5 size-4" />
            {{ $i18n.t.value.agents.newAgent }}
          </NuxtLink>
        </div>
      </header>
      <div class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
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
          v-if="agentCatalog.loading.value"
          role="status"
          class="text-muted-foreground flex h-40 items-center justify-center text-sm"
        >
          {{ $i18n.t.value.agents.loading }}
        </p>
        <p
          v-if="listError || (!editing && actionError)"
          role="alert"
          class="text-destructive mb-4 text-sm"
        >
          {{ listError || actionError }}
        </p>
        <div
          v-if="
            !agentCatalog.loading.value &&
            !listError &&
            !agentCatalog.agents.value.length
          "
          class="flex h-64 flex-col items-center justify-center gap-3 text-center"
        >
          <div
            class="bg-muted flex size-14 items-center justify-center rounded-full"
          >
            <Bot class="text-muted-foreground size-7" />
          </div>
          <div>
            <p class="font-medium">{{ $i18n.t.value.agents.emptyTitle }}</p>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ $i18n.t.value.agents.emptyDescription }}
            </p>
          </div>
          <NuxtLink
            to="/workspace/agents/new"
            :class="buttonVariants({ variant: 'outline', class: 'mt-2' })"
            ><Plus class="mr-1.5 size-4" />{{
              $i18n.t.value.agents.newAgent
            }}</NuxtLink
          >
        </div>
        <div
          v-if="!agentCatalog.loading.value && !listError"
          class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AgentCard
            v-for="agent in agentCatalog.agents.value"
            :key="agent.name"
            :agent="agent"
            :pending="pending"
            @settings="beginEdit"
            @delete="remove"
          />
        </div>
      </div>
    </section>

    <Dialog
      :open="packageDocument !== null"
      @update:open="!$event && closeImport()"
      ><DialogContent :close-label="$i18n.t.value.primitives.close"
        ><DialogHeader
          ><DialogTitle>{{ $i18n.t.value.agents.importTitle }}</DialogTitle
          ><DialogDescription>{{
            $i18n.t.value.agents.importDescription
          }}</DialogDescription></DialogHeader
        >
        <div class="grid gap-2">
          <label for="agent-import-name" class="text-sm font-medium">{{
            $i18n.t.value.agents.importName
          }}</label
          ><Input
            id="agent-import-name"
            v-model="importName"
            :placeholder="$i18n.t.value.agents.nameStepPlaceholder"
          />
        </div>
        <DialogFooter
          ><Button
            variant="outline"
            :disabled="agentCatalog.importPackage.isPending.value"
            @click="closeImport"
            >{{ $i18n.t.value.common.cancel }}</Button
          ><Button
            :disabled="
              agentCatalog.importPackage.isPending.value ||
              !importName.trim().length
            "
            @click="importPackage"
            >{{
              agentCatalog.importPackage.isPending.value
                ? $i18n.t.value.common.loading
                : $i18n.t.value.agents.importAgent
            }}</Button
          ></DialogFooter
        ></DialogContent
      ></Dialog
    >

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
