<script setup lang="ts">
/*
  【文件职责】     复用 composer skill catalog，并按 session role 管理全局 skill 开关。
  【架构位置】     L3 product UI
  【主要导出】     默认 SkillSettings 组件
  【依赖关系】     useSettingsPermissions · useSkillSettings · core/skills/api · ui/tabs · ui/switch
  【边界与注意】   普通用户可读 catalog 但不能 PUT；create-skill 对话入口不是全局启停权限。

                   **本地安装 `.skill` 的三道拦截各说各的话**：扩展名不对、包超过
                   100 MiB、后端安全扫描给了结论。前两道在前端拦——不让用户传完
                   100 MiB 才被拒；第三道只有后端知道，它给的是「哪条规则、哪个文件
                   的哪一行、怎么改」，只留一句「安装失败」等于把这份诊断扔了。

                   装完切到「自定义」页签：包就装在那儿，留在「公共」页签上用户
                   会以为没装上。
*/

import { computed, ref } from "vue";

import { Loader, Sparkles, Upload } from "lucide-vue-next";

import SettingsSection from "./SettingsSection.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useSkillSettings } from "@/composables/useSkillSettings";
import {
  formatSkillSecurityFindings,
  MAX_SKILL_ARCHIVE_UPLOAD_BYTES,
  SkillRequestError,
  uploadSkillArchive,
} from "@/core/skills/api";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
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

const toast = useWorkspaceToast();
const archiveInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const canInstallArchive = computed(
  () => access.canManageSkills.value && !uploading.value,
);

async function handleArchive(event: Event) {
  const input = event.target as HTMLInputElement;
  const archive = input.files?.[0];
  /*
    先清空 value：同一个文件连选两次，第二次不会触发 change。
    **这一条单测覆盖不到**——happy-dom 的 file input value 恒为空串，
    断言它被清空是恒真的。归 e2e。
  */
  input.value = "";
  if (uploading.value || !archive) return;

  if (!archive.name.toLowerCase().endsWith(".skill")) {
    toast.error(t.value.settings.skills.invalidArchive);
    return;
  }
  if (archive.size > MAX_SKILL_ARCHIVE_UPLOAD_BYTES) {
    toast.error(t.value.settings.skills.archiveTooLarge);
    return;
  }

  uploading.value = true;
  try {
    const result = await uploadSkillArchive(archive);
    if (result.success) {
      toast.success(result.message);
      // 装完切到「自定义」：包就装在那儿。
      filter.value = "custom";
      await skills.refetch();
      return;
    }
    toast.error(result.message || t.value.settings.skills.installFailed);
  } catch (cause) {
    toast.error(archiveErrorMessage(cause), archiveErrorOptions(cause));
  } finally {
    uploading.value = false;
  }
}

