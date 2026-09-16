/*
  【文件职责】     把一条媒体查询读成响应式布尔值，**客户端首次渲染就是真值**。
  【架构位置】     L3 Vue adapter
  【主要导出】     useMediaQuery
  【依赖关系】     Vue reactivity · useWorkspaceSidebar · WorkspacePanels
  【边界与注意】   ① **这个 composable 存在的理由是「首帧就对」，不是「少写几行」。**
                   本仓原来有两份手搓副本（`ThreadSidebar` 与 `WorkspacePanels`），
                   都是 `ref(false)` + 在 `onMounted` 里读 `matchMedia` 纠正。
                   而 Vue 的 `onMounted` 跑在**子组件全部挂载之后**，于是窄屏下：
                   首帧先挂桌面那一支 → 整棵侧栏子树连同它的查询一起起来 →
                   `onMounted` 才把 `isNarrow` 翻成 true → 子树整棵扔掉。
                   被扔掉的那一帧已经把请求发出去了（wave 214 实测：375px 上
                   从不打开抽屉，`GET /api/channels/providers` 照样发一次，
                   而 `WorkspaceChannelsList` 只存在于抽屉插槽里）。

                   ② **上游不吃这一口，靠的是 React 的副作用时序而不是别的。**
                   `useIsMobile` 是 `useSyncExternalStore`
                   （frontend/src/hooks/use-mobile.ts）：水合那一帧用
                   `getServerSnapshot()`（false，桌面），紧接着它在 **layout effect**
                   里发现真值不同、同步重渲染成移动端分支；而 React Query 的取数挂在
                   **passive effect** 上，跑在 layout effect 之后——桌面那棵子树在
                   自己的 passive effect 排到之前就已经被卸掉了，请求从来没发出去。
                   Vue 这边 `setup()` 是同步跑的，查询在创建那一刻就发了，
                   没有"排到之前"可言。**同一个意图，两套机制，所以照抄写法没用，
                   要照抄的是结果：窄屏上那棵子树一次都不要挂。**

                   ③ SSR 返回 false（按桌面渲染），与上游 `getServerSnapshot()` 逐字
                   相同。**本仓 `/workspace/**` 是 `ssr: false`（config/routes.ts 的
                   `csrRoutes`），所以不存在"首帧必须与服务端 HTML 一致"的约束**——
                   首次渲染就是客户端渲染，直接读真值不会有水合不一致。
                   哪天有 SSR 路由要用它，服务端仍然拿到 false、客户端首帧拿到真值，
                   那时才需要 `<ClientOnly>` 之类的处理，**不要靠给这里加延迟来回避**。
*/

import { getCurrentScope, onScopeDispose, ref, type Ref } from "vue";

export function useMediaQuery(query: string): Ref<boolean> {
  const media = globalThis.matchMedia?.(query) ?? null;
  const matches = ref(media?.matches ?? false);

  if (media) {
    const sync = (event: MediaQueryListEvent) => {
      matches.value = event.matches;
    };
    media.addEventListener("change", sync);
    // 组件之外调用（没有活动 scope）时不注册清理，否则 Vue 会警告一次空调用。
    if (getCurrentScope()) {
      onScopeDispose(() => media.removeEventListener("change", sync));
    }
  }

  return matches;
}
