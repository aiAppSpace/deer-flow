import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Exercise the installed package in an ordinary Node process. Unhandled
// rejections remain fatal; no test-runner error filter or package stub is used.
function checkInstalledDom(contract: string) {
  const result = spawnSync(
    process.execPath,
    [
      "--unhandled-rejections=strict",
      "--input-type=module",
      "-e",
      String.raw`
import assert from "node:assert/strict";
import { setImmediate as nextJob } from "node:timers/promises";
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost/" });
try {
  ${contract}
  await nextJob();
  console.log(JSON.stringify({ passed: true }));
} finally {
  await window.happyDOM.close();
}
`,
    ],
    { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 },
  );
  const diagnostic = [result.error?.stack, result.stdout, result.stderr].join(
    "\n",
  );
  expect(result.error, diagnostic).toBeUndefined();
  expect(result.signal, diagnostic).toBeNull();
  expect(result.status, diagnostic).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ passed: true });
}

describe("installed Happy DOM public contracts", () => {
  it("cancels animations without unhandled errors while preserving finished promise observers", () => {
    checkInstalledDom(String.raw`
const element = window.document.createElement("div");
window.document.body.append(element);
const animate = () => element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 60_000 });
animate().cancel();
await nextJob();

const animation = animate();
const original = animation.finished;
const rejected = original.then(() => "resolved", (error) => error.name);
animation.cancel();
assert.equal(animation.playState, "idle");
assert.equal(animation.currentTime, null);
assert.equal(await rejected, "AbortError");
const pending = animation.finished;
assert.notEqual(pending, original);
let completed = false;
pending.then(() => { completed = true; });
await nextJob();
assert.equal(completed, false);
animation.cancel();
assert.equal(animation.finished, pending);
animation.play();
assert.equal(animation.finished, pending);
animation.finish();
await nextJob();
assert.equal(completed, true);
animation.cancel();
assert.notEqual(animation.finished, pending);

const initial = new window.Animation(new window.KeyframeEffect(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 60_000 }));
const initialPromise = initial.finished;
initial.play();
assert.equal(initial.finished, initialPromise);
const initialRejected = initialPromise.then(() => "resolved", (error) => error.name);
initial.cancel();
assert.equal(await initialRejected, "AbortError");
element.remove();
`);
  });

  it("brands inline and computed CSS styles with the native interface descriptor", () => {
    checkInstalledDom(String.raw`
const element = window.document.createElement("div");
window.document.body.append(element);
const inline = element.style;
inline.setProperty("opacity", "0.5");
const computed = window.getComputedStyle(element);
assert.equal(Object.prototype.toString.call(inline), "[object CSSStyleDeclaration]");
assert.equal(Object.prototype.toString.call(computed), "[object CSSStyleDeclaration]");
assert.equal(computed.opacity, "0.5");
assert.deepEqual(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inline), Symbol.toStringTag), {
  value: "CSSStyleDeclaration", writable: false, enumerable: false, configurable: true,
});
element.remove();
`);
  });
});
