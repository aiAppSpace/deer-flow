/** Native module graphs preserve relative URLs and credentialed chunk imports. */
export function importAssetModule(
  url: string,
  signal?: AbortSignal,
): Promise<{ default: unknown }> {
  signal?.throwIfAborted();
  const absoluteURL = new URL(url, document.baseURI).href;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.crossOrigin = "use-credentials";
    script.src = absoluteURL;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      script.onload = script.onerror = null;
      script.remove();
    };
    const fail = (error: unknown) => {
      cleanup();
      reject(
        error instanceof Error
          ? error
          : new Error("Plugin module failed", { cause: error }),
      );
    };
    const cancel = () =>
      fail(new DOMException("Plugin module cancelled", "AbortError"));
    // Stop host waiting for loading/evaluation (including top-level await).
    // Removing the node cannot cancel native evaluation or its late side effects.
    const timer = setTimeout(
      () => fail(new Error("Plugin module timed out")),
      30_000,
    );
    script.onload = () => {
      // The credentialed script populated the document's module map. Reuse that
      // module instance to obtain its exports; do not fetch it as a Blob.
      void import(/* @vite-ignore */ absoluteURL).then(
        (module: { default: unknown }) => {
          cleanup();
          resolve(module);
        },
        fail,
      );
    };
    script.onerror = () => fail(new Error("Plugin module unavailable"));
    signal?.addEventListener("abort", cancel, { once: true });
    document.head.append(script);
  });
}
