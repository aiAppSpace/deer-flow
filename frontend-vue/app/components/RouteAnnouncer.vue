<script setup lang="ts">
/*
  【文件职责】     路由切换时向辅助技术播报新页面名。
  【架构位置】     L3 application shell
  【主要导出】     默认 RouteAnnouncer 组件
  【依赖关系】     vue-router
  【边界与注意】   对齐 Next.js 注入的 `<next-route-announcer>`：React 每条路由上
                   都有它，Vue 一条都没有，于是读屏用户在 React 上换页会听到页面名、
                   在 Vue 上什么都听不到。这是 make dom-parity 报出的 `- alert`。

                   **实时区域必须挂在 shadow root 里面，不能挂在宿主上。**
                   这不是抄 Next 的实现细节，这是唯一能让「模态打开时播报器随其余页面
                   一起退出可访问性树」成立的做法，而那是可观察行为：
                   Radix 与 Reka 共用 `aria-hidden` 这个库，它在标记之前先做一次
                   `parentNode.querySelectorAll('[aria-live], script')`，把命中的节点
                   **连同它们的整条祖先链**都保下来（库里的注释写着「不该藏实时区域」）。
                   `querySelectorAll` 不穿透 shadow 边界：Next 的宿主 `<next-route-announcer>`
                   自己没有 aria-live，于是照常被标 aria-hidden；而把 aria-live 写在
                   宿主上，就会把 `#__nuxt` 整条链保下来，模态打开时本仓的播报器仍然在树里。
                   **把 aria-live 换到内层元素也没用**——那仍然是一次普通的后代查询，
                   照样命中，照样把祖先链保下来。只有 shadow root 躲得开。
                   （工作区的 toaster 也带 aria-live，两个应用的 toaster 因此都保持可见，
                   这一条本来就是一致的。）

                   Playwright 的可访问性快照会穿透 open shadow root，所以非模态页面上
                   两边照样各有一个 `- alert`，与此前一致。

                   播报名的取法与 Next 一致：`document.title` → `h1` 文本 → pathname，
                   且**只有名字变了才播报**。少了这个判断，同名页面之间跳转会让读屏
                   重复念同一句话。首次加载不播报：页面本来就会被读一遍。

                   **「变没变」比的是「进入这次导航时的名字」与「这一帧渲染完之后的
                   名字」，不是一份在挂载时抓下来的快照**（wave 215 改）。原来那份快照
                   抓在 `onMounted` 里，而页面标题是页面组件自己在挂载后写的——
                   于是快照抓到的是根标题 "DeerFlow"，第一次路由切换就会把一个
                   **根本没变过**的标题播一遍。对照台账 `chat-thread-init-ordering` 上
                   `ariaOnlyVue: - alert: New chat - DeerFlow` 对着上游的空 `- alert`
                   就是它：那一跳（`/chats/new` → `/chats/{id}`）两边标题都没变，
                   上游没播，本仓播了。

                   导航开始那一刻 DOM 还是旧页面的，所以那时读到的就是「离开页的名字」
                   ——比快照稳，也不需要再维护一份状态。与上游的差别只在一处且本仓更稳：
                   上游存的是上一次导航**结束时**的标题，标题若在那之后才异步变成新值，
                   上游会在**下一次**导航时把它当成变化播出来。

                   SSR 只渲染空宿主，shadow root 在 onMounted 挂上——Next 的播报器同样
                   是客户端注入的，服务端两边都没有这个节点。
*/
import { nextTick, onMounted, ref, watch } from "vue";

/** 与 Next 播报器内层元素相同的视觉隐藏样式。 */
const HIDDEN_STYLE =
  "position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0,0,0,0);overflow:hidden;white-space:nowrap;overflow-wrap:normal";

const host = ref<HTMLElement | null>(null);
let liveRegion: HTMLParagraphElement | null = null;
const route = useRoute();

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
});

watch(
  () => route.fullPath,
  async () => {
    // 这一刻 DOM 还是上一页的，读到的就是「离开页的名字」。
    const leaving = currentPageName();
    // 等这一帧渲染完，标题与 h1 才是新页面的。
    await nextTick();
    const arriving = currentPageName();
    if (!arriving || arriving === leaving) return;
    if (liveRegion) liveRegion.textContent = arriving;
  },
);
</script>

<template>
  <div id="__route-announcer__" ref="host" />
</template>
