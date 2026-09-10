/*
  【文件职责】     独立产物视窗的内容加载：预览窗口、按需取全文、失败与加载态。
  【架构位置】     L3 composable
  【主要导出】     useStandaloneArtifactContent
  【依赖关系】     @tanstack/vue-query · core/artifacts/loader · core/artifacts/query-keys
  【边界与注意】   - `staleTime: 0` + 回到窗口就重取：这是一个**独立窗口**，用户多半是
                     把它晾在一边、改完文件再切回来看。缓存住旧内容等于骗人。
                   - 「加载完整文件」是**换一个 query key**，不是改同一份数据：
                     预览那份留在缓存里，来回切不用重新下载。
                   - 请求哪一份由 filepath+threadId 决定，所以换了目标之后
                     `fullContentRequested` 要跟着回到 false——否则新文件会
                     直接按全文拉，而那可能是几十兆。
*/

import { useQuery } from "@tanstack/vue-query";
import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";

import { loadArtifactContent } from "@/core/artifacts/loader";
import { artifactKeys } from "@/core/artifacts/query-keys";

export function useStandaloneArtifactContent(
  target: MaybeRefOrGetter<{
    filepath: string;
    threadId: string;
    isMock: boolean;
  }>,
) {
  const selection = ref<{ filepath: string; threadId: string } | null>(null);
  const fullContentRequested = computed(() => {
    const { filepath, threadId } = toValue(target);
    return (
      selection.value?.filepath === filepath &&
      selection.value.threadId === threadId
    );
  });

  const query = useQuery({
    queryKey: computed(() =>
      artifactKeys.content({
        ...toValue(target),
        full: fullContentRequested.value,
      }),
    ),
    queryFn: ({ signal }) =>
      loadArtifactContent({
        ...toValue(target),
        full: fullContentRequested.value,
        signal,
      }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  return {
    content: computed(() => query.data.value?.content),
    url: computed(() => query.data.value?.url),
    truncated: computed(() => query.data.value?.truncated ?? false),
    previewBytes: computed(() => query.data.value?.previewBytes),
    totalBytes: computed(() => query.data.value?.totalBytes),
    fullContentRequested,
    isLoading: query.isLoading,
    error: query.error,
    loadFullContent: () => {
      const { filepath, threadId } = toValue(target);
      selection.value = { filepath, threadId };
    },
  };
}
