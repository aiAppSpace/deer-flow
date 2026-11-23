import type { Query, QueryClient } from "@tanstack/vue-query";

const generations = new WeakMap<object, number>();

/** Capture synchronously, before scheduling a mutation or awaiting its transport. */
export function captureWorkspaceQueryOwner(client: object): () => boolean {
  const generation = generations.get(client) ?? 0;
  return () => (generations.get(client) ?? 0) === generation;
}

/** Invalidate before changing a cookie or clearing a query tree. */
export function invalidateWorkspaceQueryOwner(client: object) {
  generations.set(client, (generations.get(client) ?? 0) + 1);
}

/** Workspace data retires with its account; the new identity itself must survive. */
function isWorkspaceQuery(query: Query) {
  return !(query.queryKey[0] === "auth" && query.queryKey[1] === "session");
}

export async function resetWorkspaceQueries(client: QueryClient) {
  invalidateWorkspaceQueryOwner(client);
  await client.cancelQueries({ predicate: isWorkspaceQuery });
  client.removeQueries({ predicate: isWorkspaceQuery });
  client.getMutationCache().clear();
}
