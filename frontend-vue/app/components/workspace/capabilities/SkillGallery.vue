<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onScopeDispose,
  ref,
  watch,
} from "vue";
import { Download, Loader, Sparkles, Upload } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCapabilityUser } from "@/composables/useCapabilities";
import { useSkillSettings } from "@/composables/useSkillSettings";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";
import {
  formatSkillSecurityFindings,
  MAX_SKILL_ARCHIVE_UPLOAD_BYTES,
  SkillRequestError,
  uploadSkillArchive,
} from "@/core/skills/api";
import type { Skill } from "@/core/skills/type";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import CapabilityCard from "./CapabilityCard.vue";
import CapabilityIcon from "./CapabilityIcon.vue";
import { presentSkill } from "./skill-presentation";
const SkillExportDialog = defineAsyncComponent(
  () => import("./SkillExportDialog.vue"),
);
const props = withDefaults(defineProps<{ query?: string }>(), { query: "" });
const { $i18n } = useNuxtApp();
const router = useRouter();
const toast = useWorkspaceToast();
const user = useCapabilityUser();
const captureOwner = useWorkspaceAsyncOwner();
const isAdmin = computed(() => user.value?.system_role === "admin");
const skills = useSkillSettings({ canManage: isAdmin });
const adminRequired = computed(
  () =>
    skills.error.value instanceof SkillRequestError &&
    skills.error.value.isAdminRequired,
);
const filter = ref("public");
const selectedSkill = ref<Skill | null>(null);
const exportName = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
let uploadController: AbortController | undefined;
onScopeDispose(() => uploadController?.abort());
watch(
  () => user.value?.id,
  () => {
    uploadController?.abort();
    uploading.value = false;
    selectedSkill.value = null;
    exportName.value = null;
  },
  { flush: "sync" },
);
const filtered = computed(() =>
  skills.skills.value.filter((skill) => {
    const presented = presentSkill(skill, $i18n.locale.value);
    return (
      (filter.value === "all" || skill.category === filter.value) &&
      `${skill.name} ${skill.description} ${presented.title} ${presented.description}`
        .toLowerCase()
        .includes(props.query.trim().toLowerCase())
    );
  }),
);
const noSearchResults = computed(
  () =>
    props.query.trim() &&
    (filter.value === "community" || filtered.value.length === 0),
);
function sourceLabel(skill: Skill) {
  const copy = $i18n.t.value.capabilities;
  return skill.category === "public"
    ? copy.builtin
    : skill.category === "custom"
      ? copy.custom
      : skill.category === "integrations"
        ? copy.integrationSkills
        : copy.sharedSkills;
}
function createSkill() {
  void router.push("/workspace/chats/new?mode=skill");
}
async function toggle(skill: Skill, enabled: boolean) {
  const isCurrent = captureOwner();
  try {
    await skills.toggle(skill.name, enabled);
  } catch (error) {
    if (!isCurrent()) return;
    toast.error(error instanceof Error ? error.message : String(error));
  }
}
async function handleArchive(event: Event) {
  const input = event.target as HTMLInputElement;
  const archive = input.files?.[0];
  input.value = "";
  if (uploading.value || !archive || !isAdmin.value) return;
  const text = $i18n.t.value.settings.skills;
  if (!archive.name.toLowerCase().endsWith(".skill")) {
    toast.error(text.invalidArchive);
    return;
  }
  if (archive.size > MAX_SKILL_ARCHIVE_UPLOAD_BYTES) {
    toast.error(text.archiveTooLarge);
    return;
  }
  uploading.value = true;
  const isCurrent = captureOwner();
  const controller = new AbortController();
  uploadController = controller;
  try {
    const result = await uploadSkillArchive(archive, {
      signal: controller.signal,
    });
    if (controller.signal.aborted || !isCurrent()) return;
    if (result.success) {
      toast.success(result.message);
      filter.value = "custom";
      await skills.refetch();
    } else toast.error(result.message || text.installFailed);
  } catch (error) {
    if (controller.signal.aborted || !isCurrent()) return;
    if (error instanceof SkillRequestError && error.isAdminRequired)
      toast.error(text.installAdminRequired);
    else if (error instanceof SkillRequestError && error.status === 413)
      toast.error(text.archiveTooLarge);
    else if (error instanceof SkillRequestError && error.findings.length)
      toast.error(error.message, {
        description: formatSkillSecurityFindings(error.findings),
      });
    else
      toast.error(error instanceof Error ? error.message : text.installFailed);
  } finally {
    if (uploadController === controller) {
      uploading.value = false;
      uploadController = undefined;
    }
  }
}
function exportSelected() {
  exportName.value = selectedSkill.value?.name ?? null;
  selectedSkill.value = null;
}
</script>
<template>
  <div>
    <div v-if="skills.loading.value" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.common.loading }}
    </div>
    <div v-else-if="adminRequired" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.settings.skills.adminRequired }}
    </div>
    <p
      v-else-if="skills.error.value"
      role="alert"
      class="text-destructive text-sm"
    >
      {{ skills.error.value.message }}
    </p>
    <div v-else class="flex w-full flex-col gap-4">
      <SkillExportDialog
        v-if="exportName && isAdmin"
        :key="`${user?.id}:${exportName}`"
        :name="exportName"
        @close="exportName = null"
      />
      <div>
        <h2 class="text-base font-semibold">
          {{ $i18n.t.value.capabilities.availableSkills }}
        </h2>
        <p class="text-muted-foreground mt-1.5 text-sm">
          {{ $i18n.t.value.capabilities.skillHint }}
        </p>
      </div>
      <header
        class="@container/capability-tabs mt-2 flex max-w-full min-w-0 flex-wrap items-center justify-between gap-3"
      >
        <Tabs v-model="filter" class="max-w-full min-w-0"
          ><TabsList
            :aria-label="$i18n.t.value.capabilities.skills"
            class="bg-muted/50 h-auto max-w-full flex-wrap rounded-lg @max-sm/capability-tabs:max-w-full @max-sm/capability-tabs:flex-wrap @max-sm/capability-tabs:group-data-[orientation=horizontal]/tabs:h-auto @max-sm/capability-tabs:[&>button]:h-auto @max-sm/capability-tabs:[&>button]:max-w-full @max-sm/capability-tabs:[&>button]:min-w-0 @max-sm/capability-tabs:[&>button]:flex-auto @max-sm/capability-tabs:[&>button]:wrap-anywhere @max-sm/capability-tabs:[&>button]:whitespace-normal"
            ><TabsTrigger
              v-for="key in ['public', 'community', 'custom', 'all']"
              :key="key"
              :value="key"
              class="rounded-md px-3 text-xs"
              >{{
                key === "public"
                  ? $i18n.t.value.capabilities.builtin
                  : key === "community"
                    ? $i18n.t.value.capabilities.community
                    : key === "custom"
                      ? $i18n.t.value.capabilities.custom
                      : $i18n.t.value.capabilities.allSkills
              }}</TabsTrigger
            ></TabsList
          ></Tabs
        >
        <div class="flex max-w-full min-w-0 flex-wrap gap-2">
          <input
            ref="fileInput"
            type="file"
            accept=".skill"
            :disabled="uploading || !isAdmin"
            class="sr-only"
            aria-hidden="true"
            tabindex="-1"
            @change="handleArchive"
          /><Button
            v-if="isAdmin"
            class="h-auto max-w-full min-w-0 whitespace-normal"
            size="sm"
            variant="outline"
            :disabled="uploading"
            @click="fileInput?.click()"
            ><Loader v-if="uploading" class="size-4 animate-spin" /><Upload
              v-else
              class="size-4"
            />{{
              uploading
                ? $i18n.t.value.settings.skills.installingArchive
                : $i18n.t.value.settings.skills.installFromFile
            }}</Button
          ><Button
            class="h-auto max-w-full min-w-0 whitespace-normal"
            size="sm"
            @click="createSkill"
            ><Sparkles class="size-4" />{{
              $i18n.t.value.settings.skills.createSkill
            }}</Button
          >
        </div>
      </header>
      <div
        v-if="noSearchResults"
        class="text-muted-foreground py-20 text-center text-sm"
      >
        {{ $i18n.t.value.capabilities.noResults }}
      </div>
      <Empty
        v-else-if="filter === 'community'"
        class="mt-5 rounded-2xl border py-20"
        ><EmptyHeader
          ><EmptyMedia variant="icon"><Sparkles /></EmptyMedia
          ><EmptyTitle>{{
            $i18n.t.value.capabilities.communityTitle
          }}</EmptyTitle
          ><EmptyDescription>{{
            $i18n.t.value.capabilities.communityDescription
          }}</EmptyDescription></EmptyHeader
        ><EmptyContent v-if="isAdmin"
          ><Button
            variant="outline"
            :disabled="uploading"
            @click="fileInput?.click()"
            ><Upload />{{
              $i18n.t.value.settings.skills.installFromFile
            }}</Button
          ></EmptyContent
        ></Empty
      >
      <Empty v-else-if="filtered.length === 0"
        ><EmptyHeader
          ><EmptyMedia variant="icon"><Sparkles /></EmptyMedia
          ><EmptyTitle>{{
            $i18n.t.value.settings.skills.emptyTitle
          }}</EmptyTitle
          ><EmptyDescription>{{
            $i18n.t.value.settings.skills.emptyDescription
          }}</EmptyDescription></EmptyHeader
        ><EmptyContent
          ><Button @click="createSkill">{{
            $i18n.t.value.settings.skills.emptyButton
          }}</Button></EmptyContent
        ></Empty
      >
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CapabilityCard
          v-for="skill in filtered"
          :key="skill.name"
          :name="presentSkill(skill, $i18n.locale.value).title"
          :description="presentSkill(skill, $i18n.locale.value).description"
          :label="sourceLabel(skill)"
          :details-label="`${$i18n.t.value.capabilities.details} ${presentSkill(skill, $i18n.locale.value).title}`"
          @details="selectedSkill = skill"
          ><template #icon
            ><CapabilityIcon
              :name="skill.name"
              skill
              :icon="presentSkill(skill, $i18n.locale.value).icon" /></template
          ><template #status
            ><span
              :class="
                skill.enabled
                  ? 'size-1.5 rounded-full bg-emerald-500'
                  : 'bg-muted-foreground/40 size-1.5 rounded-full'
              "
            />{{
              skill.enabled
                ? $i18n.t.value.capabilities.enabled
                : $i18n.t.value.capabilities.disabled
            }}</template
          ><Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            @click="selectedSkill = skill"
            >{{ $i18n.t.value.capabilities.details }}</Button
          ><Switch
            :aria-label="`${$i18n.t.value.capabilities.skillEnabled} ${skill.name}`"
            :model-value="skill.enabled"
            :disabled="!isAdmin || skills.pending.value"
            @update:model-value="toggle(skill, $event)"
        /></CapabilityCard>
      </div>
      <Dialog
        :open="selectedSkill !== null"
        @update:open="!$event && (selectedSkill = null)"
        ><DialogContent
          :close-label="$i18n.t.value.primitives.close"
          class="max-h-[85vh] sm:max-w-xl"
          ><template v-if="selectedSkill"
            ><DialogHeader
              ><CapabilityIcon
                :name="selectedSkill.name"
                skill
                :icon="presentSkill(selectedSkill, $i18n.locale.value).icon"
              /><DialogTitle class="mt-3">{{
                presentSkill(selectedSkill, $i18n.locale.value).title
              }}</DialogTitle
              ><DialogDescription class="font-mono text-xs">{{
                selectedSkill.name
              }}</DialogDescription></DialogHeader
            >
            <div
              class="text-muted-foreground text-sm leading-7 whitespace-pre-wrap"
            >
              {{ selectedSkill.description }}
            </div>
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
            >
              <span class="text-muted-foreground text-xs">{{
                selectedSkill.license || sourceLabel(selectedSkill)
              }}</span>
              <div class="flex max-w-full min-w-0 flex-wrap gap-2">
                <Button
                  v-if="isAdmin && selectedSkill.category === 'custom'"
                  size="sm"
                  variant="outline"
                  @click="exportSelected"
                  ><Download class="size-4" />{{
                    $i18n.t.value.settings.skills.exportSkill
                  }}</Button
                >
              </div>
            </div></template
          ></DialogContent
        ></Dialog
      >
    </div>
  </div>
</template>
