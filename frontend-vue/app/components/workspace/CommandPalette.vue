<script setup lang="ts">
/*
  【文件职责】     Workspace command palette 与全局快捷操作的唯一 window-listener owner。
  【架构位置】     L3 workspace shell
  【主要导出】     默认 CommandPalette 组件
  【依赖关系】     ui/dialog · ui/command · settings owner · shortcut matcher · Vue Router
  【边界与注意】   不持有 thread/server state；卸载时删除唯一 listener。
                   过滤仍然由本组件做（Command primitive 不接管筛选）；方向键、Enter、
                   aria-activedescendant 归 primitive，所以这里不再有第二份键盘状态机。
*/
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Keyboard, MessageSquarePlus, Settings } from "lucide-vue-next";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import {
  commandForWorkspaceShortcut,
  isWorkspaceShortcutEditableTarget,
  OTHER_SHORTCUT_MODIFIERS,
  shortcutModifierLabels,
  type ShortcutModifierLabels,
  type WorkspaceShortcutCommand,
} from "@/core/workspace-shell/shortcuts";

type PaletteCommand = Exclude<
  WorkspaceShortcutCommand,
  "command-palette" | "toggle-sidebar"
>;

const { $i18n } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const settings = useSettingsDialog();
const paletteOpen = ref(false);
const shortcutsOpen = ref(false);
const search = ref("");
let focusBeforeDialog: HTMLElement | null = null;

/*
  修饰键的写法跟着平台走，与上游同一条判据（见
  core/workspace-shell/shortcuts.ts）。SSR 与首帧用非 Mac 的一套，挂载后再问
  navigator——上游的 useState(false) + useEffect 也是这个顺序。
*/
const modifiers = ref<ShortcutModifierLabels>(OTHER_SHORTCUT_MODIFIERS);
onMounted(() => {
  modifiers.value = shortcutModifierLabels(globalThis.navigator?.userAgent);
});
const actions = computed(() => [
  {
    id: "new-chat" as const,
    label: $i18n.t.value.sidebar.newChat,
    shortcut: `${modifiers.value.meta}${modifiers.value.shift}N`,
    icon: MessageSquarePlus,
  },
  {
    id: "settings" as const,
    label: $i18n.t.value.common.settings,
    shortcut: `${modifiers.value.meta},`,
    icon: Settings,
  },
  {
    id: "shortcuts" as const,
    label: $i18n.t.value.shortcuts.keyboardShortcuts,
    shortcut: `${modifiers.value.meta}/`,
    icon: Keyboard,
  },
]);
/*
  行序与上游的对话框一致：K、⇧N、B、逗号、斜杠
  （frontend/src/components/workspace/command-palette.tsx 里那个数组）。
*/
const shortcutRows = computed(() => [
  {
    keys: `${modifiers.value.meta}K`,
    label: $i18n.t.value.shortcuts.openCommandPalette,
  },
  {
    keys: `${modifiers.value.meta}${modifiers.value.shift}N`,
    label: $i18n.t.value.sidebar.newChat,
  },
  {
    keys: `${modifiers.value.meta}B`,
    label: $i18n.t.value.shortcuts.toggleSidebar,
  },
  {
    keys: `${modifiers.value.meta},`,
    label: $i18n.t.value.common.settings,
  },
  {
    keys: `${modifiers.value.meta}/`,
    label: $i18n.t.value.shortcuts.keyboardShortcuts,
  },
]);
const filteredActions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return query
    ? actions.value.filter((action) =>
        action.label.toLocaleLowerCase().includes(query),
      )
    : actions.value;
});

function rememberFocus() {
  focusBeforeDialog =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
}

function openPalette() {
  rememberFocus();
  search.value = "";
  shortcutsOpen.value = false;
  paletteOpen.value = true;
}

function openShortcuts() {
  rememberFocus();
  paletteOpen.value = false;
  shortcutsOpen.value = true;
}

function restoreFocus(event: Event) {
  event.preventDefault();
  focusBeforeDialog?.focus({ preventScroll: true });
  focusBeforeDialog = null;
}

