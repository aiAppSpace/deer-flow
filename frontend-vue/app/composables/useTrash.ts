import { useInfiniteQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { projectKeys } from "@/core/projects";
import { useScopedGatewayRequests } from "@/composables/useScopedGatewayRequests";
import {
  emptyTrash,
  listTrashDocuments,
  purgeTrashDocument,
  restoreTrashDocument,
  TRASH_QUERY_KEY,
} from "@/core/trash";

export const TRASH_DOCUMENTS_PAGE_SIZE = 100;
export function useInfiniteTrashDocuments(
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useInfiniteQuery({
    queryKey: TRASH_QUERY_KEY,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listTrashDocuments(
        {
          limit: TRASH_DOCUMENTS_PAGE_SIZE,
          offset: pageParam,
        },
        { signal },
      ),
    getNextPageParam: (page) =>
      page.offset + page.documents.length < page.total
        ? page.offset + page.documents.length
        : undefined,
    enabled: computed(() => toValue(options.enabled) ?? true),
  });
}
export function useTrashMutations() {
  const client = useQueryClient();
  const requests = useScopedGatewayRequests();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
    void client.invalidateQueries({ queryKey: projectKeys.root() });
  };
  const restore = requests.mutation({
    mutationFn: (
      {
        documentId,
        projectId,
      }: {
        documentId: string;
        projectId?: string;
      },
      signal,
    ) => restoreTrashDocument(documentId, { projectId }, { signal }),
    onSettled: invalidate,
  });
  const purge = requests.mutation({
    mutationFn: (documentId: string, signal) =>
      purgeTrashDocument(documentId, { signal }),
    onSettled: invalidate,
  });
  const empty = requests.mutation<Awaited<ReturnType<typeof emptyTrash>>>({
    mutationFn: (_input, signal) => emptyTrash({ signal }),
    onSettled() {
      void client.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
    },
  });
  return { restore, purge, empty };
}
