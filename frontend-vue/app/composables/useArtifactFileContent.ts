import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  computed,
  ref,
  toRaw,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import {
  loadArtifactContent,
  loadArtifactContentFromToolCall,
} from "@/core/artifacts/loader";
import {
  canLoadArtifactText,
  type ArtifactPolicy,
} from "@/core/artifacts/policy";
import { artifactKeys } from "@/core/artifacts/query-keys";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import type { Message } from "@/core/types/message";

type LoadedArtifact = Awaited<ReturnType<typeof loadArtifactContent>>;
type Selection = { selected: string; threadId: string; isMock: boolean };

/** The canonical artifact Query owns reads; the draft owner separately owns edits. */
export function useArtifactFileContent(options: {
  selection: MaybeRefOrGetter<Selection>;
  policy: MaybeRefOrGetter<ArtifactPolicy>;
  messages: MaybeRefOrGetter<Message[]>;
  streaming: MaybeRefOrGetter<boolean>;
  writeComplete: MaybeRefOrGetter<boolean>;
  onLoaded: (selection: Selection, result: LoadedArtifact) => void;
}) {
  const client = useQueryClient();
  const selection = computed(() => toValue(options.selection));
  // Match React and the standalone viewer: remember the last explicit full
  // selection so A -> B -> A restores A, without granting a full read to B.
  const fullContentSelection = ref<{
    filepath: string;
    threadId: string;
  } | null>(null);
  const fullContentRequested = computed(
    () =>
      fullContentSelection.value?.filepath === selection.value.selected &&
      fullContentSelection.value.threadId === selection.value.threadId,
  );
  const isWriteDraft = computed(
    () => toValue(options.policy).source === "write-file-draft",
  );
  const enabled = computed(
    () => !isWriteDraft.value && canLoadArtifactText(toValue(options.policy)),
  );
  const key = computed(() =>
    artifactKeys.content({
      filepath: selection.value.selected,
      threadId: selection.value.threadId,
      isMock: selection.value.isMock,
      full: fullContentRequested.value,
    }),
  );
  const query = useQuery({
    queryKey: key,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ queryKey, signal }) => {
      const owns = captureWorkspaceQueryOwner(client);
      const loaded = await loadArtifactContent({
        filepath: queryKey[1],
        threadId: queryKey[2],
        isMock: queryKey[3],
        full: queryKey[4],
        signal,
      });
      // A transport that ignores abort must not publish a previous account's read.
      if (signal.aborted || !owns())
        throw new DOMException("The operation was aborted.", "AbortError");
      return loaded;
    },
  });
  watch(
    [query.data, query.dataUpdatedAt],
    ([loaded]) => {
      if (
        enabled.value &&
        loaded &&
        client.getQueryData(key.value) === toRaw(loaded)
      )
        options.onLoaded({ ...selection.value }, loaded);
    },
    { immediate: true },
  );
  const draftContent = computed(() => {
    if (!isWriteDraft.value) return undefined;
    const content = loadArtifactContentFromToolCall({
      url: selection.value.selected,
      thread: { messages: toValue(options.messages) } as never,
    });
    return typeof content === "string" ? content : "";
  });
  const data = computed(() => (enabled.value ? query.data.value : undefined));
  function reload() {
    return enabled.value ? query.refetch() : Promise.resolve();
  }
  watch(
    () => toValue(options.streaming),
    (streaming, previous) => {
      if (previous && !streaming && enabled.value) void reload();
    },
  );

  return {
    content: computed(() => draftContent.value ?? data.value?.content ?? ""),
    contentUrl: computed(() => data.value?.url),
    sha256: computed(() => data.value?.sha256),
    truncated: computed(() => data.value?.truncated ?? false),
    previewBytes: computed(() => data.value?.previewBytes),
    totalBytes: computed(() => data.value?.totalBytes),
    fullContentLoaded: computed(() =>
      isWriteDraft.value
        ? toValue(options.writeComplete)
        : data.value !== undefined && !data.value.truncated,
    ),
    loading: computed(() => enabled.value && query.isLoading.value),
    loadingFull: computed(
      () => fullContentRequested.value && query.isLoading.value,
    ),
    error: computed(() =>
      enabled.value && query.error.value ? query.error.value.message : "",
    ),
    reload,
    loadFull: () => {
      fullContentSelection.value = {
        filepath: selection.value.selected,
        threadId: selection.value.threadId,
      };
      // Updating the key already starts its stale read. Reuse that request even
      // when this full-file key has cached data instead of cancelling it twice.
      return enabled.value
        ? query.refetch({ cancelRefetch: false })
        : Promise.resolve();
    },
    acknowledgeSaved: (saved: { content: string; sha256: string }) => {
      const currentKey = key.value;
      const current = client.getQueryData<LoadedArtifact>(currentKey);
      // Match React's exact current preview/full cache write. Cancel first so a
      // previously started GET cannot revert the just-confirmed saved revision.
      void client.cancelQueries({ queryKey: currentKey, exact: true });
      const bytes = new TextEncoder().encode(saved.content).byteLength;
      client.setQueryData<LoadedArtifact>(currentKey, {
        ...saved,
        url: current?.url ?? "",
        truncated: false,
        previewBytes: bytes,
        totalBytes: bytes,
      });
    },
  };
}
