/*
 * L3 private transport policy helper, kept dependency-free for the global query
 * plugin. Only native TypeError is retryable here; HTTP/domain errors follow
 * their query owner's explicit policy. L1 remains packages/agent-core.
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
