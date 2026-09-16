/*
  【文件职责】     安装 @tanstack/vue-query，并把默认查询策略钉在一处。
  【架构位置】     L3
  【主要导出】     Nuxt plugin
  【依赖关系】     @tanstack/vue-query
  【边界与注意】   05 A7 / A8 的验收对象就是这个 client——在它存在之前，「失效
                   持久化历史缓存」没有作用对象，这也是 06 把 A7/A8 从 M2 顺延到
                   M4a 的全部理由。

                   ~~`retry: false` 与上游一致。~~ **⚠ 这句话是错的，wave 128 实测推翻。**
                   上游是 `new QueryClient()`——**没有 defaultOptions**，
                   吃的是 TanStack 的默认值 `retry: 3`。对照台账在
                   `integrations#load-failed` 那个终态上把它量了出来：
                   同一次 500，**上游发了 3 次 `GET /api/integrations/lark/status`，
                   本仓发 1 次**。

                   ~~**决定：保留本仓的 `retry: false`**~~ —— **2026-09-16 第三十二轮
                   按上面那条翻案判据兑现了**：换成 `isRetryableTransportError`
                   这条**两个应用逐字同一份**的判据（`core/api/errors.ts`），
                   **只重试传输层失败（`fetch` 抛的原生 `TypeError`：断网 / DNS / TLS），
                   任何 HTTP 状态码一律不重试**。

                   为什么不是把其中一边抄成另一边：抄 `3` 是照搬上游的缺陷
                   （404 也重试三次，只把错误界面推迟几秒），
                   抄 `false` 是把上游对瞬时故障的韧性一起抹掉。
                   **这条判据比两边现状都好，而且让台账在三个失败终态上收敛**
                   （33 个投影）。上游那一侧同一条改在
                   `frontend/src/components/query-client-provider.tsx`。

                   **判据放在 `core/api/retry.ts`（零依赖）而不是 `core/api/errors.ts`**：
                   这个插件**每条路由都加载**，第一版写在 `errors.ts` 里当场被
                   `tests/e2e/route-payload.spec.ts` 抓住——`/` 的首屏 brotli
                   131546 对预算 131200，**超 346 字节**，因为那条新的 import 边
                   把 `GatewayResponseError` 与整套读响应的机器拖进了首屏。

                   `refetchOnWindowFocus: false` 是全局默认，`THREAD_HISTORY_QUERY_POLICY`
                   里又写了一遍——不是冗余：那份策略是上游 `thread-history-options`
                   单测逐字段断言的对象，它必须能脱离 plugin 独立成立。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

import { isRetryableTransportError } from "@/core/api/retry";

/**
 * 传输层失败重试几次。
 *
 * 取 TanStack 自己的默认次数（3），**改的是「哪一类错误值得重试」而不是「重试几次」**
 * ——换一个新数字会让「为什么是 2 / 5」变成一句没人验得了的话。
 */
const TRANSPORT_RETRY_LIMIT = 3;

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          failureCount < TRANSPORT_RETRY_LIMIT &&
          isRetryableTransportError(error),
        refetchOnWindowFocus: false,
      },
    },
  });

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });
});
