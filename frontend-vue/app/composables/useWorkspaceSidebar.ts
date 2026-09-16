/*
  【文件职责】     持有 workspace 侧栏的开合状态（桌面收起态、窄屏抽屉、窄屏判定）。
  【架构位置】     L3 Vue adapter
  【主要导出】     useWorkspaceSidebar
  【依赖关系】     Vue refs · ThreadSidebar · AgentChat · WorkspaceContainer
  【边界与注意】   ① **这份状态之所以要提出来，是因为触发器有三个调用点。**
                   此前 `collapsed` 是 ThreadSidebar 的组件局部 ref，另外两个触发器
                   （AgentChat / WorkspaceContainer）只往 window 上发
                   `deerflow:toggle-sidebar`，拿不到开合态，于是各自挑了一个固定图标。
                   状态不共享的时候，「画哪个图标」这个问题在那两处**无法回答**。

                   ② **`open` 只描述桌面侧栏，窄屏抽屉是 `mobileOpen`——这是上游语义，
                   照抄的是它的怪癖。** 上游 `useSidebar()` 的 `open` 来自 `_open`，
                   `toggleSidebar()` 却是 `isMobile ? setOpenMobile : setOpen`
                   （frontend/src/components/ui/sidebar.tsx:90）。于是窄屏下那颗
                   触发器读的是**桌面**的 open：`defaultOpen` 兜底为 true，抽屉关着时
                   图标画的却是 PanelLeftClose，点开也不变。这是上游的缺陷不是本仓的，
                   两边同改才有意义，本轮按对照原则先保持一致并记账。

                   ③ 模块级 `const ref` 即单例，与 `useSettingsDialog` 同一形状。
                   **`isNarrow` 不在这一列**：它是视口的纯函数，谁算都一样，
                   所以交给 `useMediaQuery` 按 scope 订阅，不必也不该做成单例。

                   ④ **`isNarrow` 首帧就是真值**，不是挂载后再纠正。为什么这件事
                   非这样不可（以及上游靠什么机制拿到同样的结果），写在
                   `useMediaQuery.ts` 的文件头 ①②。
*/

import { computed, ref } from "vue";

import { useMediaQuery } from "@/composables/useMediaQuery";

const SIDEBAR_COOKIE = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const SIDEBAR_NARROW_QUERY = "(max-width: 767px)";

const collapsed = ref(false);
const mobileOpen = ref(false);

/** 上游 `useSidebar().open`。见文件头 ②：**不**包含窄屏抽屉。 */
const open = computed(() => !collapsed.value);
/** 侧栏当前是否展示完整内容（窄屏抽屉打开时也算展开）。 */
const sidebarExpanded = computed(() => !collapsed.value || mobileOpen.value);

export function useWorkspaceSidebar() {
  const isNarrow = useMediaQuery(SIDEBAR_NARROW_QUERY);

  function setCollapsed(value: boolean) {
    collapsed.value = value;
    document.cookie = `${SIDEBAR_COOKIE}=${String(!value)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
  }

  function closeMobileSidebar() {
    mobileOpen.value = false;
  }

  function toggleSidebar() {
    if (isNarrow.value) {
      mobileOpen.value = !mobileOpen.value;
    } else {
      setCollapsed(!collapsed.value);
    }
  }

  /*
    收起（不是切换）。React 在选中 artifact 时调 `useSidebar().setOpen(false)`
    （frontend/src/components/workspace/artifacts/context.tsx），也就是把桌面侧栏
    收起并写进同一个 cookie；`openMobile` 不受影响。这里照同样的语义实现，
    用一个**独立**入口而不是给 toggle 加参数：一个叫 toggle 的函数有时不切换，
    是下一个读者最容易读错的那种代码。
  */
  function collapseSidebar() {
    if (collapsed.value) return;
    setCollapsed(true);
  }

  /** 从 cookie 恢复桌面收起态；只在客户端调用。 */
  function restoreFromCookie() {
    const persisted = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${SIDEBAR_COOKIE}=`))
      ?.slice(SIDEBAR_COOKIE.length + 1);
    if (persisted === "false") collapsed.value = true;
  }

  return {
    collapsed,
    mobileOpen,
    isNarrow,
    open,
    sidebarExpanded,
    setCollapsed,
    closeMobileSidebar,
    toggleSidebar,
    collapseSidebar,
    restoreFromCookie,
  };
}
