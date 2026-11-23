import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  attachProjectDocument,
  deleteProjectDocument,
  getProjectsConfig,
  listProjectDocuments,
  listProjectThreadFiles,
  projectKeys,
  promoteThreadFile,
  uploadProjectDocument,
  type PromoteThreadFileInput,
} from "@/core/projects";
import { TRASH_QUERY_KEY } from "@/core/trash";
import { useScopedGatewayRequests } from "@/composables/useScopedGatewayRequests";

type ProjectId = MaybeRefOrGetter<string>;
type Options = { enabled?: MaybeRefOrGetter<boolean> };
export const PROJECT_DOCUMENTS_PAGE_SIZE = 100;

export function useProjectsConfig(options: Options = {}) {
  return useQuery({
    queryKey: [...projectKeys.root(), "config"],
    queryFn: ({ signal }) => getProjectsConfig({ signal }),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: computed(() => toValue(options.enabled) ?? true),
  });
}

export function useInfiniteProjectDocuments(
  projectId: ProjectId,
  options: Options = {},
) {
  return useInfiniteQuery({
    queryKey: computed(() => [
      ...projectKeys.root(),
      "documents",
      toValue(projectId),
    ]),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listProjectDocuments(
        toValue(projectId),
        { limit: PROJECT_DOCUMENTS_PAGE_SIZE, offset: pageParam },
        { signal },
      ),
    getNextPageParam: (page) =>
      page.offset + page.documents.length < page.total
        ? page.offset + page.documents.length
        : undefined,
    enabled: computed(
      () => Boolean(toValue(projectId)) && (toValue(options.enabled) ?? true),
    ),
  });
}

export function useInfiniteProjectThreadFiles(
  projectId: ProjectId,
  params: { thread_limit?: number; file_limit?: number } = {},
  options: Options = {},
) {
  return useInfiniteQuery({
    queryKey: computed(() => [
      ...projectKeys.root(),
      "thread-files",
      toValue(projectId),
      params,
    ]),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listProjectThreadFiles(
        toValue(projectId),
        { ...params, offset: pageParam },
        { signal },
      ),
    getNextPageParam: (page) => page.next_offset ?? undefined,
    enabled: computed(
      () => Boolean(toValue(projectId)) && (toValue(options.enabled) ?? true),
    ),
  });
}

export function useProjectDocumentMutations(projectId: ProjectId) {
  const client = useQueryClient();
  const requests = useScopedGatewayRequests();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: projectKeys.root() });
  };
  function mutation<TInput, TResult>(
    request: (
      project: string,
      input: TInput,
      options: { signal: AbortSignal },
    ) => Promise<TResult>,
    settled = invalidate,
  ) {
    const owner = requests.mutation({
      mutationFn: (
        { project, input }: { project: string; input: TInput },
        signal,
      ) => request(project, input, { signal }),
      onSettled: settled,
    });
    const capture = (input: TInput) => ({ project: toValue(projectId), input });
    return {
      ...owner,
      variables: computed(() => owner.variables.value?.input),
      mutate: (input: TInput) => owner.mutate(capture(input)),
      mutateAsync: (input: TInput) => owner.mutateAsync(capture(input)),
    };
  }
  const upload = mutation(uploadProjectDocument);
  const promote = mutation<
    PromoteThreadFileInput,
    Awaited<ReturnType<typeof promoteThreadFile>>
  >(promoteThreadFile);
  const remove = mutation(deleteProjectDocument, () => {
    invalidate();
    void client.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
  });
  const attach = mutation(
    (
      project,
      {
        documentId,
        threadId,
      }: {
        documentId: string;
        threadId: string;
      },
      options: { signal: AbortSignal },
    ) => attachProjectDocument(project, documentId, threadId, options),
    () => {
      invalidate();
      void client.invalidateQueries({ queryKey: ["threads"] });
    },
  );
  return { upload, promote, remove, attach };
}
