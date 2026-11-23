<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue";
import {
  Bot,
  Download,
  MessageSquare,
  Settings2,
  Trash2,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TruncatedTooltip from "./TruncatedTooltip.vue";
import { exportAgentPackage } from "@/core/agents/api";
import { handOffAgentPackageDownload } from "@/core/agents/package-download";
import { buildAgentCardViewModel } from "@/core/agents/presentation";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import type { Agent } from "@/core/agents/types";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";

const props = defineProps<{ agent: Agent; pending?: boolean }>();
const emit = defineEmits<{
  settings: [agent: Agent];
  delete: [agent: Agent];
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const captureOwner = useWorkspaceAsyncOwner();
const view = computed(() => buildAgentCardViewModel(props.agent));
const exporting = ref(false);
const deleteOpen = ref(false);
let exportController: AbortController | undefined;
onScopeDispose(() => exportController?.abort());
async function download() {
  if (exporting.value) return;
  exporting.value = true;
  const isCurrent = captureOwner();
  const name = props.agent.name;
  const controller = new AbortController();
  exportController = controller;
  try {
    const document = await exportAgentPackage(name, {
      signal: controller.signal,
    });
    if (controller.signal.aborted || !isCurrent()) return;
    handOffAgentPackageDownload(document, name);
    toast.success($i18n.t.value.agents.exportSuccess);
  } catch (error) {
    if (controller.signal.aborted || !isCurrent()) return;
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    if (exportController === controller) {
      exporting.value = false;
      exportController = undefined;
    }
  }
}
</script>

<template>
  <Card
    :data-testid="`agent-card-${agent.name}`"
    class="group flex max-w-full min-w-0 flex-col transition-shadow hover:shadow-md"
  >
    <CardHeader class="min-w-0 px-4 pb-3 sm:px-6">
      <div class="flex min-w-0 items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <div
            class="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
          >
            <Bot class="size-5" />
          </div>
          <div class="min-w-0">
            <TruncatedTooltip :text="view.name"
              ><CardTitle class="truncate text-base">{{
                view.name
              }}</CardTitle></TruncatedTooltip
            >
            <TruncatedTooltip v-if="view.model" :text="view.model"
              ><Badge
                variant="secondary"
                class="mt-0.5 block max-w-full truncate text-xs"
                data-testid="agent-model"
                >{{ view.model }}</Badge
              ></TruncatedTooltip
            >
          </div>
        </div>
      </div>
      <TruncatedTooltip v-if="view.description" :text="view.description"
        ><CardDescription class="mt-2 line-clamp-2 text-sm">{{
          view.description
        }}</CardDescription></TruncatedTooltip
      >
    </CardHeader>
    <CardContent
      v-if="view.toolGroups.items.length || view.skills.length"
      class="min-w-0 px-4 pt-0 pb-3 sm:px-6"
      ><div class="flex flex-wrap gap-1">
        <TruncatedTooltip
          v-for="item in view.toolGroups.items"
          :key="item.key"
          :text="item.label"
          ><Badge
            variant="outline"
            class="block max-w-full truncate text-xs"
            data-testid="agent-tool-group"
            >{{ item.label }}</Badge
          ></TruncatedTooltip
        >
        <TruncatedTooltip
          v-for="item in view.skills"
          :key="item.key"
          :text="item.label"
          ><Badge
            variant="secondary"
            class="block max-w-full truncate text-xs"
            data-testid="agent-skill"
            >{{ item.label }}</Badge
          ></TruncatedTooltip
        >
      </div></CardContent
    >
    <CardFooter
      class="mt-auto min-w-0 flex-wrap justify-between gap-2 px-4 pt-3 sm:px-6"
    >
      <NuxtLink
        :to="`/workspace/agents/${encodeURIComponent(agent.name)}/chats/new`"
        :class="
          buttonVariants({
            size: 'sm',
            class: 'h-auto min-h-8 min-w-0 flex-1 whitespace-normal',
          })
        "
        ><MessageSquare class="mr-1.5 size-3.5" />{{
          $i18n.t.value.agents.chat
        }}</NuxtLink
      >
      <div class="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-8 shrink-0"
          :disabled="exporting"
          :title="$i18n.t.value.agents.exportAgent"
          :aria-label="$i18n.t.value.agents.exportAgent"
          @click="download"
          ><Download class="size-3.5"
        /></Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-8 shrink-0"
          :title="$i18n.t.value.agents.settings"
          :aria-label="`${$i18n.t.value.agents.settings}: ${view.name}`"
          @click="emit('settings', agent)"
          ><Settings2 class="size-3.5"
        /></Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="text-destructive hover:text-destructive size-8 shrink-0"
          :title="$i18n.t.value.agents.delete"
          :aria-label="`${$i18n.t.value.agents.delete}: ${view.name}`"
          @click="deleteOpen = true"
          ><Trash2 class="size-3.5"
        /></Button>
      </div>
    </CardFooter>
  </Card>
  <Dialog v-model:open="deleteOpen"
    ><DialogContent :close-label="$i18n.t.value.primitives.close"
      ><DialogHeader
        ><DialogTitle>{{ $i18n.t.value.agents.delete }}</DialogTitle
        ><DialogDescription>{{
          $i18n.t.value.agents.deleteConfirm
        }}</DialogDescription></DialogHeader
      ><DialogFooter
        ><Button
          variant="outline"
          :disabled="pending"
          @click="deleteOpen = false"
          >{{ $i18n.t.value.common.cancel }}</Button
        ><Button
          variant="destructive"
          :disabled="pending"
          @click="emit('delete', agent)"
          >{{
            pending ? $i18n.t.value.common.loading : $i18n.t.value.common.delete
          }}</Button
        ></DialogFooter
      ></DialogContent
    ></Dialog
  >
</template>
