/**
 * Whether an error is worth retrying automatically.
 *
 * The test is *who produced it*: `fetch` throws a native `TypeError` when the
 * connection itself fails (offline, DNS, TLS, blocked) — that class is
 * transient and worth another attempt. **Any HTTP status is an answer the
 * server chose** (404 means absent, 403 means not allowed, 500 is already
 * recorded server-side); retrying only asks for the same answer three more
 * times and delays the error UI by seconds.
 *
 * **Why its own file, with no imports:** the consumer is the QueryClient that
 * every route mounts. The Vue app measured the cost of putting this next to the
 * error machinery instead — its `/` route went 346 bytes brotli over budget
 * because the new import edge dragged the response-reading helpers into the
 * first paint. Keep this module dependency-free.
 *
 * Kept verbatim in both apps (`frontend-vue/app/core/api/retry.ts`).
 */
export function isRetryableTransportError(error: unknown): boolean {
  return error instanceof TypeError;
}
