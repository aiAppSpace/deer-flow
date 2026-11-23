<script setup lang="ts">
import { computed } from "vue";
import {
  Copy,
  Download,
  Loader,
  Package,
  Pencil,
  PencilOff,
  RotateCcw,
  Save,
  SquareArrowOutUpRight,
} from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const props = withDefaults(
  defineProps<{
    canEdit: boolean;
    editing: boolean;
    dirty: boolean;
    conflict: boolean;
    streaming: boolean;
    saving: boolean;
    canCopy: boolean;
    copyDisabled: boolean;
    canOpen: boolean;
    canDownload: boolean;
    canInstall: boolean;
    installing: boolean;

    savedVersionHint?: boolean;
  }>(),
  { savedVersionHint: false },
);
const { $i18n } = useNuxtApp();

function gatewayTooltip(fallback: string): string {
  return props.savedVersionHint
    ? $i18n.t.value.artifactTable.savedVersion
    : fallback;
}

const saveLabel = computed(() =>
  props.streaming
    ? $i18n.t.value.artifactEditing.runInProgress
    : props.conflict
      ? $i18n.t.value.artifactEditing.conflict
      : $i18n.t.value.common.save,
);
const emit = defineEmits<{
  edit: [];
  save: [];
  exit: [];
  discard: [];
  copy: [];
  open: [];
  download: [];
  install: [];
}>();
</script>

<template>
  <Tooltip v-if="canEdit && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.edit"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        :disabled="streaming"
        @click="emit('edit')"
      >
        <Pencil :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ $i18n.t.value.common.edit }}</TooltipContent>
  </Tooltip>
  <template v-if="editing">
    <Tooltip>
      <TooltipTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="saveLabel"
          class="text-muted-foreground hover:text-foreground size-8 p-0"
          :disabled="streaming || saving || !dirty || conflict"
          @click="emit('save')"
        >
          <Loader v-if="saving" :size="16" class="animate-spin" />
          <Save v-else :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ saveLabel }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="$i18n.t.value.artifactEditing.exit"
          class="text-muted-foreground hover:text-foreground size-8 p-0"
          :disabled="saving"
          @click="emit('exit')"
        >
          <PencilOff :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ $i18n.t.value.artifactEditing.exit }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="$i18n.t.value.artifactEditing.discard"
          class="text-muted-foreground hover:text-foreground size-8 p-0"
          :disabled="saving"
          @click="emit('discard')"
        >
          <RotateCcw :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{
        $i18n.t.value.artifactEditing.discard
      }}</TooltipContent>
    </Tooltip>
  </template>

  <Tooltip v-if="canInstall && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.install"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        :disabled="installing"
        @click="emit('install')"
      >
        <Package :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      $i18n.t.value.toolCalls.skillInstallTooltip
    }}</TooltipContent>
  </Tooltip>
  <Tooltip v-if="canOpen && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.openInNewWindow"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        @click="emit('open')"
      >
        <SquareArrowOutUpRight :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      gatewayTooltip($i18n.t.value.common.openInNewWindow)
    }}</TooltipContent>
  </Tooltip>

  <Tooltip v-if="canCopy && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :disabled="copyDisabled"
        :aria-label="$i18n.t.value.clipboard.copyToClipboard"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        @click="emit('copy')"
      >
        <Copy :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      $i18n.t.value.clipboard.copyToClipboard
    }}</TooltipContent>
  </Tooltip>
  <Tooltip v-if="canDownload && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.download"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        @click="emit('download')"
      >
        <Download :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      gatewayTooltip($i18n.t.value.common.download)
    }}</TooltipContent>
  </Tooltip>
</template>
