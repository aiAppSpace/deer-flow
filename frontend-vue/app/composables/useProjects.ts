/*
  【文件职责】     用 Vue Query 暴露项目列表/详情/项目内会话，以及全部项目 mutation。
  【架构位置】     L3 composable
  【主要导出】     useProjects · useProject · useProjectThreads · useProjectMutations ·
                   useMoveThreadToProject · PROJECT_THREADS_PAGE_SIZE
  【依赖关系】     @tanstack/vue-query · core/projects · core/threads/infinite
  【边界与注意】   **归档/恢复/删除还要失效无限会话列表**：项目成员关系变了，侧栏里
                   会话的分组就变，只失效 projects 子树的话侧栏会停在旧分组上。
                   创建与改名不影响成员关系，所以不连带失效——这条差别是有意的，
                   `useProjectMutations` 的 `invalidate({ includeThreads })` 就是它的落点。

                   **没有 React 那个 `isStaticWebsiteOnly` 开关。** 上游用它在静态演示站
                   里屏蔽所有 Gateway 请求；本仓在 `useThreadStream.ts` 那一轮已经明确
                   不引入 `isMock` 这条贯穿式分支（上游 23 处，这里 0 处），改由调用方
                   用 `enabled` 决定要不要发请求。要屏蔽就在调用点关掉，不要在这里
                   重新长出一个全局模式判定。
*/

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  archiveProject,
  createProject,
  deleteProject,
  getProject,
  listProjectThreads,
  listProjects,
  patchProject,
  projectKeys,
  restoreProject,
  type Project,
  type ProjectCreateInput,
  type ProjectPatchInput,
  type ProjectStatus,
  type ProjectThread,
} from "@/core/projects";
import { moveThreadToProject } from "@/core/threads/api";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";
import { threadMetadataQueryKey } from "@/core/threads/metadata";
import { THREAD_PROJECT_METADATA_KEY } from "@/core/threads/utils";

/** 与上游 `PROJECT_THREADS_PAGE_SIZE` 同值：两边翻页边界一致才好对照。 */
export const PROJECT_THREADS_PAGE_SIZE = 100;

export function useProjects(
  status?: MaybeRefOrGetter<ProjectStatus | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useQuery<Project[]>({
    queryKey: computed(() => projectKeys.list(toValue(status))),
    queryFn: ({ signal }) => listProjects(toValue(status), { signal }),
    enabled: computed(() => toValue(options.enabled) ?? true),
  });
}

export function useProject(
  projectId: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useQuery<Project>({
    queryKey: computed(() => projectKeys.detail(toValue(projectId) ?? "")),
    queryFn: ({ signal }) => getProject(toValue(projectId)!, { signal }),
    enabled: computed(
      () => Boolean(toValue(projectId)) && (toValue(options.enabled) ?? true),
    ),
  });
}

/**
 * 项目内会话的分页列表。
 *
 * `getNextPageParam` 用**已取回的总条数**当下一页 offset。
 *
 * **注意这里和「页码 × 页大小」目前是等价的**：短页会让 `getNextPageParam` 返回
 * `undefined` 直接终止翻页，所以「短页之后还要继续翻」这种情形不会出现——
 * 我一度在这里写「用乘法会在短页之后跳条」当理由，那是错的，
 * 而当时那条声称守着它的断言也因此是空的（2026-09-10 变异验证抓到）。
 *
 * 仍然用累计条数，是因为它**不依赖**「遇到短页就停」这条规则：哪天 Gateway 改成
 * 按可见性过滤后仍可继续翻页，这里不用跟着改。乘法则会在那天开始跳条。
 */
export function useProjectThreads(
  projectId: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useInfiniteQuery({
    queryKey: computed(() => projectKeys.threads(toValue(projectId) ?? "")),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listProjectThreads(
        toValue(projectId)!,
        { limit: PROJECT_THREADS_PAGE_SIZE, offset: pageParam as number },
        { signal },
      ),
    getNextPageParam: (
      lastPage: ProjectThread[],
      allPages: ProjectThread[][],
    ) =>
      lastPage.length === PROJECT_THREADS_PAGE_SIZE
        ? allPages.reduce((total, page) => total + page.length, 0)
        : undefined,
    enabled: computed(
      () => Boolean(toValue(projectId)) && (toValue(options.enabled) ?? true),
    ),
  });
}

function invalidateProjectCaches(
  queryClient: QueryClient,
  { includeThreads = false }: { includeThreads?: boolean } = {},
) {
  void queryClient.invalidateQueries({ queryKey: projectKeys.root() });
  if (includeThreads) {
    void queryClient.invalidateQueries({
      queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
    });
  }
}

/**
 * 把会话移进/移出项目。
 *
 * 三步顺序是有讲究的：
 * 1. **先取消在途的元数据查询**——一个更早发出的 GET 回来会把刚确认的归属覆盖掉，
 *    而那次覆盖没有任何征兆（UI 上就是「移动了一下又弹回去」）。
 * 2. 再把确认后的 project id 写进缓存，让侧栏立刻归位。
 * 3. 最后失效三处：会话搜索、无限会话列表、**项目会话列表**——
 *    移动改变的是成员关系，这三处各自缓存着一份成员快照。
 *
 * `onError` 挂在 mutation 上而不是每次 `mutate` 时传：调用它的下拉菜单会在
 * 点击后立刻卸载，传进去的回调会跟着没掉，错误就静默了。
 */
export function useMoveThreadToProject(options?: {
  onError?: (
    error: Error,
    variables: { threadId: string; projectId: string | null },
  ) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      projectId,
    }: {
      threadId: string;
      projectId: string | null;
    }) => moveThreadToProject(threadId, projectId),
    onError: options?.onError,
    async onSuccess(_response, { threadId, projectId }) {
      const metadataKey = threadMetadataQueryKey(threadId);
      await queryClient.cancelQueries({ queryKey: metadataKey });
      queryClient.setQueriesData<Record<string, unknown> | undefined>(
        { queryKey: metadataKey },
        (previous) =>
          previous
            ? { ...previous, [THREAD_PROJECT_METADATA_KEY]: projectId }
            : previous,
      );
      await queryClient.invalidateQueries({ queryKey: metadataKey });
    },
    onSettled() {
      void queryClient.invalidateQueries({
        queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
      });
      // 移动改变了项目会话列表的成员关系。
      void queryClient.invalidateQueries({
        queryKey: [...projectKeys.root(), "threads"],
      });
    },
  });
}

export function useProjectMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (input: ProjectCreateInput) => createProject(input),
    onSuccess: () => invalidateProjectCaches(queryClient),
  });

  const patch = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProjectPatchInput }) =>
      patchProject(id, input),
    onSuccess: () => invalidateProjectCaches(queryClient),
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveProject(id),
    onSuccess: () =>
      invalidateProjectCaches(queryClient, { includeThreads: true }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreProject(id),
    onSuccess: () =>
      invalidateProjectCaches(queryClient, { includeThreads: true }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () =>
      invalidateProjectCaches(queryClient, { includeThreads: true }),
  });

  return { create, patch, archive, restore, remove };
}
