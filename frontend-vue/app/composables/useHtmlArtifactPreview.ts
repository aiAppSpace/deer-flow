import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import {
  appendHtmlPreviewBaseHref,
  appendHtmlPreviewScrollRestoration,
  collectHtmlPreviewResourceUrls,
  resolveHtmlPreviewResourceReference,
  rewriteHtmlPreviewResourceUrls,
} from "@/core/artifacts/preview";

function shouldInline(resourceUrl: string) {
  try {
    const parsed = new URL(resourceUrl, globalThis.location?.href);
    return (
      parsed.origin === globalThis.location?.origin &&
      /^\/(?:mock\/)?api\/threads\/[^/]+\/artifacts\//.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function blobToDataUrl(blob: Blob, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Preview cancelled", "AbortError"));
      return;
    }
    const reader = new FileReader();
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => reader.abort();
    reader.onload = () => {
      cleanup();
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("html-preview-resource-read-failed"));
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error);
    };
    reader.onabort = () => {
      cleanup();
      reject(new DOMException("Preview cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    reader.readAsDataURL(blob);
  });
}

/** Each watcher invocation owns its cancellation and its single blob URL. */
export function useHtmlArtifactPreview(
  input: MaybeRefOrGetter<{
    content: string;
    language: string | null;
    url?: string;
    identity: string;
    enabled: boolean;
  }>,
) {
  const previewUrl = ref<string>();
  watch(
    () => {
      const { content, language, url, identity, enabled } = toValue(input);
      return [content, language, url, identity, enabled] as const;
    },
    async (
      [content, language, url, identity, enabled],
      _previous,
      onCleanup,
    ) => {
      previewUrl.value = undefined;
      if (language !== "html" || !enabled) return;
      const controller = new AbortController();
      let cancelled = false;
      const resource: { objectUrl?: string } = {};
      onCleanup(() => {
        cancelled = true;
        controller.abort();
        if (resource.objectUrl) URL.revokeObjectURL(resource.objectUrl);
      });
      const resourceUrlMap = new Map<string, string>();
      const resourceUrls = [
        ...new Set(
          collectHtmlPreviewResourceUrls(content)
            .map((resource) =>
              resolveHtmlPreviewResourceReference(resource, url),
            )
            .filter(shouldInline),
        ),
      ];
      await Promise.all(
        resourceUrls.map(async (resourceUrl) => {
          try {
            const response = await fetch(resourceUrl, {
              signal: controller.signal,
            });
            if (!response.ok || controller.signal.aborted) return;
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            const dataUrl = await blobToDataUrl(blob, controller.signal);
            if (!controller.signal.aborted)
              resourceUrlMap.set(resourceUrl, dataUrl);
          } catch (reason) {
            if (!controller.signal.aborted)
              console.warn("Failed to inline HTML preview resource", reason);
          }
        }),
      );
      if (cancelled || controller.signal.aborted) return;
      const preview = appendHtmlPreviewScrollRestoration(
        appendHtmlPreviewBaseHref(
          rewriteHtmlPreviewResourceUrls(
            content,
            url,
            undefined,
            resourceUrlMap,
          ),
          url,
        ),
        identity,
      );
      const objectUrl = URL.createObjectURL(
        new Blob([preview], { type: "text/html;charset=utf-8" }),
      );
      resource.objectUrl = objectUrl;
      previewUrl.value = objectUrl;
    },
    { immediate: true },
  );
  return previewUrl;
}
