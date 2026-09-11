<script setup lang="ts">
/*
  【文件职责】     DeerFlow thread 导航、搜索、分页、重命名与移动端侧栏。
  【架构位置】     L3
  【主要导出】     默认 ThreadSidebar 组件
  【依赖关系】     threads store/API · workspace routes · ui/dialog · ui/dropdown-menu
  【边界与注意】   业务导航壳，不属于通用 agent UI 契约。
*/
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  Bot,
  Bug,
  CalendarClock,
  ChevronsUpDown,
  Github,
  Globe,
  Info,
  Mail,
  MessageSquarePlus,
  MessagesSquare,
  Settings,
  Settings2,
} from "lucide-vue-next";

import WorkspaceChannelsList from "@/components/workspace/channels/WorkspaceChannelsList.vue";
import ProjectsSection from "@/components/workspace/projects/ProjectsSection.vue";
import ProjectMoveDialog from "@/components/workspace/projects/ProjectMoveDialog.vue";
import ThreadSidebarItem from "@/components/workspace/ThreadSidebarItem.vue";
import ThreadSidebarShell from "@/components/workspace/ThreadSidebarShell.vue";
import VirtualThreadList from "@/components/workspace/VirtualThreadList.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { useMoveThreadToProject } from "@/composables/useProjects";
import { useThreads } from "@/composables/useThreads";
import { useAgentsApiEnabled } from "@/composables/useWorkspaceFeatures";
import {
  SIDEBAR_NARROW_QUERY,
  useWorkspaceSidebar,
} from "@/composables/useWorkspaceSidebar";
import { ThreadCascadeDeleteError } from "@/core/threads/delete";
import { flattenThreadBranches } from "@/core/threads/thread-branch-tree";
import { pathOfThread, titleOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const route = useRoute();
const router = useRouter();
const { $i18n } = useNuxtApp();
const threads = useThreads();
const features = useAgentsApiEnabled();
const settingsDialog = useSettingsDialog();
const toast = useWorkspaceToast();
const sentinel = ref<HTMLElement | null>(null);
/*
  窄屏由 JS 判定而不是只靠 CSS：React 在移动端把侧栏换成 Sheet，关着时**整棵子树
  都不在 DOM 里**。只用 translate 推出屏幕的话，元素仍然可聚焦、仍然被读屏器遍历——
  用户会 Tab 进一个自己看不见的导航。SSR 阶段当作宽屏，与 React 的 useIsMobile
  在服务端返回 undefined（按桌面渲染）一致，水合后再纠正。

  开合态本身住在 `useWorkspaceSidebar`，不在这个组件里：触发器有三个调用点，
  另外两个（AgentChat / WorkspaceContainer）此前拿不到这份状态，见那个文件的头注释。
*/
const {
  collapsed,
  mobileOpen,
  isNarrow,
  open: sidebarOpen,
  sidebarExpanded,
  closeMobileSidebar,
  toggleSidebar,
  collapseSidebar,
  syncNarrow,
  restoreFromCookie,
} = useWorkspaceSidebar();
let narrowMedia: MediaQueryList | null = null;
const settingsOpen = ref(false);
const settingsTrigger = ref<HTMLButtonElement | null>(null);
const renameThreadId = ref<string | null>(null);
const renameTitle = ref("");
const deleteError = ref<string | null>(null);
const failedDeleteThread = ref<AgentThread | null>(null);
const deletingThreadId = ref<string | null>(null);
let observer: IntersectionObserver | null = null;
/** 哨兵在不在视口里。见下面观察者那段注释：它必须是状态，不能只当事件用。 */
const sentinelVisible = ref(false);

const displayThreadTitle = (thread: Parameters<typeof titleOfThread>[0]) =>
  titleOfThread(thread, $i18n.t.value.pages.untitled);

/*
  **窄屏抽屉的模态语义全部由 `ThreadSidebarShell` 里的 Sheet（reka Dialog）承担**
  （wave 148）。这里原来手写着四件套：window 上的 Escape 分支、`keydown` 里的
  Tab 陷阱、开合时的焦点保存/归还、以及一颗 `fixed inset-0` 的背景按钮。

  换掉它们不是为了少写代码——wave 147 把这一屏挂进对照取样面时量出 30 行差异，
  同一处根因：**上游的抽屉是 Radix Dialog，它给兄弟节点打 `aria-hidden`**，
  而手写这一套只声明了 `aria-modal="true"`。声明靠 AT 自己认，`aria-hidden`
  是事实。reka 的 `DialogContentModal` 内部就是 `useHideOthers` + `FocusScope`
  + `DismissableLayer`，四件事一次全给。
*/

onMounted(() => {
  narrowMedia = globalThis.matchMedia?.(SIDEBAR_NARROW_QUERY) ?? null;
  if (narrowMedia) {
    syncNarrow(narrowMedia);
    narrowMedia.addEventListener("change", syncNarrow);
  }
  restoreFromCookie();
  globalThis.addEventListener("deerflow:toggle-sidebar", toggleSidebar);
  globalThis.addEventListener("deerflow:collapse-sidebar", collapseSidebar);
  /*
    **观察者只记「哨兵在不在视口里」这个状态，翻页交给 watch。**

    写成「在回调里直接判 canLoadMore」是错的，而且错得很隐蔽：列表还空的时候
    哨兵本来就在视口内，回调触发一次、被 `canLoadMore === false` 挡掉；此后哨兵
    一直可见，**不会再有 intersection 事件**，于是首屏数据到了也永远不翻页。
    `scrollIntoViewIfNeeded` 对已在视口内的元素不滚动，也就不产生新事件——
    e2e `thread-list-infinite-scroll.spec.ts` 那条等满 15 秒超时就是这个形状。

    以前 `onMounted` 里有一句 `void threads.loadInitial()` 排在建观察者之前，
    时序上遮住了它；列表查询改成自己会跑（`enabled` 打开）之后那句没了，它就露出来了。
    **一次性事件 + 依赖异步状态的守卫**本来就是脆的，改成状态 + watch 才是对的形状。

    `loadMore()` 自己有在途守卫，重复触发安全。
  */
  observer = new IntersectionObserver(
    (entries) => {
      sentinelVisible.value = entries.some((entry) => entry.isIntersecting);
    },
    { rootMargin: "120px 0px 120px 0px" },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
watch([sentinelVisible, () => threads.canLoadMore], ([visible, canLoad]) => {
  if (visible && canLoad) void threads.loadMore();
});
onUnmounted(() => {
  narrowMedia?.removeEventListener("change", syncNarrow);
  observer?.disconnect();
  globalThis.removeEventListener("deerflow:toggle-sidebar", toggleSidebar);
  globalThis.removeEventListener("deerflow:collapse-sidebar", collapseSidebar);
});

watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous);
  if (element) observer?.observe(element);
});

watch(() => route.fullPath, closeMobileSidebar);

function isActive(path: string) {
  return route.path === path;
}

/*
  侧栏显示的行 = 前 200 条（threads.displayedThreads）**加上当前打开的那条**，
  哪怕它已经掉出上限之外。React 的 RecentChatList 就是这么补的：翻得足够深再点开
  一条老会话，不补的话侧栏里没有任何一行是高亮的，用户看不出自己在哪儿。
*/
/*
  移动会话到项目：**mutation 与对话框都由侧栏持有**，不放在会话行的下拉菜单里。
  菜单在点击后立刻卸载，挂在里面的失败回调会跟着没掉，错误就静默了
  （上游 move-to-project-menu.tsx 的注释也是这么写的）。
*/
const moveToProject = useMoveThreadToProject({
  onError: (error) =>
    toast.error(error.message || $i18n.t.value.projects.moveFailed),
});
const newProjectForThreadId = ref<string | null>(null);

/*
  侧栏列表按**分支树**展开：分叉出来的会话缩进挂在父会话下面，而不是按时间
  散在列表各处。摊成带 `thread_id` 的行，是因为虚拟列表的泛型只要求这一个字段
  （见 VirtualThreadList 的 `generic="Row extends { thread_id: string }"`），
  这样分支信息能一路带到行组件里而不用改那份契约。
*/

function requestMoveToProject(threadId: string, projectId: string | null) {
  moveToProject.mutate({ threadId, projectId });
}

const sidebarThreads = computed(() => {
  const activeId = route.params.thread_id;
  if (typeof activeId !== "string" || !activeId) {
    return threads.displayedThreads;
  }
  if (
    threads.displayedThreads.some((thread) => thread.thread_id === activeId)
  ) {
    return threads.displayedThreads;
  }
  const active = threads.threads.find(
    (thread) => thread.thread_id === activeId,
  );
  return active
    ? [...threads.displayedThreads, active]
    : threads.displayedThreads;
});

const sidebarRows = computed(() =>
  flattenThreadBranches(sidebarThreads.value).map((entry) => ({
    ...entry,
    thread_id: entry.thread.thread_id,
  })),
);

function startNewChat() {
  mobileOpen.value = false;
  globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
}

/*
  「删掉的是不是我正看着的那条」有三种成立方式，照 React 的 handleDelete
  （frontend/src/components/workspace/recent-chat-list.tsx）：路由参数就是它、
  当前路径就是它的路径、**或者**停在 /chats/new 而它是列表里最新的一条。
  第三种最容易漏：新会话页此时展示的就是最新那条的延续，删掉它却不重置，
  用户会对着一个已经不存在的线程继续输入。

  判定必须在 await 之前做完——删完之后列表已经变了，`threads[0]` 不再是刚才那条。
  目标路径也不能写死 /workspace/chats/new：在 agent 会话里要回到那个 agent 的新会话页。
*/
function isCurrentThread(thread: AgentThread) {
  const threadPath = pathOfThread(thread);
  const newThreadPath = nextThreadPath();
  return (
    thread.thread_id === route.params.thread_id ||
    threadPath === route.path ||
    (route.path === newThreadPath &&
      threads.threads[0]?.thread_id === thread.thread_id)
  );
}

function nextThreadPath() {
  const agentName = route.params.agent_name;
  return pathOfThread("new", {
    agent_name: typeof agentName === "string" ? agentName : undefined,
  });
}

async function removeThread(thread: AgentThread) {
  const threadId = thread.thread_id;
  if (deletingThreadId.value) return;
  const active = isCurrentThread(thread);
  const nextPath = nextThreadPath();
  deleteError.value = null;
  failedDeleteThread.value = null;
  deletingThreadId.value = threadId;
  try {
    await threads.remove(threadId);
    if (active) {
      // 先重置会话状态再换 URL，与 React 的 resetThreadChatAfterDelete + replace 同序。
      globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
      // replace 而不是 push：删完再按后退不该回到一个已经不存在的线程。
      await router.replace(nextPath);
    }
  } catch (cause) {
    failedDeleteThread.value = thread;
    deleteError.value =
      cause instanceof ThreadCascadeDeleteError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : $i18n.t.value.navigation.deleteConversationFailed;
  } finally {
    deletingThreadId.value = null;
  }
}

function beginRename(threadId: string) {
  const thread = threads.threads.find((item) => item.thread_id === threadId);
  renameThreadId.value = threadId;
  renameTitle.value = thread ? displayThreadTitle(thread) : "";
}

/*
  失败走 toast，不是对话框里的内联错误——React 的 handleRenameSubmit 就是
  `toast.error(error.message || t.common.renameFailed)`，对话框保持打开、内容不变。
  内联错误看起来更贴心，但那样 Vue 的这个对话框比 React 多一个 alert 节点，
  而这份对照的判据是双向的。
*/
async function submitRename() {
  if (!renameThreadId.value || !renameTitle.value.trim()) return;
  try {
    await threads.rename(renameThreadId.value, renameTitle.value.trim());
    renameThreadId.value = null;
  } catch (cause) {
    toast.error(
      cause instanceof Error && cause.message
        ? cause.message
        : $i18n.t.value.common.renameFailed,
    );
  }
}

/*
  置顶失败要说出来。原来模板里直接写 `threads.setPinned(...)`——一个没人 await、
  也没人 catch 的 Promise：后端拒绝时界面什么都不显示，控制台多一条 unhandled
  rejection，用户只看到那一行没有置顶，不知道是没生效还是自己没点中。
  React 的 handleTogglePin 就是 `toast.error(err.message || t.chats.pinChatFailed)`。
*/
async function togglePinned(thread: AgentThread) {
  try {
    await threads.setPinned(thread.thread_id, !threads.isPinned(thread));
  } catch (cause) {
    toast.error(
      cause instanceof Error && cause.message
        ? cause.message
        : $i18n.t.value.chats.pinChatFailed,
    );
  }
}

function openSettingsDialog(section: "appearance" | "about") {
  settingsOpen.value = false;
  settingsDialog.show(section, { returnFocus: settingsTrigger.value });
}
</script>

<template>
  <!--
    侧栏是 div、导航是 ul/li，都照 React 的 shadcn sidebar
    （frontend/src/components/ui/sidebar.tsx）。改成 aside + nav 看起来更"语义"，
    但那样 Vue 会比 React 多出 complementary 与 navigation 两个地标，读屏器的地标
    列表两边对不上；而条目不放在 li 里，读屏器就不会报"第 2 项，共 4 项"。

    窄屏下整个侧栏**不渲染**：React 在移动端换成一个 Sheet，关着的时候 DOM 里什么
    都没有。Vue 原来只是把它 translate 出屏幕——看不见，但 Tab 一路按下去仍然会走
    进这 5 个入口，读屏器也照念不误。
  -->
  <ThreadSidebarShell
    :narrow="isNarrow"
    :open="mobileOpen"
    :collapsed="collapsed"
    :title="$i18n.t.value.primitives.sidebar"
    :description="$i18n.t.value.primitives.sidebarDescription"
    :close-label="$i18n.t.value.navigation.closeSidebar"
    @update:open="mobileOpen = $event"
  >
    <!--
      收起态换的是**整块**头部，不是给同一块加几个 class：React 的 WorkspaceHeader
      在 collapsed 分支里渲染的是「DF + 悬停才出现的触发器」，展开分支才是
      「DeerFlow + 常驻触发器」（frontend/src/components/workspace/workspace-header.tsx）。
      触发器在收起态是 display:none 直到悬停，所以它此时**不在可访问性树里**——
      不是看不见而已。
    -->
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      class="flex flex-col gap-2 px-2"
    >
      <!--
        两层，不是一层：上游外层是 `flex h-12 flex-col justify-center`（定高 48），
        内层才是 `flex items-center justify-between gap-2`，高度贴着最高的那个
        child 走（实测 28，就是触发器）。拍平成一层的话位置仍然对得上——因为定高
        由外层给——但"这一行有多高"这个信息就没了，下一个人往里加东西时无从判断
        是谁在撑高度。
      -->
      <div
        class="group/workspace-header flex h-12 shrink-0 flex-col justify-center"
      >
        <div
          v-if="sidebarExpanded"
          class="flex items-center justify-between gap-2"
        >
          <div class="text-primary ml-2 cursor-default font-serif">
            DeerFlow
          </div>
          <!--
            名字恒为 "Toggle Sidebar"，也不带 aria-expanded：React 的 SidebarTrigger
            就是一个 sr-only 的固定名字。名字随收起态在"收起/展开"之间来回换，读屏器
            每次折叠都会重念一遍按钮，用户听到的是控件变了，其实只是状态变了。

            **展开态不传任何可见性 class**，这是上游的形状（`<SidebarTrigger />`）。
            此前本仓传的是 `hidden md:flex`，于是窄屏抽屉里这颗触发器是**没有的**；
            上游的 Sheet 里它一直在——抽屉里没有关闭入口，只能点遮罩或按 Esc。

            **图标读的状态要分窄屏**：这一处在桌面侧栏与窄屏抽屉里都渲染，
            而窄屏抽屉的开合是 `mobileOpen`。传桌面的 `open` 会让抽屉里那颗图标恒定
            且指反。上游同一处是 `isMobile ? openMobile : open`（已两边同改，
            sidebar.tsx:261）；这里的 class 没写死语境，所以照它问一次 `isNarrow`。
          -->
          <SidebarTrigger
            :open="isNarrow ? mobileOpen : sidebarOpen"
            :aria-label="$i18n.t.value.primitives.toggleSidebar"
            @click="toggleSidebar"
          />
        </div>
        <div
          v-else
          class="flex w-full cursor-pointer items-center justify-center"
        >
          <span
            class="text-primary block pt-1 font-serif group-hover/workspace-header:hidden"
            >DF</span
          >
          <!--
            收起态的 class 照抄上游：`hidden pl-2 group-hover/workspace-header:block`。
            那个 `block` 会经 twMerge 盖掉 Button base 的 `inline-flex`——看着像笔误，
            但它是上游的实际渲染，改成 flex 两边就不一样了。
            这一支只在桌面出现：窄屏收起时侧栏整棵子树都不渲染。
          -->
          <SidebarTrigger
            :open="sidebarOpen"
            class="hidden pl-2 group-hover/workspace-header:block"
            :aria-label="$i18n.t.value.primitives.toggleSidebar"
            @click="toggleSidebar"
          />
        </div>
      </div>
      <!--
        「新对话」和上面那条标题栏同属 SidebarHeader，中间隔 gap-2（8px）：React 把
        两者一起交给 SidebarHeader（frontend/src/components/workspace/workspace-sidebar.tsx），
        那是 `flex flex-col gap-2 p-2`，再被页面的 `py-0` 抹掉上下内边距。
        原来两块是平级兄弟、靠第一组 ul 的 pt-2 凑出这 8px，凑得出位置凑不出结构——
        侧栏一旦要整体滚动，靠 padding 拼出来的间距会跟着一起错位。
      -->
      <ul
        data-slot="sidebar-menu"
        data-sidebar="menu"
        class="flex w-full min-w-0 flex-col gap-1 text-sm"
      >
        <li data-slot="sidebar-menu-item" data-sidebar="menu-item">
          <NuxtLink
            data-slot="sidebar-menu-button"
            data-sidebar="menu-button"
            to="/workspace/chats/new"
            :data-active="isActive('/workspace/chats/new')"
            class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2 font-medium"
            :title="collapsed ? $i18n.t.value.sidebar.newChat : undefined"
            @click="startNewChat"
          >
            <MessageSquarePlus :size="16" class="shrink-0" />
            <span v-if="sidebarExpanded">{{
              $i18n.t.value.sidebar.newChat
            }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
    <!--
      导航、渠道、最近的对话住在**同一个可滚动容器**里，组与组之间 gap-2——这是
      React 的 SidebarContent（`flex min-h-0 flex-1 flex-col gap-2 overflow-auto`）。

      原来只有「最近的对话」那个 ul 自己 overflow-y-auto，导航入口固定在上方不动。
      看起来更好用，但那不是 React 的行为：会话多到要滚动时，React 会把导航一起滚走。
      更要紧的是位置——少了组间那 8px，整块「最近的对话」比 React 高 8px，再加上
      标题没有按 SidebarGroupLabel 的 h-8 + 组内边距排，每一行会话都落在错的 y 上。
    -->
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto"
    >
      <div
        data-slot="sidebar-group"
        data-sidebar="group"
        class="relative flex w-full min-w-0 flex-col p-2 pt-1"
      >
        <ul
          data-slot="sidebar-menu"
          data-sidebar="menu"
          class="flex w-full min-w-0 flex-col gap-1 text-sm"
        >
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item">
            <NuxtLink
              data-slot="sidebar-menu-button"
              data-sidebar="menu-button"
              class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2"
              :data-active="
                route.path.startsWith('/workspace/chats') &&
                !isActive('/workspace/chats/new')
              "
              to="/workspace/chats"
              :title="collapsed ? $i18n.t.value.sidebar.chats : undefined"
            >
              <MessagesSquare :size="16" class="shrink-0" />
              <span v-if="sidebarExpanded">{{
                $i18n.t.value.sidebar.chats
              }}</span>
            </NuxtLink>
          </li>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item">
            <NuxtLink
              v-if="features.agentsApiEnabled.value"
              data-slot="sidebar-menu-button"
              data-sidebar="menu-button"
              class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2"
              :data-active="route.path.startsWith('/workspace/agents')"
              to="/workspace/agents"
              :title="collapsed ? $i18n.t.value.sidebar.agents : undefined"
            >
              <Bot :size="16" class="shrink-0" />
              <span v-if="sidebarExpanded">{{
                $i18n.t.value.sidebar.agents
              }}</span>
            </NuxtLink>
            <!--
              禁用那一支的**外观**照上游 workspace-nav-chat-list.tsx:56 抄三条：
              ① 包裹层 `cursor-not-allowed`——上游明写在这一层（还留了注释说明
                 为什么在 span 上而不在按钮上：按钮已经 pointer-events:none）；
              ② 按钮 `aria-disabled:pointer-events-none aria-disabled:opacity-50`
                 ——上游 SidebarMenuButton 的 cva 自带这两条，本仓原来一条都没有，
                 于是这个禁用的入口**还会跟着鼠标高亮**，看起来和能点的一样；
              ③ 颜色是 `text-muted-foreground/50`（半透明），不是全实的 muted。
            -->
            <div v-else class="group relative block w-full cursor-not-allowed">
              <button
                type="button"
                :aria-label="$i18n.t.value.sidebar.agents"
                aria-disabled="true"
                aria-describedby="agents-disabled-description"
                class="text-muted-foreground/50 hover:bg-sidebar-accent flex h-8 w-full items-center gap-2 rounded-md px-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                <Bot :size="16" class="shrink-0" />
                <span v-if="sidebarExpanded">{{
                  $i18n.t.value.sidebar.agents
                }}</span>
              </button>
              <span id="agents-disabled-description" class="sr-only">{{
                $i18n.t.value.sidebar.agentsDisabledTooltip
              }}</span>
              <!--
                这里刻意**不**换成 Tooltip primitive。禁用入口的原因必须对键盘和读屏器
                恒定可见，所以它挂在一个常驻的 aria-describedby 上；Reka 的 tooltip 只在
                打开时才写 aria-describedby，as-child 合并会把这条常驻关联覆盖成 undefined。
                悬停浮层在这里只是视觉补充，用 CSS 就够。
              -->
              <span
                aria-hidden="true"
                class="bg-popover text-popover-foreground absolute top-full left-2 z-50 hidden rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow group-focus-within:block group-hover:block"
                >{{ $i18n.t.value.sidebar.agentsDisabledTooltip }}</span
              >
            </div>
          </li>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item">
            <NuxtLink
              data-slot="sidebar-menu-button"
              data-sidebar="menu-button"
              to="/workspace/scheduled-tasks"
              class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent flex h-8 items-center gap-2 rounded-md px-2"
              :data-active="route.path.startsWith('/workspace/scheduled-tasks')"
              :title="
                collapsed ? $i18n.t.value.sidebar.scheduledTasks : undefined
              "
            >
              <CalendarClock :size="16" class="shrink-0" />
              <span v-if="sidebarExpanded">{{
                $i18n.t.value.sidebar.scheduledTasks
              }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <WorkspaceChannelsList v-if="sidebarExpanded" />

      <!--
        项目区排在最近会话之前，与上游 `workspace-sidebar.tsx` 的顺序一致
        （ProjectsSection 在 RecentChatList 上面）。同样只在展开态渲染：
        收成图标条时它自己也会靠 group-data-[collapsible=icon] 收起来，
        但整段不渲染更省一次布局。
      -->
      <ProjectsSection
        v-if="sidebarExpanded"
        :current-path="route.path"
        :active-thread-id="
          typeof route.params.thread_id === 'string'
            ? route.params.thread_id
            : null
        "
        :title-of="displayThreadTitle"
        :is-active-path="isActive"
        :deleting-thread-id="deletingThreadId"
        @rename-thread="beginRename($event)"
        @toggle-pin-thread="togglePinned($event)"
        @delete-thread="removeThread($event)"
      />

      <!--
        一条会话都没有的时候，标题和列表**都不渲染**——React 的 RecentChatList 在
        threads.length === 0 时直接 return null。留一个空标题加一个空 ul，读屏器会
        念出「最近的对话，列表，0 项」，而屏幕上其实什么都没有。
      -->
      <div
        v-if="sidebarExpanded && sidebarRows.length"
        data-slot="sidebar-group"
        data-sidebar="group"
        class="relative flex w-full min-w-0 flex-col p-2"
      >
        <div
          data-slot="sidebar-group-label"
          data-sidebar="group-label"
          class="text-sidebar-foreground/70 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium"
        >
          {{ $i18n.t.value.sidebar.recentChats }}
        </div>
        <div
          data-slot="sidebar-group-content"
          data-sidebar="group-content"
          class="w-full text-sm"
        >
          <ul
            data-slot="sidebar-menu"
            data-sidebar="menu"
            class="flex w-full min-w-0 flex-col gap-1"
          >
            <!--
              按钮和哨兵是 ul 的**非 li 子节点**，与 React 一样：它们不是列表项，
              包进 li 会让读屏器把「加载更早的对话」念成第 51 个会话。哨兵还要
              aria-hidden——一个 1px 高的空 li 在可访问性树里是一个真实的 listitem。
            -->
            <div
              class="flex w-full flex-col gap-1"
              style="overflow-anchor: none"
            >
              <VirtualThreadList
                :estimate-size="36"
                :gap="4"
                :items="sidebarRows"
                scroll-parent-selector='[data-sidebar="content"]'
              >
                <template #default="{ thread: row }">
                  <ThreadSidebarItem
                    :thread="row.thread"
                    :title="displayThreadTitle(row.thread)"
                    :is-active="isActive(pathOfThread(row.thread))"
                    :pinned="threads.isPinned(row.thread)"
                    :deleting="deletingThreadId === row.thread.thread_id"
                    :branch-entry="row"
                    @rename="beginRename(row.thread.thread_id)"
                    @toggle-pin="togglePinned(row.thread)"
                    @delete="removeThread(row.thread)"
                    @new-project-for-thread="
                      newProjectForThreadId = row.thread.thread_id
                    "
                    @move-to-project="
                      requestMoveToProject(row.thread.thread_id, $event)
                    "
                  />
                </template>
              </VirtualThreadList>
              <template v-if="threads.hasMore && threads.canLoadMore">
                <!--
                  上游 `recent-chat-list.tsx:434` 是
                  `<Button variant="ghost" size="sm"
                  className="mx-2 my-1 w-[calc(100%-1rem)] justify-center text-xs">`。
                  手写那版把悬停色写成了 **sidebar-accent**，而上游这一颗走的是
                  Button 的 ghost 变体、用的是普通 **accent**——两套变量在深色主题下
                  不是同一个值。另外少 `cursor-pointer`、3px 焦点环、
                  `dark:hover:bg-accent/50`、`gap-1.5` 与 `font-medium`。
                -->
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="recent-chat-list-load-more"
                  :disabled="threads.loadingMore"
                  class="mx-2 my-1 w-[calc(100%-1rem)] justify-center text-xs"
                  @click="threads.loadMore()"
                >
                  {{
                    threads.loadingMore
                      ? $i18n.t.value.chats.loadingMore
                      : $i18n.t.value.chats.loadOlderChats
                  }}
                </Button>
                <div
                  ref="sentinel"
                  aria-hidden="true"
                  data-testid="recent-chat-list-sentinel"
                  class="h-px w-full"
                />
              </template>
            </div>
          </ul>
        </div>
      </div>
    </div>
    <div
      v-if="sidebarExpanded && deleteError"
      role="alert"
      data-testid="delete-chat-error"
      class="border-destructive/30 bg-destructive/5 text-destructive mx-2 mb-2 rounded-md border p-2 text-xs"
    >
      <p>{{ deleteError }}</p>
      <button
        v-if="failedDeleteThread"
        type="button"
        class="mt-1 underline disabled:pointer-events-none disabled:opacity-50"
        :disabled="Boolean(deletingThreadId)"
        @click="removeThread(failedDeleteThread)"
      >
        {{ $i18n.t.value.navigation.tryAgain }}
      </button>
    </div>
    <!--
      SidebarFooter：`flex flex-col gap-2 p-2` 的独立容器，不是给 ul 挂个 mt-auto。
      上游把它与 header / content 并列交给 Sidebar
      （frontend/src/components/workspace/workspace-sidebar.tsx），`mt-auto` 那种写法
      位置对得上、结构对不上：footer 一旦要放第二块东西（上游 gap-2 就是为它留的），
      挂在 ul 上的 mt-auto 会把那块也一起推到底。
    -->
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      class="mt-auto flex flex-col gap-2 p-2"
    >
      <ul
        data-slot="sidebar-menu"
        data-sidebar="menu"
        class="flex w-full min-w-0 flex-col gap-1"
      >
        <li
          data-slot="sidebar-menu-item"
          data-sidebar="menu-item"
          class="group/menu-item relative"
        >
          <DropdownMenu v-model:open="settingsOpen">
            <DropdownMenuTrigger>
              <!--
              名字只来自可见文字，不额外挂 aria-label / title：React 的
              WorkspaceNavMenu 给这颗按钮的全部内容就是收起时一个图标、展开时
              图标 + "Settings and more" 文本（frontend/src/components/workspace/workspace-nav-menu.tsx），
              没有 sr-only 也没有 tooltip prop。补上名字听起来更好，但那样两个
              应用在收起态念出来的东西不一样，而这份对照要求它们一样。

              **这里刻意不写 `data-slot`。** 上游是
              `<DropdownMenuTrigger asChild><SidebarMenuButton size="lg">`，两层
              as-child 之后留在 DOM 上的是**最外层**那个——probe 实测 React 这颗按钮
              的 data-slot 是 `dropdown-menu-trigger`，不是 `sidebar-menu-button`
              （坑 62）。本仓 reka 的 DropdownMenuTrigger 同样会写上自己的 slot，
              所以补一个 `sidebar-menu-button` 只会把它盖掉、反而与上游不一致。
              `data-sidebar` / `data-size` 上游不会覆盖，照写。

              `h-12` 来自上游的 `<SidebarMenuButton size="lg">`（cva 的 lg 档就是
              `h-12 text-sm`），此前本仓写的是 h-9，整块 footer 因此矮 12px。

              **收起态换尺寸，不是只换内容。** 上游 SidebarMenuButton 的 cva 里有
              `group-data-[collapsible=icon]:size-8!`（base）与
              `group-data-[collapsible=icon]:p-0!`（lg 档），两条都带 `!`，
              后定义的 `p-0` 赢——收起时它是一颗 **32×32、内边距 0** 的方钮。
              本仓的收起态不是 `data-collapsible=icon`，是自己的 `collapsed` ref，
              所以那两条选择器永远不成立：此前收起时仍然是 `h-12 w-full p-2`。
              wave 74 两个应用同屏实测：React 32×32 / padding 0，本仓 **31×48 / padding 8**
              ——**整块 footer 高出 16px**。
              内层那个 div 也是上游的：图标与文字住在
              `text-muted-foreground flex w-full items-center gap-2` 里，
              按钮本身不带前景色——收起态换的是**整块内容**（居中的单图标），
              不是给同一块加几个 class。
            -->
              <!--
                两个状态都要有名字：收起态只渲染一个 settings 图标，没有
                aria-label 时读屏器只念得出「按钮」（wave 62 用 parity probe
                普查出来的三颗无名控件之一）。名字取展开态显示的那一句，
                所以可访问名与可见名一致。**上游同一处也没有名字，已两边同改**
                （frontend/src/components/workspace/workspace-nav-menu.tsx）。
              -->
              <button
                ref="settingsTrigger"
                type="button"
                data-sidebar="menu-button"
                data-size="lg"
                data-testid="workspace-nav-menu-trigger"
                :aria-label="$i18n.t.value.workspace.settingsAndMore"
                class="peer/menu-button hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center gap-2 overflow-hidden rounded-md text-left text-sm"
                :class="
                  sidebarExpanded ? 'h-12 w-full p-2' : 'size-8 shrink-0 p-0'
                "
              >
                <div
                  v-if="sidebarExpanded"
                  class="text-muted-foreground flex w-full items-center gap-2 text-left text-sm"
                >
                  <Settings :size="16" class="shrink-0" />
                  <span>{{ $i18n.t.value.workspace.settingsAndMore }}</span>
                  <ChevronsUpDown
                    :size="16"
                    class="text-muted-foreground ml-auto"
                  />
                </div>
                <div v-else class="flex size-full items-center justify-center">
                  <Settings :size="16" class="text-muted-foreground" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              class="w-[calc(var(--reka-dropdown-menu-trigger-width))] min-w-56"
            >
              <!--
                这六颗图标**不写尺寸**：上游 workspace-nav-menu.tsx 里全是裸标签
                （`<Settings2Icon />` / `<GlobeIcon />` / …），尺寸由
                DropdownMenuItem 的 `[&_svg:not([class*='size-'])]:size-4` 给，
                也就是 16px。本仓原来每颗手写 `:size="14"`——**比上游小 2px**，
                而且那是因为本仓的 DropdownMenuItem 当时根本没有那条默认规则
                （wave 75 一并补上了）。颜色同理：那一层的
                `[&_svg:not([class*='text-'])]:text-muted-foreground` 让图标是中灰的。
              -->
              <!--
                上游 workspace-nav-menu.tsx:90 把「设置 + 四条外链」括成一个
                `DropdownMenuGroup`（role="group"）。本仓此前没有这个 primitive，
                对照树里 `group:` 那一行只在 React 那边有——wave 86 把这颗菜单
                接进取样面之后一次量到。
              -->
              <DropdownMenuGroup>
                <DropdownMenuItem @select="openSettingsDialog('appearance')">
                  <Settings2 /> {{ $i18n.t.value.common.settings }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem as-child>
                  <a
                    href="https://deerflow.tech/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex w-full items-center gap-2"
                  >
                    <Globe />
                    {{ $i18n.t.value.workspace.officialWebsite }}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem as-child>
                  <a
                    href="https://github.com/bytedance/deer-flow"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex w-full items-center gap-2"
                  >
                    <Github />
                    {{ $i18n.t.value.workspace.visitGithub }}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem as-child>
                  <a
                    href="https://github.com/bytedance/deer-flow/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex w-full items-center gap-2"
                  >
                    <Bug /> {{ $i18n.t.value.workspace.reportIssue }}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem as-child>
                  <a
                    href="mailto:support@deerflow.tech"
                    class="flex w-full items-center gap-2"
                  >
                    <Mail /> {{ $i18n.t.value.workspace.contactUs }}
                  </a>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="openSettingsDialog('about')">
                <Info /> {{ $i18n.t.value.workspace.about }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </div>
    <!--
      SidebarRail：一条贴着侧栏右缘、宽 16px 的拖拽热区，点一下也能收起/展开。
      tabindex="-1" 是 React 的选择——它与头部那个触发器同名同功能，进 Tab 序列
      只会让键盘用户连按两次听到同一个按钮。

      rail 是 `sm:flex`（≥640px 就在），而窄屏抽屉的分界是 768px，所以
      640~767px 这一档 rail 是**看得见的**。此前这里调的是 `setCollapsed`，
      在那一档点它会去改桌面收起态、而不是关掉眼前的抽屉；上游 SidebarRail 调的
      是 `toggleSidebar()`（认窄屏）。

      **光标要跟着收起态翻。** 上游 ui/sidebar.tsx:301 是两条：
      展开（`[data-side=left]`）时 `cursor-w-resize`（往左＝收起），
      收起（`[data-state=collapsed]`）时翻成 `cursor-e-resize`（往右＝展开）。
      本仓原来写死 `cursor-w-resize`：侧栏已经收到最窄了，鼠标还在说「往左拖」。
      wave 72 探针实测（artifact-preview 场景、侧栏收起态）：React `e-resize`、
      本仓 `w-resize`。`transition-all ease-linear` 也是上游那一层的。
    -->
    <button
      type="button"
      data-slot="sidebar-rail"
      data-sidebar="rail"
      :aria-label="$i18n.t.value.primitives.toggleSidebar"
      :title="$i18n.t.value.primitives.toggleSidebar"
      tabindex="-1"
      class="hover:after:bg-sidebar-border absolute inset-y-0 -right-4 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex"
      :class="collapsed ? 'cursor-e-resize' : 'cursor-w-resize'"
      @click="toggleSidebar"
    />
  </ThreadSidebarShell>
  <Dialog
    :open="renameThreadId !== null"
    @update:open="!$event && (renameThreadId = null)"
  >
    <DialogContent
      class="sm:max-w-sm"
      :close-label="$i18n.t.value.primitives.close"
    >
      <!--
        标题、输入框的名字来源和"没有描述"都照 React 的重命名对话框：标题是
        `common.rename`（"Rename"，不是"Rename chat"），输入框**只有 placeholder**、
        没有 aria-label 也没有 sr-only 描述。给它补一个名字是更好的可访问性，
        但那样两个应用的对话框叫两个名字、输入框念两句话，对照永远对不上。
      -->
      <form class="grid gap-4" @submit.prevent="submitRename">
        <DialogHeader>
          <DialogTitle>{{ $i18n.t.value.common.rename }}</DialogTitle>
        </DialogHeader>
        <input
          v-model="renameTitle"
          :placeholder="$i18n.t.value.common.rename"
          class="border-input w-full rounded-md border px-3 py-2"
        />
        <DialogFooter>
          <Button variant="outline" @click="renameThreadId = null">
            {{ $i18n.t.value.common.cancel }}
          </Button>
          <Button type="submit">{{ $i18n.t.value.common.save }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
  <!--
    新建项目对话框挂在**下拉菜单之外**：菜单一关就卸载，挂在里面它还没打开就没了。
  -->
  <ProjectMoveDialog
    :thread-id="newProjectForThreadId"
    @close="newProjectForThreadId = null"
  />
</template>
