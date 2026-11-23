import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Window } from "happy-dom";
const require = createRequire(import.meta.url);
const window = new Window({ url: "http://localhost/" });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "DocumentFragment",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "SVGElement",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "NodeFilter",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value:
      key === "window"
        ? window
        : typeof window[key] === "function" && /^[a-z]/.test(key)
          ? window[key].bind(window)
          : window[key],
  });
}
const format = process.argv[2];
const delay = () => new Promise((resolve) => setTimeout(resolve, 10));
// Await observable lifecycle completion, rather than assuming a loaded process
// has flushed all nested Vue ticks and the scope's existing close timer in 10ms.
async function until(predicate, label) {
  const deadline = Date.now() + 1000;
  while (!predicate() && Date.now() < deadline) await delay();
  assert.ok(
    predicate(),
    `${label}; active=${document.activeElement?.id || document.activeElement?.tagName}`,
  );
}

const { createApp, h, ref, nextTick } = await import("vue");
const entry = require.resolve("reka-ui");
const D =
  format === "cjs"
    ? require(entry)
    : await import(
        pathToFileURL(entry.replace(/index\.cjs$/, "index.js")).href
      );
console.log(
  JSON.stringify({
    format,
    entry: format === "cjs" ? entry : entry.replace(/index\.cjs$/, "index.js"),
  }),
);
for (const modal of [true, false])
  for (const mode of ["programmatic", "explicit", "retained-cancel"]) {
    const explicit = mode !== "programmatic";
    const retained = mode === "retained-cancel";
    let closeEvents = 0;
    const open = ref(false);
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      setup: () => () =>
        h("div", [
          h(
            "button",
            { id: "opener", onClick: () => (open.value = true) },
            "Open",
          ),
          h(
            D.DialogRoot,
            {
              open: open.value,
              modal,
              unmountOnHide: !retained,
              "onUpdate:open": (v) => (open.value = v),
            },
            () => [
              explicit
                ? h(D.DialogTrigger, { id: "declared" }, () => "Declared")
                : null,
              h(D.DialogPortal, null, () =>
                h(
                  D.DialogContent,
                  {
                    onCloseAutoFocus: (event) => {
                      closeEvents++;
                      if (retained) event.preventDefault();
                    },
                  },
                  () => [
                    h(D.DialogTitle, null, () => "Title"),
                    h(D.DialogDescription, null, () => "Description"),
                    h(
                      "button",
                      { id: "close", onClick: () => (open.value = false) },
                      "Close",
                    ),
                  ],
                ),
              ),
            ],
          ),
        ]),
    });
    app.mount(host);
    await nextTick();
    const opener = document.getElementById("opener");
    opener.focus();
    opener.click();
    await nextTick();
    await delay();
    assert.equal(
      document.querySelectorAll('[role="dialog"]').length,
      1,
      "actual entry mounted/opened",
    );
    await until(
      () => document.activeElement?.id === "close",
      "entry activation focuses its real child",
    );
    const close = document.getElementById("close");
    close.focus();
    close.click();
    await nextTick();
    await delay();
    assert.equal(
      document.querySelectorAll('[role="dialog"]').length,
      retained ? 1 : 0,
      "physical close/retained identity",
    );
    await until(() => closeEvents === 1, "one cancellable close event");
    if (!retained)
      await until(
        () =>
          document.activeElement?.id === (explicit ? "declared" : opener.id),
        "close default returns exact owner",
      );
    assert.equal(closeEvents, 1, "one cancellable close event");
    if (retained)
      assert.notEqual(
        document.activeElement?.id,
        "declared",
        "retained caller cancellation wins",
      );
    else
      assert.equal(
        document.activeElement?.id,
        explicit ? "declared" : opener.id,
        `modal=${modal} mode=${mode} return owner`,
      );
    app.unmount();
    host.remove();
    await nextTick();
    await delay();
    console.log(
      `PASS ${format} modal=${modal} mode=${mode} mounted/open/close/focus`,
    );
  }
await window.happyDOM.abort();
