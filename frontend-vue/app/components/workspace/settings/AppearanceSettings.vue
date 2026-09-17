<script setup lang="ts">
/*
  【文件职责】     管理 DeerFlow locale、theme 与显示偏好。
  【架构位置】     L3
  【主要导出】     默认 AppearanceSettings 组件
  【依赖关系】     i18n · color mode · settings store
  【边界与注意】   应用设置接线，不属于 L2。
*/
import { computed } from "vue";
import { MonitorSmartphone, Moon, Sun } from "lucide-vue-next";

import SettingsSection from "./SettingsSection.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, type Locale } from "@/core/i18n/locale";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import { cn } from "@/lib/utils";

const { $i18n, $theme } = useNuxtApp();
const themeOptions = computed(() => [
  {
    value: "system" as const,
    label: $i18n.t.value.settings.appearance.system,
    description: $i18n.t.value.settings.appearance.systemDescription,
    icon: MonitorSmartphone,
  },
  {
    value: "light" as const,
    label: $i18n.t.value.settings.appearance.light,
    description: $i18n.t.value.settings.appearance.lightDescription,
    icon: Sun,
  },
  {
    value: "dark" as const,
    label: $i18n.t.value.settings.appearance.dark,
    description: $i18n.t.value.settings.appearance.darkDescription,
    icon: Moon,
  },
]);
const languageOptions = [
  { value: "en-US" as const, label: enUS.locale.localName },
  { value: "zh-CN" as const, label: zhCN.locale.localName },
];

/*
  预览图按**解析后**的主题画，不按偏好画：选「跟随系统」时要给用户看的是系统当前
  实际是哪一套，而不是一张中性图（上游 appearance-settings-page.tsx:131 的
  `previewMode`）。
*/
function previewMode(value: "system" | "light" | "dark") {
  if (value !== "system") return value;
  return $theme.resolved.value === "dark" ? "dark" : "light";
}

function setLocale(value: unknown) {
  if (typeof value === "string" && isLocale(value)) {
    $i18n.setLocale(value as Locale);
  }
}
</script>

<template>
  <div class="space-y-8">
    <SettingsSection
      :title="$i18n.t.value.settings.appearance.themeTitle"
      :description="$i18n.t.value.settings.appearance.themeDescription"
    >
      <!--
        每张卡片是「图标 + 标题 + 说明 + 一张纯装饰的界面预览图」（上游
        appearance-settings-page.tsx:114 的 ThemePreviewCard）。本仓原来只有两段
        文字：可访问性树上少一个 text 节点与一个 paragraph（说明被并进按钮名里），
        视觉上更是完全两回事——用户选主题时看不到那一套配色长什么样。
        预览图整块 `aria-hidden`：它是示意图，念出来只会是一串没有意义的方块。
      -->
      <div class="grid gap-3 lg:grid-cols-3">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          :data-theme-preference="option.value"
          type="button"
          :class="
            cn(
              'group flex h-full flex-col gap-3 rounded-lg border p-4 text-left transition-all',
              $theme.preference.value === option.value
                ? 'border-primary ring-primary/30 shadow-sm ring-2'
                : 'hover:border-border hover:shadow-sm',
            )
          "
          @click="$theme.setPreference(option.value)"
        >
          <div class="flex items-start gap-3">
            <div class="bg-muted rounded-md p-2">
              <component :is="option.icon" class="size-4" aria-hidden="true" />
            </div>
            <div class="space-y-1">
              <div class="text-sm leading-none font-semibold">
                {{ option.label }}
              </div>
              <p class="text-muted-foreground text-xs leading-snug">
                {{ option.description }}
              </p>
            </div>
          </div>
          <div
            aria-hidden="true"
            :class="
              cn(
                'relative overflow-hidden rounded-md border text-xs transition-colors',
                previewMode(option.value) === 'dark'
                  ? 'border-neutral-800 bg-neutral-900 text-neutral-200'
                  : 'border-slate-200 bg-white text-slate-900',
              )
            "
          >
            <div
              class="border-border/50 flex items-center gap-2 border-b px-3 py-2"
            >
              <div
                :class="
                  cn(
                    'h-2 w-2 rounded-full',
                    previewMode(option.value) === 'dark'
                      ? 'bg-emerald-400'
                      : 'bg-emerald-500',
                  )
                "
              />
              <div class="h-2 w-10 rounded-full bg-current/20" />
              <div class="h-2 w-6 rounded-full bg-current/15" />
            </div>
            <!--
              **`minmax(0,240px)`，不是裸的 `240px`**：固定轨道不会缩，于是这块
              预览把整个「外观」面板的 min-content 顶到 348px，而 375px 屏上
              那一格只有 293——实测 `panelOverflow` 375px 下 55、360px 下 70，
              也就是**这块面板在所有手机上都挂在设置对话框外面**。
              上限仍然是 240，约 420px 以上毫无变化。
            -->
            <div class="grid grid-cols-[1fr_minmax(0,240px)] gap-3 px-3 py-3">
              <div class="space-y-2">
                <div class="h-3 w-3/4 rounded-full bg-current/15" />
                <div class="h-3 w-1/2 rounded-full bg-current/10" />
                <div
                  class="h-[90px] rounded-md border border-current/10 bg-current/5"
                />
              </div>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <div class="h-8 w-8 rounded-md bg-current/10" />
                  <div class="space-y-2">
                    <div class="h-2 w-14 rounded-full bg-current/15" />
                    <div class="h-2 w-10 rounded-full bg-current/10" />
                  </div>
                </div>
                <div
                  class="flex flex-col gap-1 rounded-md border border-dashed border-current/15 p-2"
                >
                  <div class="h-2 w-3/5 rounded-full bg-current/15" />
                  <div class="h-2 w-2/5 rounded-full bg-current/10" />
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </SettingsSection>

    <!--
      上游两段之间有一条 `<Separator />`（`role="none"`，可访问性树上看不见，
      但视觉上把主题与语言分开）。本仓照抄它渲染出来的那一层。
    -->
    <div
      data-slot="separator"
      role="none"
      class="bg-border h-px w-full shrink-0"
    />

    <SettingsSection
      :title="$i18n.t.value.settings.appearance.languageTitle"
      :description="$i18n.t.value.settings.appearance.languageDescription"
    >
      <!--
        语言选择器走 shadcn 的 Select，与上游同一个 primitive
        （appearance-settings-page.tsx:90）。本仓原来是原生 `<select>`：可访问性树上
        是一个带 option 子节点的 combobox，上游则是一个只念当前值的 combobox +
        portal 出去的 listbox，两者读屏器行为不同。
      -->
      <Select :model-value="$i18n.locale.value" @update:model-value="setLocale">
        <SelectTrigger class="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="item in languageOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingsSection>
  </div>
</template>
