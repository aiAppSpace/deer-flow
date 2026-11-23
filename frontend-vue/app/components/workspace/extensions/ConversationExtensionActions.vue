<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCapabilityUser } from "@/composables/useCapabilities";
import {
  useExtensionOwner,
  useFrontendExtensions,
  useFrontendServices,
} from "@/composables/useFrontendExtensions";
import { resolveConversationActions } from "@/core/extensions/actions";
import type {
  ConversationAction,
  ConversationActionContext,
  FrontendContribution,
} from "@/core/extensions/contracts";
import {
  activeFrontendExtensions,
  extensionIcon,
} from "@/core/extensions/registry";
import { bindFrontendServices } from "@/core/extensions/services";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = withDefaults(
  defineProps<{
    context: ConversationActionContext;
    placement?: "toolbar" | "menu";
    owner?: ReturnType<typeof useExtensionOwner>;
  }>(),
  { placement: "toolbar", owner: undefined },
);
const { $i18n } = useNuxtApp();
const user = useCapabilityUser();
const query = useFrontendExtensions();
const services = useFrontendServices();
const toast = useWorkspaceToast();
const busy = ref(false);
const scope = computed(() => [
  props.context.thread.thread_id,
  user.value?.id,
  query.data.value,
  $i18n.locale.value,
]);
const fallbackOwner = useExtensionOwner(scope);
watch(
  scope,
  () => {
    busy.value = false;
  },
  { flush: "sync" },
);
const groups = computed(() =>
  props.context.messages?.length === 0
    ? []
    : activeFrontendExtensions(
        query.isError.value ? [] : (query.data.value ?? []),
      )
        .filter(({ contribution }) => contribution.viewer_id === user.value?.id)
        .flatMap(({ contribution, extension }) => {
          const group = resolveConversationActions(
            extension,
            contribution,
            $i18n.t.value,
            $i18n.locale.value,
          );
          return group ? [{ contribution, group }] : [];
        }),
);
async function execute(
  action: ConversationAction,
  contribution: FrontendContribution,
) {
  if (busy.value || contribution.viewer_id !== user.value?.id) return;
  const current = (props.owner ?? fallbackOwner).capture();
  const context = { ...props.context };
  busy.value = true;
  try {
    current.assertCurrent();
    await action.execute(
      context,
      bindFrontendServices(
        services,
        contribution,
        current.signal,
        current.isCurrent,
      ),
    );
  } catch {
    if (current.isCurrent()) toast.error($i18n.t.value.extensions.actionFailed);
  } finally {
    if (current.isCurrent()) busy.value = false;
  }
}
</script>

<template>
  <template v-for="item in groups" :key="item.contribution.namespace">
    <DropdownMenuSub v-if="placement === 'menu'">
      <DropdownMenuSubTrigger>
        <component
          :is="extensionIcon(item.group.icon)"
          class="text-muted-foreground"
        />
        <span>{{ item.group.label }}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem
          v-for="action in item.group.actions"
          :key="action.id"
          :disabled="busy"
          @select="execute(action, item.contribution)"
        >
          <component
            :is="extensionIcon(action.icon)"
            class="text-muted-foreground"
          />
          <span>{{ action.label }}</span>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenu v-else>
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              :aria-label="item.group.label"
              class="text-muted-foreground hover:text-foreground"
              variant="ghost"
              :disabled="busy"
            >
              <component :is="extensionIcon(item.group.icon)" />
              <span class="hidden sm:inline">{{ item.group.label }}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{{ item.group.label }}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          v-for="action in item.group.actions"
          :key="action.id"
          :disabled="busy"
          @select="execute(action, item.contribution)"
        >
          <component
            :is="extensionIcon(action.icon)"
            class="text-muted-foreground"
          />
          <span>{{ action.label }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </template>
</template>
