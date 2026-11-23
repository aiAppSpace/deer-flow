<script setup lang="ts">
/*
  【文件职责】     编排 DeerFlow settings 的导航、路由深链与可访问 modal 生命周期。
  【架构位置】     L3 workspace settings shell
  【主要导出】     默认 SettingsDialog 组件
  【依赖关系】     ui/dialog · ui/scroll-area · useSettingsDialog · vue-router · settings panels
  【边界与注意】   useSettingsDialog 是唯一 UI owner；各 Query owner 保持在子面板内。

                   外壳的骨架逐行对照 React settings-dialog.tsx：可见的标题+描述、
                   220px 的 <nav><ul><li>、右侧 ScrollArea 里 space-y-8 p-4 sm:p-6 的容器。
                   各个 section 共用这一个外壳，所以这里每改一处，e2e-settings、
                   e2e-channels 与 e2e-visual 的两张设置截图都要一起跑。

                   描述用裸 <p> 而不是 DialogDescription，并显式摘掉 aria-describedby：
                   React 写的就是 aria-describedby={undefined}，读屏器只念标题，正文由
                   用户自己读到。Reka 无条件把它指向一个 description id，不摘掉就是一个
                   悬空 IDREF；没有 description 时显式移除对应引用。

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
  type AsyncComponentLoader,
} from "vue";
import {
  Bell,
  Bot,
  Brain,
  Cable,
  Info,
  Palette,
  User,
  UsersRound,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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

import SettingsPageLoading from "@/components/workspace/settings/SettingsPageLoading.vue";

// Each settings page owns its data and renderer dependencies only when selected,
// matching React's dynamic page boundary.
function settingsPage(loader: AsyncComponentLoader) {
  return defineAsyncComponent({
    loader,
    // Nuxt owns an outer Suspense; each panel must display its own loading UI.
    suspensible: false,
    loadingComponent: SettingsPageLoading,
    delay: 0,
  });
}

const AccountSettings = settingsPage(
  () => import("@/components/workspace/settings/AccountSettings.vue"),
);
const AppearanceSettings = settingsPage(
  () => import("@/components/workspace/settings/AppearanceSettings.vue"),
);
const NotificationSettings = settingsPage(
  () => import("@/components/workspace/settings/NotificationSettings.vue"),
);
const ChannelConnections = settingsPage(
  () => import("@/components/workspace/channels/ChannelConnections.vue"),
);
const MemorySettings = settingsPage(
  () => import("@/components/workspace/settings/MemorySettings.vue"),
);
const SubagentSettings = settingsPage(
  () => import("@/components/workspace/settings/SubagentSettings.vue"),
);
const ModelSettings = settingsPage(
  () => import("@/components/workspace/settings/ModelSettings.vue"),
);
const AboutSettings = settingsPage(
  () => import("@/components/workspace/settings/AboutSettings.vue"),
);

const SECTION_ICONS = {
  models: Bot,
  account: User,
  appearance: Palette,
  notification: Bell,
  channels: Cable,
  memory: Brain,
  subagents: UsersRound,
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

function keepSectionFocusVisible(event: FocusEvent) {
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
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
      class="[container-type:size] flex h-[75vh] max-h-[calc(100vh-2rem)] flex-col overflow-y-auto! [container-name:settings-dialog] sm:max-w-5xl md:max-w-6xl [@media(max-height:360px)]:h-[calc(100dvh-32px)] [@media(max-height:360px)]:max-h-[calc(100dvh-32px)] [@media(max-height:360px)]:gap-[8px] [@media(max-height:360px)]:p-[8px]"
      @open-auto-focus="focusInitial"
      @close-auto-focus="restoreFocus"
    >
      <DialogHeader class="gap-1">
        <DialogTitle>{{ $i18n.t.value.settings.title }}</DialogTitle>
        <p class="text-muted-foreground text-sm">
          {{ $i18n.t.value.settings.description }}
        </p>
      </DialogHeader>
      <!--
        窄屏列显式使用 minmax(0,1fr)，避免 nav 或面板的固有宽度撑破隐式 auto 列。
        该约束属于栅格，不在每个面板重复补偿。
      -->
      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 max-md:flex-none md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] [@container_settings-dialog_(height<28rem)]:flex-none [@container_settings-dialog_(height<28rem)]:grid-rows-[auto]"
      >
        <nav
          class="bg-sidebar min-h-0 min-w-0 overflow-x-hidden overflow-y-auto rounded-lg border p-2"
        >
          <ul class="min-w-0 space-y-1 pr-1">
            <li v-for="item in sections" :key="item.id">
              <button
                :ref="(element) => setSectionButton(item.id, element)"
                type="button"
                :class="
                  cn(
                    'flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium whitespace-normal transition-colors',
                    settings.section.value === item.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                "
                @click="settings.section.value = item.id"
                @focus="keepSectionFocusVisible"
              >
                <component :is="item.icon" class="size-4 shrink-0" />
                <span class="min-w-0 wrap-anywhere">{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </nav>
        <ScrollArea
          class="h-full min-h-0 min-w-0 rounded-lg border max-md:h-auto max-md:[&_[data-slot=scroll-area-viewport]]:h-auto max-md:[&_[data-slot=scroll-area-viewport]]:max-h-[100cqh] [&_[data-slot=scroll-area-viewport]>div]:block! [&_[data-slot=scroll-area-viewport]>div]:w-full! [&_[data-slot=scroll-area-viewport]>div]:max-w-full! [&_[data-slot=scroll-area-viewport]>div]:min-w-0! [@container_settings-dialog_(height<28rem)]:h-auto [@container_settings-dialog_(height<28rem)]:[&_[data-slot=scroll-area-viewport]]:h-auto [@container_settings-dialog_(height<28rem)]:[&_[data-slot=scroll-area-viewport]]:max-h-[100cqh]"
        >
          <!--
            窄屏（<sm）下对话框只有 343px 宽，这一层自己的内边距再加上集成页那张卡的
            px-6，内容列只剩 167px——比它里面的按钮与 OAuth scope 示例还窄，于是溢出。
            小屏降一档；sm 以上仍是桌面那一版量过的 24px。
          -->
          <div class="w-full max-w-full min-w-0 space-y-8 p-4 sm:p-6">
            <ModelSettings v-if="settings.section.value === 'models'" />
            <AccountSettings v-else-if="settings.section.value === 'account'" />
            <AppearanceSettings
              v-else-if="settings.section.value === 'appearance'"
            />
            <NotificationSettings
              v-else-if="settings.section.value === 'notification'"
            />
            <ChannelConnections
              v-else-if="settings.section.value === 'channels'"
            />
            <SubagentSettings
              v-else-if="settings.section.value === 'subagents'"
            />
            <MemorySettings v-else-if="settings.section.value === 'memory'" />
            <AboutSettings v-else-if="settings.section.value === 'about'" />
          </div>
        </ScrollArea>
      </div>
    </DialogContent>
  </Dialog>
</template>
