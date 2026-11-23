import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rs,
  test,
} from "@rstest/core";
import { cleanup, render, screen } from "@testing-library/react";
import type { FocusEventHandler } from "react";
import ts from "typescript";

// Mount the actual chat-page focus callback without importing unrelated stream
// and panel owners. Full compiled page geometry is covered by Playwright.
const source = readFileSync(
  resolve(process.cwd(), "src/components/workspace/chats/chat-page.tsx"),
  "utf8",
);
const ast = ts.createSourceFile(
  "chat-page.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let callback: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (
    ts.isJsxAttribute(node) &&
    node.name.getText(ast) === "onFocusCapture" &&
    node.initializer &&
    ts.isJsxExpression(node.initializer)
  ) {
    callback = node.initializer.expression;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
expect(callback).toBeDefined();
const javascript = ts.transpileModule(
  `const owner = ${callback!.getText(ast)};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const focusOwner = new Script(
  `(() => { ${javascript}; return owner; })()`,
).runInThisContext() as FocusEventHandler<HTMLElement>;
let frames: FrameRequestCallback[];
const flushFrames = () => frames.splice(0).forEach((callback) => callback(0));

beforeEach(() => {
  frames = [];
  rs.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
});
afterEach(() => {
  cleanup();
  rs.unstubAllGlobals();
});
function mountHost() {
  const host = render(
    <main onFocusCapture={focusOwner}>
      <button>A</button>
      <button>B</button>
    </main>,
  );
  return {
    ...host,
    a: screen.getByRole("button", { name: "A" }),
    b: screen.getByRole("button", { name: "B" }),
  };
}

describe("ChatPage delayed focus reveal owner", () => {
  test("retires A before its animation frame when actual focus moves to B", () => {
    const { a, b } = mountHost();
    const revealA = rs.fn();
    const revealB = rs.fn();
    a.scrollIntoView = revealA;
    b.scrollIntoView = revealB;
    a.focus();
    b.focus();
    expect(document.activeElement).toBe(b);
    expect(frames).toHaveLength(2);
    flushFrames();
    expect(revealA).not.toHaveBeenCalled();
    expect(revealB).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
    });
  });

  test("keeps the currently focused target's native reveal", () => {
    const { a } = mountHost();
    const reveal = rs.fn();
    a.scrollIntoView = reveal;
    a.focus();
    flushFrames();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
    });
  });

  test("centers current focus only when the responsive outer native pan is active", () => {
    const { a, container } = mountHost();
    (container.firstElementChild as HTMLElement).style.overflowY = "auto";
    const reveal = rs.fn();
    a.scrollIntoView = reveal;
    a.focus();
    flushFrames();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({
      block: "center",
    });
  });

  test("does not reveal after focus leaves the host or the host unmounts", () => {
    const { a, unmount } = mountHost();
    const reveal = rs.fn();
    a.scrollIntoView = reveal;
    a.focus();
    a.blur();
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
    a.focus();
    unmount();
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
  });

  test("uses the target's document when the global document differs", () => {
    const { a } = mountHost();
    const reveal = rs.fn();
    a.scrollIntoView = reveal;
    a.focus();
    rs.stubGlobal("document", document.implementation.createHTMLDocument());
    flushFrames();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
    });
  });
});