function archiveErrorMessage(cause: unknown): string {
  if (cause instanceof SkillRequestError) {
    if (cause.isAdminRequired) {
      return t.value.settings.skills.installAdminRequired;
    }
    if (cause.status === 413) return t.value.settings.skills.archiveTooLarge;
    return cause.message;
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : t.value.settings.skills.installFailed;
}

/** 安全扫描的结论挂在提示的 description 上，不挤进标题。 */
function archiveErrorOptions(cause: unknown) {
  return cause instanceof SkillRequestError && cause.findings.length > 0
    ? { description: formatSkillSecurityFindings(cause.findings) }
    : undefined;
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

        错误行是 `role="alert"`、措辞不带前缀：上游原来是个没有 role 的 `<div>`
        （读屏器不会主动念），还硬编码了一个 `Error: ` 前缀（中文界面上也是英文），
        而且画成普通正文（16px、前景色）而不是错误。**2026-09-11 两边同改**，
        上游那一支换成了同形的 `<p role="alert" className="text-sm text-destructive">`。

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
      <!--
        `flex-wrap`：375px 下标签与右边那两颗键并排放不下。本仓这一侧看不出问题
        （reka 的 ScrollArea viewport 没有包装层，内容被约束在 100% 宽），
        但上游那一侧会——Radix 的 viewport 把子节点包进
        `min-width:100%; display:table`，而 table 盒取的是**收缩到适合**的宽度，
        于是放不下的一行不会溢出裁掉，而是把整个面板撑得比对话框还宽，
        下面每一行都跟着按那个宽度排。两边同改，保持这一行逐字相同。
      -->
      <header
        v-if="!skills.error.value && !skills.loading.value"
        class="flex flex-wrap justify-between gap-2"
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
        <div class="flex gap-2">
          <!--
            文件选择器是**隐藏的 input**，按钮点它。原生 file input 的外观各浏览器
            各不相同，也没法按设计系统画。

            **它对读屏器不可见。** 承担语义的是下面那颗可见按钮；把这个 input
            也留在可访问性树里，等于同一件事出现两个控件——本仓此前还给它加了
            `aria-label`，于是树里有**两个同名的 "Install .skill"**，
            上游那边则是一个匿名 button。两个都不对，2026-09-10 两边同改成这一条。
            `tabindex="-1"` 是配套的：`aria-hidden` 不允许加在可聚焦元素上。
          -->
          <input
            ref="archiveInput"
            type="file"
            accept=".skill"
            class="sr-only"
            aria-hidden="true"
            tabindex="-1"
            :disabled="!canInstallArchive"
            @change="handleArchive"
          />
          <Button
            v-if="access.canManageSkills.value"
            size="sm"
            variant="outline"
            data-testid="install-skill-archive"
            :disabled="!canInstallArchive"
            @click="archiveInput?.click()"
          >
            <Loader v-if="uploading" class="size-4 animate-spin" />
            <Upload v-else class="size-4" />
            {{
              uploading
                ? t.settings.skills.installingArchive
                : t.settings.skills.installFromFile
            }}
          </Button>
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
        class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
        data-testid="settings-session-unavailable"
      >
        {{ t.settings.sessionUnavailable }}
      </p>
      <template v-else>
        <!--
          **照抄上游 `skill-settings-page.tsx:55`：`<div className="text-muted-foreground
          text-sm">`——没有琥珀框。** 下面那句「`<div>` 不是 `<p>`」的规则此前只落到了
          loading 那一行，这一行还留着自造的 `bg-amber-50 text-amber-800`
          （**没有 `dark:` 变体**，深色下是一块浅琥珀底）——2026-09-12 第十三轮修。
        -->
        <div
          v-if="access.permissions.value.adminRequired"
          class="text-muted-foreground text-sm"
          data-testid="skills-admin-required"
        >
          {{ t.settings.skills.adminRequired }}
        </div>
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
        <p
          v-if="skills.error.value"
          role="alert"
          class="text-destructive text-sm"
        >
          {{ errorMessage(skills.error.value) }}
        </p>
        <p
          v-if="actionError"
          role="alert"
          class="text-destructive text-sm"
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
          <!-- 行的形状照上游 `skill-settings-page.tsx:203` 的 Item 一族。 -->
          <Item
            v-for="skill in filtered"
            :key="skill.name"
            variant="outline"
            class="w-full"
            :data-testid="`skill-${skill.name}`"
          >
            <ItemContent class="min-w-0">
              <ItemTitle>
                <div class="flex items-center gap-2">{{ skill.name }}</div>
              </ItemTitle>
              <ItemDescription class="line-clamp-4">
                {{ skill.description }}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <!--
                开关按技能命名：一页技能否则就是一列长得一样、又没有名字的开关，
                读屏器分不出停在哪一个（WCAG 4.1.2）。上游同一条注释。
              -->
              <Switch
                :aria-label="skill.name"
                :model-value="skill.enabled"
                :disabled="
                  !access.canManageSkills.value || skills.pending.value
                "
                :data-pending="pendingName === skill.name || undefined"
                @update:model-value="toggle(skill, $event)"
              />
            </ItemActions>
          </Item>
        </template>
      </template>
    </div>
  </SettingsSection>
</template>
