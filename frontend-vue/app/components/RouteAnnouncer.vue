<script setup lang="ts">
/*
  【文件职责】     路由切换时向辅助技术播报新页面名。
  【架构位置】     L3 application shell
  【主要导出】     默认 RouteAnnouncer 组件
  【依赖关系】     Nuxt public lifecycle · vue-router · injected head
  【边界与注意】   对齐 Next.js 的页面名播报：document.title → h1 文本 → pathname。
                   首次加载不播报；导航开始时读取离开页的名字，当前导航的 head/page 提交后名字改变才播报。
                   不缓存挂载时的标题，避免页面标题异步更新导致下一次导航误播。

                   实时区域须位于 shadow root：Radix/Reka 使用的 aria-hidden 会保留
                   普通 DOM 中所有 aria-live 节点及其祖先链。把实时区域放在宿主或普通
                   子节点中会让整个 #__nuxt 祖先链避开模态隐藏；shadow 边界使宿主可随
                   页面正常隐藏，非模态页面的 open shadow root 仍可被辅助技术读取。
                   SSR 只渲染空宿主；客户端挂载后创建实时区域，与 Next 的客户端注入一致。
*/
import { onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";

/** 与 Next 播报器内层元素相同的视觉隐藏样式。 */
const HIDDEN_STYLE =
  "position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0,0,0,0);overflow:hidden;white-space:nowrap;overflow-wrap:normal";

const host = ref<HTMLElement | null>(null);
let liveRegion: HTMLParagraphElement | null = null;
const route = useRoute();
const router = useRouter();
const nuxt = useNuxtApp();
const head = injectHead();
type Navigation = { to: { readonly fullPath: string }; leaving: string };
let leaving: string | null = null;
const pending = shallowRef<Navigation | null>(null);
const headCommitted = ref(0);
let headPending = false;
const dispose: (() => void)[] = [];

function announceCommittedPage() {
  const navigation = pending.value;
  // Nuxt's useRoute remains on the displayed page while an incoming page is
  // suspended. Neither a retired head nor an old guard can own this navigation.
  if (
    !navigation ||
    router.currentRoute.value !== navigation.to ||
    route.fullPath !== navigation.to.fullPath
  )
    return;
  pending.value = null; // Same-name commits also consume this navigation exactly once.
  const arriving = currentPageName();
  if (arriving && arriving !== navigation.leaving && liveRegion) {
    liveRegion.textContent = arriving;
  }
}

function retireFailedDeparture(from: Navigation["to"]) {
  // beforeRouteLeave and duplicate navigation can fail before Nuxt emits start.
  // A late failure from another source route must not retire the new page.
  if (pending.value?.to === from && router.currentRoute.value === from) {
    pending.value = null;
  }
}

function currentPageName(): string {
  if (typeof document === "undefined") return "";
  const title = document.title.trim();
  if (title) return title;
  const heading = document.querySelector("h1")?.textContent?.trim();
  if (heading) return heading;
  return globalThis.location?.pathname ?? "";
}

onMounted(() => {
  const element = host.value;
  if (!element || liveRegion) return;
  const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
  liveRegion = document.createElement("p");
  liveRegion.setAttribute("role", "alert");
  liveRegion.setAttribute("aria-live", "assertive");
  liveRegion.setAttribute("style", HIDDEN_STYLE);
  root.append(liveRegion);
  // The mounted client head installs hooks; the injected type also covers SSR.
  dispose.push(
    nuxt.hook("page:loading:start", () => {
      // Nuxt emits this before its async middleware. A mounted beforeEach is
      // too late: that middleware may abort, throw or wait before reaching it.
      pending.value = null;
      leaving = currentPageName();
    }),
    router.afterEach((to, from, failure) => {
      if (failure) {
        retireFailedDeparture(from);
        return;
      }
      if (leaving === null || router.currentRoute.value !== to) return;
      if (
        nuxt.$routeAnnouncements.consume(to, from, router.options.history.state)
      ) {
        // An accepted run only gives this same page its persisted URL. Keep
        // its existing live-region text; the real head remains free to update.
        pending.value = null;
        leaving = null;
        return;
      }
      pending.value = { to, leaving };
      leaving = null;
    }),
    router.onError((_error, _to, from) => retireFailedDeparture(from)),
    head.hooks!.hook("entries:updated", () => {
      headPending = true;
    }),
    head.hooks!.hook("dom:rendered", () => {
      headPending = false;
      headCommitted.value++;
    }),
    // Both head completion and route publication converge after Vue's DOM
    // patch, so h1 fallback cannot read a leaving-page node. Nuxt's useHead
    // registers dirty work in pre watchers; its deferred DOM renderer keeps
    // headPending true until the actual title commit. A reused page with no
    // head change is handled by the displayed route's post-render update.
    // page:loading:end cannot establish ownership: Nuxt emits it on failure too.
    watch(
      [
        pending,
        () => router.currentRoute.value,
        () => route.fullPath,
        headCommitted,
      ],
      () => {
        if (!headPending) announceCommittedPage();
      },
      { flush: "post" },
    ),
  );
});

onScopeDispose(() => {
  leaving = null;
  pending.value = null;
  for (const stop of dispose) stop();
  liveRegion = null;
});
</script>

<template>
  <div id="__route-announcer__" ref="host" />
</template>
