<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { Download, FileArchive, Loader } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadSkillExport,
  handOffSkillDownload,
  loadSkillExportManifest,
  SkillExportRequestError,
  type SkillExportManifest,
} from "@/core/skills/export";
const props = defineProps<{ name: string }>();
const emit = defineEmits<{ close: [] }>();
const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.settings.skills);
const captureOwner = useWorkspaceAsyncOwner();
const manifest = ref<SkillExportManifest | null>(null);
const phase = ref<"loading" | "ready" | "downloading" | "done" | "error">(
  "loading",
);
const error = ref<unknown>(null);
const visible = ref(0);
let active: AbortController | undefined;
let downloading = false;
let mounted = false;
async function load() {
  const isCurrent = captureOwner();
  active?.abort();
  const controller = new AbortController();
  active = controller;
  manifest.value = null;
  error.value = null;
  phase.value = "loading";
  visible.value = 0;
  try {
    const result = await loadSkillExportManifest(props.name, controller.signal);
    if (controller.signal.aborted || active !== controller || !isCurrent())
      return;
    manifest.value = result;
    phase.value = "ready";
  } catch (cause) {
    if (controller.signal.aborted || active !== controller || !isCurrent())
      return;
    error.value = cause;
    phase.value = "error";
  }
}
onMounted(() => {
  mounted = true;
  void load();
});
watch(
  () => props.name,
  () => {
    if (mounted) void load();
  },
);
onScopeDispose(() => {
  active?.abort();
  mounted = false;
});
function close() {
  active?.abort();
  emit("close");
}
const changed = computed(
  () =>
    error.value instanceof SkillExportRequestError &&
    error.value.status === 409,
);
const downloadDisabled = computed(
  () =>
    phase.value === "downloading" ||
    changed.value ||
    (error.value instanceof SkillExportRequestError &&
      error.value.status === 403),
);
async function download() {
  if (
    !manifest.value?.revision ||
    !manifest.value.can_export ||
    downloading ||
    downloadDisabled.value
  )
    return;
  downloading = true;
  const isCurrent = captureOwner();
  active?.abort();
  const controller = new AbortController();
  active = controller;
  const name = props.name;
  const revision = manifest.value.revision;
  error.value = null;
  phase.value = "downloading";
  try {
    const blob = await downloadSkillExport(name, revision, controller.signal);
    if (controller.signal.aborted || active !== controller || !isCurrent())
      return;
    handOffSkillDownload(blob, name);
    phase.value = "done";
  } catch (cause) {
    if (controller.signal.aborted || active !== controller || !isCurrent())
      return;
    error.value = cause;
    phase.value = "error";
  } finally {
    downloading = false;
  }
}
const errorMessage = computed(() =>
  error.value instanceof SkillExportRequestError
    ? ((
        {
          403: text.value.installAdminRequired,
          404: text.value.exportNotFound,
          409: text.value.exportChanged,
          413: text.value.exportLimit,
          422: text.value.exportBlocked,
          429: text.value.exportBusy,
          503: text.value.exportTimeout,
        } as Record<number, string>
      )[error.value.status] ?? text.value.exportFailed)
    : text.value.exportFailed,
);
function bytes(size: number) {
  return size < 1024
    ? `${size} B`
    : size < 1024 * 1024
      ? `${(size / 1024).toLocaleString($i18n.locale.value, { maximumFractionDigits: 1 })} KiB`
      : `${(size / (1024 * 1024)).toLocaleString($i18n.locale.value, { maximumFractionDigits: 1 })} MiB`;
}
const requirements = computed(() => {
  const value = manifest.value?.requirements;
  if (!value) return [];
  return [
    {
      label: text.value.exportCompatibility,
      value: value.compatibility ?? text.value.exportUndeclared,
      whitespace: true,
    },
    {
      label: text.value.exportTools,
      value:
        value.allowed_tools === null
          ? text.value.exportUndeclared
          : value.allowed_tools.length
            ? value.allowed_tools.join(", ")
            : text.value.exportNone,
    },
    {
      label: text.value.exportSecrets,
      value:
        value.required_secrets === null
          ? text.value.exportUndeclared
          : value.required_secrets.length
            ? value.required_secrets
                .map(
                  (secret) =>
                    `${secret.name} (${secret.optional ? text.value.exportOptional : text.value.exportRequired})`,
                )
                .join(", ")
            : text.value.exportNone,
    },
  ];
});
</script>
<template>
  <Dialog open @update:open="!$event && close()"
    ><DialogContent
      :close-label="$i18n.t.value.primitives.close"
      class="max-h-[90dvh] sm:max-w-xl"
      ><DialogHeader
        ><DialogTitle class="flex items-center gap-2"
          ><FileArchive class="size-5" />{{ text.exportTitle }}</DialogTitle
        ><DialogDescription>{{
          text.exportDescription
        }}</DialogDescription></DialogHeader
      >
      <div class="@container/skill-export min-w-0 space-y-5">
        <div class="font-mono text-base font-medium break-all">
          {{ name }}.skill
        </div>
        <p
          v-if="phase === 'loading'"
          role="status"
          class="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <Loader class="size-4 animate-spin" />{{ text.exportLoading }}
        </p>
        <template v-if="manifest"
          ><dl
            class="bg-muted/50 grid grid-cols-1 gap-3 rounded-lg p-3 text-sm @sm/skill-export:grid-cols-3"
          >
            <div
              v-for="[label, value] in [
                [text.exportFiles, manifest.file_count],
                [text.exportDirectories, manifest.directory_count],
                [text.exportSize, bytes(manifest.total_bytes)],
              ]"
              :key="label"
            >
              <dt class="text-muted-foreground text-xs">{{ label }}</dt>
              <dd class="mt-1 font-medium tabular-nums">{{ value }}</dd>
            </div>
          </dl>
          <details class="rounded-lg border p-3">
            <summary class="cursor-pointer text-sm font-medium">
              {{ text.exportContents }}
            </summary>
            <ul
              class="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs"
              :aria-label="text.exportContents"
            >
              <li
                v-for="file in manifest.files.slice(visible, visible + 50)"
                :key="file.path"
                class="flex items-start justify-between gap-3"
              >
                <span class="min-w-0 font-mono break-all"
                  >{{ file.path === "." ? name : file.path
                  }}{{ file.type === "directory" ? "/" : "" }}</span
                ><span class="text-muted-foreground shrink-0 tabular-nums">{{
                  file.type === "file" ? bytes(file.size) : "—"
                }}</span>
              </li>
            </ul>
            <Button
              v-if="visible > 0"
              variant="ghost"
              size="sm"
              @click="visible = Math.max(0, visible - 50)"
              >{{ text.exportPrevious }}</Button
            ><Button
              v-if="manifest.files.length > visible + 50"
              variant="ghost"
              size="sm"
              @click="visible += 50"
              >{{ text.exportMore }}</Button
            >
          </details>
          <section class="space-y-2 text-sm">
            <h3 class="font-medium">{{ text.exportRequirements }}</h3>
            <dl class="space-y-2">
              <div v-for="item in requirements" :key="item.label">
                <dt class="text-muted-foreground text-xs">{{ item.label }}</dt>
                <dd
                  :class="[
                    'break-words',
                    item.whitespace && 'whitespace-pre-wrap',
                  ]"
                >
                  {{ item.value }}
                </dd>
              </div>
            </dl>
          </section>
          <section
            v-if="manifest.warnings.length"
            class="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
          >
            <h3 class="font-medium">{{ text.exportWarnings }}</h3>
            <p class="text-muted-foreground mt-1 text-xs">
              {{ text.exportWarningDescription }}
            </p>
            <ul class="mt-2 max-h-28 overflow-y-auto text-xs">
              <li
                v-for="(warning, index) in manifest.warnings"
                :key="index"
                class="break-all"
              >
                {{ warning.path ? `${warning.path}: ` : ""
                }}{{ text.exportNotices[warning.code] ?? warning.message }}
              </li>
            </ul>
          </section>
          <section
            v-if="!manifest.can_export"
            role="alert"
            class="text-destructive text-sm"
          >
            <p class="font-medium">{{ text.exportBlocked }}</p>
            <ul class="mt-1 max-h-28 overflow-y-auto">
              <li
                v-for="(blocker, index) in manifest.blockers"
                :key="index"
                class="break-all"
              >
                {{ blocker.path ? `${blocker.path}: ` : ""
                }}{{ text.exportNotices[blocker.code] ?? blocker.message }}
              </li>
            </ul>
          </section>
          <p class="text-muted-foreground text-xs leading-relaxed">
            {{ text.exportScope }}
          </p>
        </template>
        <p v-if="error !== null" role="alert" class="text-destructive text-sm">
          {{ errorMessage }}
        </p>
        <p v-if="phase === 'done'" role="status" class="text-sm">
          {{ text.exportHandedOff }}
        </p>
      </div>
      <DialogFooter
        ><Button variant="outline" @click="close">{{
          $i18n.t.value.common.close
        }}</Button
        ><Button
          v-if="phase === 'error' || (manifest && !manifest.can_export)"
          variant="outline"
          @click="load"
          >{{ text.exportRefresh }}</Button
        ><Button
          v-if="manifest?.can_export"
          :disabled="downloadDisabled"
          @click="download"
          ><Loader
            v-if="phase === 'downloading'"
            class="size-4 animate-spin"
          /><Download v-else class="size-4" />{{
            phase === "downloading"
              ? text.exportDownloading
              : text.exportDownload
          }}</Button
        ></DialogFooter
      >
    </DialogContent></Dialog
  >
</template>
