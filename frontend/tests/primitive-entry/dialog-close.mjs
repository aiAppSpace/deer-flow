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
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { createElement: h, useState, act } = React;
const entry = require.resolve("@radix-ui/react-dialog");
const D =
  format === "cjs"
    ? require(entry)
    : await import(
        pathToFileURL(entry.replace(/index\.js$/, "index.mjs")).href
      );
console.log(
  JSON.stringify({
    format,
    entry: format === "cjs" ? entry : entry.replace(/index\.js$/, "index.mjs"),
  }),
);
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let close;
function Fixture() {
  const [outer, setOuter] = useState(false);
  const [child, setChild] = useState(false);
  close = () => setOuter(false);
  return h(
    D.Root,
    { open: outer, onOpenChange: setOuter },
    h(D.Trigger, { id: "opener" }, "Open"),
    h(
      D.Portal,
      null,
      h(
        D.Content,
        null,
        h(D.Title, null, "Parent"),
        h(D.Description, null, "Parent description"),
        h(
          "button",
          { id: "child-opener", onClick: () => setChild(true) },
          "Open child",
        ),
        h(
          D.Root,
          { open: child },
          h(
            D.Portal,
            null,
            h(
              D.Content,
              null,
              h(D.Title, null, "Child"),
              h(D.Description, null, "Child description"),
              h("button", { id: "child" }, "Inside"),
            ),
          ),
        ),
      ),
    ),
  );
}
await act(async () => root.render(h(Fixture)));
const opener = document.getElementById("opener");
await act(async () => {
  opener.focus();
  opener.click();
});
const childOpener = document.getElementById("child-opener");
await act(async () => {
  childOpener.focus();
  childOpener.click();
});
assert.equal(
  document.querySelectorAll('[role="dialog"]').length,
  2,
  "actual entry mounted/opened nested scopes",
);
await act(async () => {
  document.getElementById("child").focus();
  close();
});
await act(delay);
assert.equal(
  document.querySelectorAll('[role="dialog"]').length,
  0,
  "both scopes physically removed",
);
assert.equal(
  document.activeElement?.id,
  opener.id,
  "surviving explicit outer trigger restored",
);
await act(async () => root.unmount());
await act(delay);
host.remove();
await window.happyDOM.abort();
console.log(`PASS ${format} nested mounted/open/close/focus`);
