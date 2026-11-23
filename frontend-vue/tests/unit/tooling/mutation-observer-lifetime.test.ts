import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));

describe("installed DOM observer lifetime", () => {
  it("keeps a strongly owned observer notified after cross-job GC and iframe reinsertion", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--expose-gc",
        "--input-type=module",
        "-e",
        String.raw`
import assert from "node:assert/strict";
import { setImmediate as nextJob } from "node:timers/promises";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
const document = window.document;
const host = document.createElement("div");
const frame = document.createElement("iframe");
frame.srcdoc = "<p>Report</p>";
document.body.append(host);
const notifications = [];
const callback = (records) => {
  for (const record of records) {
    notifications.push({
      added: record.addedNodes.length,
      removed: record.removedNodes.length,
    });
  }
};
const observer = new window.MutationObserver(callback);
const owner = { window, host, frame, observer, callback };
observer.observe(host, { childList: true, subtree: true });

try {
  assert.equal(typeof globalThis.gc, "function");
  host.append(frame);
  await nextJob();
  assert.equal(host.querySelectorAll("iframe").length, 1);
  assert.deepEqual(notifications, [{ added: 1, removed: 0 }]);

  frame.remove();
  await nextJob();
  assert.equal(host.querySelectorAll("iframe").length, 0);
  assert.deepEqual(notifications, [
    { added: 1, removed: 0 },
    { added: 0, removed: 1 },
  ]);

  // Leave the mutation-delivery job before GC. The observer, callback and
  // target remain strongly owned; no observer implementation is inspected.
  await nextJob();
  globalThis.gc();
  await nextJob();
  assert.equal(owner.observer, observer);
  assert.equal(owner.callback, callback);
  assert.equal(owner.host, host);
  assert.equal(host.isConnected, true);

  host.append(frame);
  await nextJob();
  assert.equal(host.querySelectorAll("iframe").length, 1);
  assert.deepEqual(notifications, [
    { added: 1, removed: 0 },
    { added: 0, removed: 1 },
    { added: 1, removed: 0 },
  ], "A still-owned observer must report the real iframe reinsertion after GC");
  console.log(JSON.stringify({ iframeCount: 1, notifications }));
} finally {
  observer.disconnect();
  await window.happyDOM.close();
}
`,
      ],
      { cwd: workspace, encoding: "utf8" },
    );
    const diagnostic = [
      `child status=${result.status} signal=${result.signal}`,
      result.error?.stack ?? "",
      result.stdout,
      result.stderr,
    ].join("\n");
    expect(result.error, diagnostic).toBeUndefined();
    expect(result.signal, diagnostic).toBeNull();
    expect(result.status, diagnostic).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      iframeCount: 1,
      notifications: [
        { added: 1, removed: 0 },
        { added: 0, removed: 1 },
        { added: 1, removed: 0 },
      ],
    });
  });
});