async function runCommand(command: PaletteCommand) {
  paletteOpen.value = false;
  if (command === "new-chat") {
    await router.push("/workspace/chats/new");
  } else if (command === "settings") {
    settings.show("appearance", {
      returnFocus:
        focusBeforeDialog ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null),
    });
  } else {
    openShortcuts();
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const command = commandForWorkspaceShortcut(event);
  if (!command) return;
  if (
    command !== "command-palette" &&
    isWorkspaceShortcutEditableTarget(event.target)
  ) {
    return;
  }
  event.preventDefault();
  if (command === "command-palette") {
    if (paletteOpen.value) paletteOpen.value = false;
    else openPalette();
  } else if (command === "toggle-sidebar") {
    globalThis.dispatchEvent(new CustomEvent("deerflow:toggle-sidebar"));
  } else {
    void runCommand(command);
  }
}

watch(
  () => route.fullPath,
  () => {
    paletteOpen.value = false;
    shortcutsOpen.value = false;
  },
);
onMounted(() => globalThis.addEventListener("keydown", onGlobalKeydown));
onUnmounted(() => globalThis.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <Dialog v-model:open="paletteOpen">
    <DialogContent
      class="overflow-hidden p-0"
      :close-label="$i18n.t.value.primitives.close"
      @close-auto-focus="restoreFocus"
    >
      <!--
        对话框的名字与说明照抄上游 `<CommandDialog>` 的默认值
        （ui/command.tsx:32/33 写死的 "Command Palette" / "Search for a command
        to run..."），走 primitives.* —— 与 close / toggleSidebar 那几条同一条规矩：
        上游写死英文的 primitive 名字，本仓照抄而不是另起一句。
        此前这里念的是 "Actions"，与上游不是同一句。
      -->
      <DialogTitle class="sr-only">
        {{ $i18n.t.value.primitives.commandPalette }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ $i18n.t.value.primitives.commandPaletteDescription }}
      </DialogDescription>
      <Command
        class="**:data-[slot=command-input-wrapper]:h-12 [&_[data-slot=command-group]]:px-2 [&_[data-slot=command-input-wrapper]_svg]:size-5 [&_[data-slot=command-item]]:px-2 [&_[data-slot=command-item]]:py-3 [&_[data-slot=command-item]_svg]:size-5"
      >
        <!--
          可访问名走 `label`（视觉隐藏的真 <label>），不是 aria-label——
          理由写在 `ui/command/CommandInput.vue` 的文件头：aria-label 名字是有了，
          但可访问性树里少一个 `text` 节点，等于把差异从一处挪到另一处。
          模型选择器那一处早就是这么接的（ComposerModelSelector.vue:176）。

          上游 `CommandDialog` 原来不给 `<Command>` 传 label，于是 cmdk 那个
          `<label cmdk-label>` 是空的、accname 算出空串、placeholder 兜底被压掉——
          **搜索框根本没有可访问名**。那是 WCAG 4.1.2 缺陷，已按「根因在 frontend/
          就两边同改」补在 `ui/command.tsx` 的 `CommandDialog` 上（wave 39）。
        -->
        <CommandInput
          v-model="search"
          :label="$i18n.t.value.shortcuts.searchActions.replace('...', '')"
          :placeholder="$i18n.t.value.shortcuts.searchActions"
        />
        <CommandList :aria-label="$i18n.t.value.shortcuts.actions">
          <CommandEmpty v-if="!filteredActions.length">
            {{ $i18n.t.value.shortcuts.noResults }}
          </CommandEmpty>
          <CommandGroup :heading="$i18n.t.value.shortcuts.actions">
            <CommandItem
              v-for="action in filteredActions"
              :key="action.id"
              :value="action.id"
              @select="runCommand(action.id)"
            >
              <component :is="action.icon" :size="16" />
              <span class="flex-1">{{ action.label }}</span>
              <CommandShortcut>{{ action.shortcut }}</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="shortcutsOpen">
    <DialogContent
      class="sm:max-w-md"
      :close-label="$i18n.t.value.primitives.close"
      @close-auto-focus="restoreFocus"
    >
      <DialogHeader
        ><DialogTitle>
          {{ $i18n.t.value.shortcuts.keyboardShortcuts }}
        </DialogTitle>
        <DialogDescription>
          {{ $i18n.t.value.shortcuts.keyboardShortcutsDescription }}
        </DialogDescription></DialogHeader
      >
      <div class="space-y-3 text-sm">
        <div
          v-for="row in shortcutRows"
          :key="row.keys"
          class="flex items-center justify-between"
        >
          <span class="text-muted-foreground">{{ row.label }}</span>
          <kbd
            class="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-xs"
            >{{ row.keys }}</kbd
          >
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
