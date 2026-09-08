import { useQuery } from "@tanstack/react-query";

import { loadSuggestionsConfig } from "./api";

/*
 * `enabled` so a public showcase page can opt out. `/showcase/<id>` renders the
 * same ChatPage, and `useThreadChat` already resolves `isMock` from that route
 * prefix -- but these queries were never gated on it, so an anonymous visitor
 * to a shared read-only conversation still triggered the workspace API calls.
 * Measured by the parity harness on 2026-09-09: four requests React made on
 * that screen that the Vue app made none of.
 */
export function useSuggestionsConfig(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["suggestionsConfig"],
    queryFn: loadSuggestionsConfig,
    enabled: options?.enabled ?? true,
    staleTime: Infinity,
  });
}
