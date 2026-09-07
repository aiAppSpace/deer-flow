<script setup lang="ts">
/*
  【文件职责】     复用 composer skill catalog，并按 session role 管理全局 skill 开关。
  【架构位置】     L3 product UI
  【主要导出】     默认 SkillSettings 组件
  【依赖关系】     useSettingsPermissions · useSkillSettings · ui/tabs · ui/switch
  【边界与注意】   普通用户可读 catalog 但不能 PUT；create-skill 对话入口不是全局启停权限。
*/

import { computed, ref } from "vue";

import { Sparkles } from "lucide-vue-next";

import SettingsSection from "./SettingsSection.vue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useSkillSettings } from "@/composables/useSkillSettings";
import { SkillRequestError } from "@/core/skills/api";
import type { Skill } from "@/core/skills/type";

const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const settings = useSettingsDialog();
const access = useSettingsPermissions();
const skills = useSkillSettings({
  canManage: access.canManageSkills,
  enabled: access.canReadSkills,
});
const filter = ref<"public" | "custom">("public");
const actionError = ref("");
const pendingName = ref<string | null>(null);
const filtered = computed(() =>
  skills.skills.value.filter((skill) => skill.category === filter.value),
);

function errorMessage(cause: unknown) {
  if (cause instanceof SkillRequestError && cause.isAdminRequired) {
    return t.value.settings.skills.adminRequired;
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : t.value.settings.skills.description;
}

async function toggle(skill: Skill, enabled: boolean) {
  // 受控开关：视觉状态只跟随服务端真相，请求失败时不会停在一个假的 on。
  if (!access.canManageSkills.value || skills.pending.value) return;
  actionError.value = "";
  pendingName.value = skill.name;
  try {
    await skills.toggle(skill.name, enabled);
  } catch (cause) {
    actionError.value = errorMessage(cause);
  } finally {
    pendingName.value = null;
  }
}

async function createSkill() {
  settings.close();
  await navigateTo("/workspace/chats/new?mode=skill");
}
</script>

<template>
  <SettingsSection
    data-testid="skill-settings"
    :title="t.settings.skills.title"
    :description="t.settings.skills.description"
  >
    <div class="flex w-full flex-col gap-4">
      <!--
        **取技能清单失败时，这一整块要让位给错误行**（wave 133 对齐）。

        上游把筛选标签、「创建技能」按钮与清单**一起**放在 `SkillSettingsList` 里，
        而那个组件在 `skill-settings-page.tsx:50` 的 `) : error ? (` 一支里整个不渲染。
        本仓原来把创建键与标签放在状态分支**外面**，于是取数失败时它们仍然在——
        对照台账量出来是 15 行 × 两种语言（`ariaOnlyVue` 里 `tablist`/两个 `tab`/
        `button "Create skill"` 都只在本仓，外加几何、tab 序与可 tab 元素的连带差异）。
        一屏拿不到数据、却还留着一颗指向同一个后端的「创建」按钮，不是更好的做法。

        **保留的是本仓更好的那两点**：错误行是 `role="alert"`（上游是个没有 role 的
        `<div>`，读屏器不会主动念），措辞走词典（上游硬编码 `Error: ` 前缀，
        中文界面上也是英文）。这两处差异**有意留在台账里**，各自有翻案判据。

        **wave 134 把 `loading` 那一支也接上并对齐了**：上游
        `skill-settings-page.tsx:44` 是 `isLoading ? 只画一句 Loading : …`，
        同样整块让位。量出来与 error 那一支同形（12 行 × 两种语言）。
      -->
      <!--
        **筛选标签与创建键是同一行**（上游 `skill-settings-page.tsx:82` 的
        `<header className="flex justify-between">`：左边一个 `flex gap-2` 装 Tabs，
        右边一个 `<div>` 装按钮）。本仓此前是**上下两行**——创建键自成一行右对齐，
        标签在下一块里——wave 144 第一次给这一屏取样时，`order` 档报出
        「第 27 个公共节点 React=tablist / Vue=button」，就是这件事。

        标签**移到权限分支外面**是有意的：上游根本没有权限查询，这一整个 header
        只由技能清单的 loading/error 决定。放在里面等于让 header 多等一个上游
        没有的 gate；放在外面之后，两个应用画出 header 的条件逐字相同。
      -->
      <header
        v-if="!skills.error.value && !skills.loading.value"
        class="flex justify-between"
      >
        <div class="flex gap-2">
          <Tabs v-model="filter">
            <!--
              给这组标签取个名字。没有名字的 tablist 只会被念成「选项卡列表」，
              说不出它在筛什么（上游同处有同样一句注释）。
            -->
            <TabsList variant="line" :aria-label="t.settings.skills.title">
              <TabsTrigger
                v-for="kind in ['public', 'custom'] as const"
                :key="kind"
                :value="kind"
              >
                {{ kind === "public" ? t.common.public : t.common.custom }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div>
          <!--
            上游 `skill-settings-page.tsx:94` 是
            `<Button size="sm">` 里放一颗 `<SparklesIcon className="size-4" />`。
            手写那版**没有图标**，尺寸也是 default 一档（sm 是 `h-8 gap-1.5 px-3`），
            而且少 `hover:bg-primary/90`、`cursor-pointer`、3px 焦点环与 `disabled:*`。
          -->
          <Button size="sm" data-testid="create-skill" @click="createSkill">
            <Sparkles class="size-4" />
            {{ t.settings.skills.createSkill }}
          </Button>
        </div>
      </header>

      <p
        v-if="access.permissions.value.state === 'loading'"
        class="text-muted-foreground text-sm"
      >
        {{ t.common.loading }}
      </p>
      <p
        v-else-if="access.permissions.value.state === 'unavailable'"
        role="alert"
        class="rounded-md bg-red-50 p-3 text-sm text-red-700"
        data-testid="settings-session-unavailable"
      >
        {{ t.settings.sessionUnavailable }}
      </p>
      <template v-else>
        <p
          v-if="access.permissions.value.adminRequired"
          class="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
          data-testid="skills-admin-required"
        >
          {{ t.settings.skills.adminRequired }}
        </p>
        <!--
          `<div>` 不是 `<p>`：上游那一句是
          `<div className="text-muted-foreground text-sm">{t.common.loading}</div>`，
          直接挂在 main 的文本里；`<p>` 会在可访问性树里多出一个 `paragraph` 节点
          （对照台账当场报出 `ariaOnlyVue: - paragraph: Loading...`）。
          同一份文件里 `ToolSettings.vue` 的空态早就因为同一条理由用的 `<div>`。
        -->
        <div
          v-if="skills.loading.value && !skills.error.value"
          class="text-muted-foreground text-sm"
        >
          {{ t.common.loading }}
        </div>
        <p v-if="skills.error.value" role="alert" class="text-sm text-red-600">
          {{ errorMessage(skills.error.value) }}
        </p>
        <p
          v-if="actionError"
          role="alert"
          class="text-sm text-red-600"
          data-testid="skill-action-error"
        >
          {{ actionError }}
        </p>
        <p
          v-if="
            !skills.loading.value &&
            !skills.error.value &&
            filtered.length === 0
          "
          class="text-muted-foreground rounded-md border p-4 text-sm"
        >
          {{ t.settings.skills.emptyTitle }}
        </p>
        <template v-if="!skills.error.value && !skills.loading.value">
          <div
            v-for="skill in filtered"
            :key="skill.name"
            class="border-border flex items-center justify-between gap-4 rounded-md border p-3"
            :data-testid="`skill-${skill.name}`"
          >
            <div class="min-w-0">
              <div class="font-medium">{{ skill.name }}</div>
              <p class="text-muted-foreground text-sm">
                {{ skill.description }}
              </p>
            </div>
            <Switch
              :aria-label="skill.name"
              :model-value="skill.enabled"
              :disabled="!access.canManageSkills.value || skills.pending.value"
              :data-pending="pendingName === skill.name || undefined"
              @update:model-value="toggle(skill, $event)"
            />
          </div>
        </template>
      </template>
    </div>
  </SettingsSection>
</template>
