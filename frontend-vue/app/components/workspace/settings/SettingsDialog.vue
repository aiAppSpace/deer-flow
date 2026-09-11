<script setup lang="ts">
/*
  【文件职责】     编排 DeerFlow settings 的导航、路由深链与可访问 modal 生命周期。
  【架构位置】     L3 workspace settings shell
  【主要导出】     默认 SettingsDialog 组件
  【依赖关系】     ui/dialog · ui/scroll-area · useSettingsDialog · vue-router · settings panels
  【边界与注意】   useSettingsDialog 是唯一 UI owner；各 Query owner 保持在子面板内。

                   外壳的骨架逐行对照 React settings-dialog.tsx：可见的标题+描述、
                   220px 的 <nav><ul><li>、右侧 ScrollArea 里 space-y-8 p-6 的容器。
                   九个 section 共用这一个外壳，所以这里每改一处，e2e-settings、
                   e2e-channels 与 e2e-visual 的两张设置截图都要一起跑。

                   描述用裸 <p> 而不是 DialogDescription，并显式摘掉 aria-describedby：
                   React 写的就是 aria-describedby={undefined}，读屏器只念标题，正文由
                   用户自己读到。Reka 无条件把它指向一个 description id，不摘掉就是一个
                   悬空 IDREF（同 SettingsActionDialog 的那条注释）。

                   正文容器不再包 <main>——每个面板自己的 SettingsSection 会包，
                   与 React 的 main 数量一一对应。
*/
import {
  computed,
  defineAsyncComponent,
  nextTick,
  ref,
  watch,
  type Component,
} from "vue";
import {
  Bell,
  Brain,
  Cable,
  Info,
  Palette,
  PlugZap,
  Sparkles,
  User,
  UsersRound,
  Wrench,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChannelConnections from "@/components/workspace/channels/ChannelConnections.vue";
import AboutSettings from "@/components/workspace/settings/AboutSettings.vue";
import AccountSettings from "@/components/workspace/settings/AccountSettings.vue";
import AppearanceSettings from "@/components/workspace/settings/AppearanceSettings.vue";
import MemorySettings from "@/components/workspace/settings/MemorySettings.vue";
import NotificationSettings from "@/components/workspace/settings/NotificationSettings.vue";
import SettingsPageLoading from "@/components/workspace/settings/SettingsPageLoading.vue";
import SkillSettings from "@/components/workspace/settings/SkillSettings.vue";
import SubagentSettings from "@/components/workspace/settings/SubagentSettings.vue";
import ToolSettings from "@/components/workspace/settings/ToolSettings.vue";
import {
  useSettingsDialog,
  type SettingsSection,
} from "@/composables/useSettingsDialog";
import {
  buildSettingsCloseLocation,
  readSettingsSection,
  SETTINGS_SECTIONS,
} from "@/core/workspace-shell/settings-query";
import { cn } from "@/lib/utils";

/*
  只有 Integrations 懒加载，其余八个静态引入。

  React settings-dialog.tsx 用 next/dynamic 把九个面板全部切开。**实测这条切法搬不过来**：
  九个都改成 defineAsyncComponent 之后 /workspace/chats/new 的关键路径反而涨了
  994,976 -> 1,007,885 raw、286,937 -> 291,507 br、40 -> 45 files（prefetch 少了 61 KB raw，
  但那是空闲期最低优先级的字节，拿阻塞首屏的 4.5 KB 去换不划算）。原因是 Rollup 会把九个
  异步 chunk 的公共依赖上提，而上提出来的那批又落在入口图里。chunk 划分是构建产物而不是
  可观察行为，所以这里按实测取更小的那一种，切分方式不跟 React 对齐；对照台账取样在稳定态，
  两种切法的可访问性树与几何完全相同。

  loadingComponent 保留：它渲染一个 role=status 的「Loading…」，与 React
  `{ loading: SettingsPageLoading }` 是同一句。
*/
const IntegrationsSettings = defineAsyncComponent({
  loader: () =>
    import("@/components/workspace/settings/IntegrationsSettings.vue"),
  loadingComponent: SettingsPageLoading,
});
/*
  与 React sections 的 icon 一一对应。

  `satisfies Record<SettingsSection, Component>` 不是装饰：少一个分区，
  下面 `SECTION_ICONS[id]` 那处索引本来就会红；**多一个**却一直没人查——
  `as const` 对多出来的键一声不响，于是「分区已经删了、图标还留着」
  可以一路全绿地烂着。加上之后两个方向都由 tsc 挡住（wave 106）。
*/
const SECTION_ICONS = {
  account: User,
  appearance: Palette,
  notification: Bell,
  channels: Cable,
  integrations: PlugZap,
  memory: Brain,
  tools: Wrench,
  subagents: UsersRound,
  skills: Sparkles,
  about: Info,
} as const satisfies Record<SettingsSection, Component>;

const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const settings = useSettingsDialog();
const sectionButtons = ref<Partial<Record<SettingsSection, HTMLButtonElement>>>(
  {},
);
let routeOwnsDialog = false;
let focusBeforeOpen: HTMLElement | null = null;

const sections = computed(() =>
  SETTINGS_SECTIONS.map((id) => ({
    id,
    label: $i18n.t.value.settings.sections[id],
    icon: SECTION_ICONS[id],
  })),
);

watch(
  () => route.query.settings,
  (value) => {
    const requested = readSettingsSection(value);
    if (requested) {
      if (!settings.open.value) {
        focusBeforeOpen =
          settings.returnFocus.value ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
      }
      routeOwnsDialog = true;
      settings.show(requested);
    } else if (routeOwnsDialog) {
      routeOwnsDialog = false;
      settings.close({ source: "route" });
    }
  },
  { immediate: true },
);

watch(
  () => settings.open.value,
  (open, previous) => {
    if (open && !previous && !focusBeforeOpen) {
      focusBeforeOpen =
        settings.returnFocus.value ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
    }
  },
);

function setSectionButton(
  section: SettingsSection,
  element: Element | { $el?: Element } | null,
) {
  const candidate = element && "$el" in element ? element.$el : element;
  if (candidate instanceof HTMLButtonElement) {
    sectionButtons.value[section] = candidate;
  }
}

/*
  **打开时把焦点放在当前分区那颗导航键上**，接管 reka 的 `open-auto-focus`。

  上游原来不接管，Radix 的默认落在第一个可聚焦元素，也就是永远的 "Account"。
  深链到 `?settings=appearance` 却把焦点丢在 "Account" 上，键盘与读屏用户得自己找路
  ——而 URL 已经说了要去哪一屏。**2026-09-11 两边同改**：上游
  `settings-dialog.tsx` 也接上了 `onOpenAutoFocus`，对照台账 `focus` 档上那两行随之清零。

  **两条 e2e 钉着它**：`tests/e2e/workspace-shell.spec.ts` 的
  「command palette…」与「settings deep link traps focus…」都断言深链之后焦点在
  "Appearance" 上。2026-09-10 有一轮把它误判成「没有依据的分歧」删掉，
  当场被这两条用例挡回来——**判据不在 settings-dialog 那几个文件名里，
  在 workspace-shell 里**。
*/
function focusInitial(event: Event) {
  event.preventDefault();
  void nextTick(() => sectionButtons.value[settings.section.value]?.focus());
}

function restoreFocus(event: Event) {
  event.preventDefault();
  focusBeforeOpen?.focus({ preventScroll: true });
  focusBeforeOpen = null;
  settings.returnFocus.value = null;
}

async function closeFromUser() {
  settings.close({ source: "user" });
  if (!routeOwnsDialog) return;
  routeOwnsDialog = false;
  await router.push(
    buildSettingsCloseLocation({
      path: route.path,
      query: route.query,
      hash: route.hash,
    }),
  );
}

function onOpenChange(open: boolean) {
  if (!open && settings.open.value) void closeFromUser();
}
</script>

<template>
  <Dialog :open="settings.open.value" @update:open="onOpenChange">
    <DialogContent
      data-testid="settings-dialog"
      :close-label="$i18n.t.value.primitives.close"
      :aria-describedby="undefined"
      class="flex h-[75vh] max-h-[calc(100vh-2rem)] flex-col sm:max-w-5xl md:max-w-6xl"
      @open-auto-focus="focusInitial"
      @close-auto-focus="restoreFocus"
    >
      <DialogHeader class="gap-1">
        <DialogTitle>{{ $i18n.t.value.settings.title }}</DialogTitle>
        <p class="text-muted-foreground text-sm">
          {{ $i18n.t.value.settings.description }}
        </p>
      </DialogHeader>
      <div class="grid min-h-0 flex-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav class="bg-sidebar min-h-0 overflow-y-auto rounded-lg border p-2">
          <ul class="space-y-1 pr-1">
            <li v-for="item in sections" :key="item.id">
              <button
                :ref="(element) => setSectionButton(item.id, element)"
                type="button"
                :class="
                  cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    settings.section.value === item.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                "
                @click="settings.section.value = item.id"
              >
                <component :is="item.icon" class="size-4" />
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </nav>
        <ScrollArea class="h-full min-h-0 rounded-lg border">
          <div class="space-y-8 p-6">
            <AccountSettings v-if="settings.section.value === 'account'" />
            <AppearanceSettings
              v-else-if="settings.section.value === 'appearance'"
            />
            <NotificationSettings
              v-else-if="settings.section.value === 'notification'"
            />
            <IntegrationsSettings
              v-else-if="settings.section.value === 'integrations'"
            />
            <ChannelConnections
              v-else-if="settings.section.value === 'channels'"
            />
            <ToolSettings v-else-if="settings.section.value === 'tools'" />
            <SubagentSettings
              v-else-if="settings.section.value === 'subagents'"
            />
            <SkillSettings v-else-if="settings.section.value === 'skills'" />
            <MemorySettings v-else-if="settings.section.value === 'memory'" />
            <AboutSettings v-else-if="settings.section.value === 'about'" />
          </div>
        </ScrollArea>
      </div>
    </DialogContent>
  </Dialog>
</template>
