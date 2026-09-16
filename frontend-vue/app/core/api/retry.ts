/*
  【文件职责】     判断一个错误值值不值得自动重试。
  【架构位置】     L1（纯函数，零依赖）
  【主要导出】     isRetryableTransportError
  【依赖关系】     无——**这条「无」是刻意的**，见下。
  【边界与注意】   **判据是「谁造成的」**：`fetch` 在连接层失败（断网 / DNS / TLS /
                   被拦截）时抛的是原生 `TypeError`，那一类是瞬时的、重试有意义；
                   而**任何 HTTP 状态码都是服务端想好了才给的答案**
                   （404 就是没有、403 就是不许、500 也已经在服务端记了一笔），
                   重试只是把同一个答案再要三遍，把错误界面推迟几秒。

                   **为什么单独成文件而不是放进 `core/api/errors.ts`**：
                   它的消费者是 `plugins/vue-query.ts`，而 Nuxt 插件**每条路由都加载**。
                   第三十二轮先把它写在 `errors.ts` 里，当场被
                   `tests/e2e/route-payload.spec.ts` 抓住——`/` 的首屏 brotli
                   **131546 对预算 131200，超 346 字节**：那条新的 import 边
                   把 `GatewayResponseError` 与整套读响应的机器一起拖进了首屏。
                   **零依赖是这个文件存在的理由，不是巧合**；往这里加 import 之前
                   先想清楚它会进每一条路由的首屏。

                   两个应用逐字同一份（上游 `frontend/src/core/api/retry.ts`）。
*/

/**
 * 这个错误值不值得自动重试。
 *
 * `GatewayResponseError`（本仓在非 2xx 上抛的）继承 `Error` 而不是 `TypeError`，
 * 所以**不需要额外挡一道**——`instanceof TypeError` 本身就把它排除了。
 */
export function isRetryableTransportError(error: unknown): boolean {
  return error instanceof TypeError;
}
