"use client";

import {
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from "@tanstack/react-query";

import { isRetryableTransportError } from "@/core/api/retry";

/**
 * How many times a transport-level failure is retried.
 *
 * This is TanStack's own default count; what changed is **which errors are
 * worth retrying**, not how many times. Inventing a new number would turn
 * "why 2, why 5" into a claim nobody can check.
 */
const TRANSPORT_RETRY_LIMIT = 3;

/**
 * `new QueryClient()` inherited TanStack's `retry: 3` **for every error**, so a
 * 404 was fetched four times before the UI could say "not found" — the parity
 * ledger measured exactly that on three failure states (one 500 here produced
 * four requests against the Vue app's one).
 *
 * Retry the class that is actually transient instead: `fetch` throws a native
 * `TypeError` when the connection fails, and nothing else does. The predicate
 * lives in `core/api/errors.ts` and is kept verbatim in both apps.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        failureCount < TRANSPORT_RETRY_LIMIT &&
        isRetryableTransportError(error),
    },
  },
});

export function QueryClientProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
    </TanStackQueryClientProvider>
  );
}
