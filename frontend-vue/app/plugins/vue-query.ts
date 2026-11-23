/*
 * Install the one workspace QueryClient. Match the React provider's transport-only
 * retry policy and TanStack stale-on-focus default. Domain-specific exceptions
 * (session, models, history, thread lists and usage) live with their query owners.
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
      },
    },
  });

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });
});
