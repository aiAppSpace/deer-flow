/** Cancellation is an owner transition, so it has no user-facing failure toast. */
export function isRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
