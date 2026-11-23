/*
  red/green contract for the workspace-level shell owners.
*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createWorkspaceToastStore,
  type ToastTimer,
} from "@/core/workspace-shell/toast";
import {
  commandForWorkspaceShortcut,
  isWorkspaceShortcutEditableTarget,
  OTHER_SHORTCUT_MODIFIERS,
  shortcutModifierLabels,
} from "@/core/workspace-shell/shortcuts";
import {
  buildSettingsCloseLocation,
  readSettingsSection,
} from "@/core/workspace-shell/settings-query";

describe("workspace toast owner", () => {
  it("announces success/error, dismisses explicitly, and clears timers", () => {
    const scheduled = new Map<number, () => void>();
    const cleared: number[] = [];
    let id = 0;
    const timer: ToastTimer = {
      set(callback) {
        id += 1;
        scheduled.set(id, callback);
        return id;
      },
      clear(timerId) {
        cleared.push(timerId);
        scheduled.delete(timerId);
      },
    };
    const store = createWorkspaceToastStore({ timer, durationMs: 5_000 });

    const successId = store.success("Export complete");
    const errorId = store.error("Clipboard denied");
    expect(
      store.toasts.value.map(({ kind, message }) => [kind, message]),
    ).toEqual([
      ["success", "Export complete"],
      ["error", "Clipboard denied"],
    ]);

    store.dismiss(successId);
    expect(store.toasts.value).toHaveLength(1);
    store.clear();
    expect(store.toasts.value).toEqual([]);
    expect(cleared).toEqual(expect.arrayContaining([1, 2]));
    expect(errorId).toBeGreaterThan(successId);
  });

  /*
    **默认停留时长是 4000ms，就是 sonner 的 `TOAST_LIFETIME`。**

    上游用的是 sonner，两处调用点（`workspace-content.tsx:44`、
    `showcase/[thread_id]/layout.tsx:29`）都没有传 `duration`，所以走的是库的
    默认值 4000（`sonner/dist/index.mjs` 里那行 `const TOAST_LIFETIME = 4000`）。
    本仓此前写的是 5000——**同一句提示在两个应用里停留的时间不一样**，
    而这一档正是「上游没有关闭键」能成立的前提：toast 只能等它自己走。

    这里断言的是**传给 timer 的那个毫秒数**，不是常量本身：
    默认值改了但 `schedule()` 忘了用它，钉常量的写法看不出来。
  */
  it("pauses the existing lifetime and resumes only the remaining time, including new notices while paused", () => {
    vi.useFakeTimers();
    try {
      const store = createWorkspaceToastStore();
      const first = store.message("First");
      vi.advanceTimersByTime(1000);
      store.setPaused(true);
      const second = store.message("Second");
      vi.advanceTimersByTime(10_000);
      expect(store.toasts.value.map(({ id }) => id)).toEqual([first, second]);
      store.setPaused(false);
      vi.advanceTimersByTime(2999);
      expect(store.toasts.value).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(store.toasts.value.map(({ id }) => id)).toEqual([second]);
      vi.advanceTimersByTime(1000);
      expect(store.toasts.value).toEqual([]);
      store.clear();
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps dismiss and clear authoritative while the viewport lifetime is paused", () => {
    vi.useFakeTimers();
    try {
      const store = createWorkspaceToastStore();
      const id = store.error("Rejected");
      store.setPaused(true);
      store.dismiss(id);
      store.message("Updated", { id });
      store.clear();
      store.setPaused(false);
      vi.advanceTimersByTime(10_000);
      expect(store.toasts.value).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("defaults to sonner's 4000ms lifetime", () => {
    const delays: number[] = [];
    const timer: ToastTimer = {
      set(_callback, delayMs) {
        delays.push(delayMs);
        return delays.length;
      },
      clear() {},
    };
    const store = createWorkspaceToastStore({ timer });
    store.success("Export complete");
    store.warning("Careful");
    store.message("Retrying");
    expect(delays).toEqual([4_000, 4_000, 4_000]);
  });

  /*
    plain message 与四个 status kind 对应当前 React 的 sonner 调用。
    warning 此前折进 info，理由是「toaster 一个图标都不画，两档没有可观察差别」
    ——wave 73 补上图标之后那条理由不成立了。
  */
  it("exposes a plain message and the four status toast kinds", () => {
    const store = createWorkspaceToastStore({
      timer: { set: () => 1, clear() {} },
    });
    store.success("a");
    store.error("b");
    store.info("c");
    store.warning("d");
    store.message("e");
    expect(store.toasts.value.map((toast) => toast.kind)).toEqual([
      "success",
      "error",
      "info",
      "warning",
      "default",
    ]);
  });
});

describe("workspace shortcuts", () => {
  it.each([
    [{ key: "k", metaKey: true }, "command-palette"],
    [{ key: "k", ctrlKey: true }, "command-palette"],
    [{ key: "N", metaKey: true, shiftKey: true }, "new-chat"],
    [{ key: "n", ctrlKey: true, shiftKey: true }, "new-chat"],
    [{ key: ",", metaKey: true }, "settings"],
    [{ key: "/", ctrlKey: true }, "shortcuts"],
    [{ key: "b", metaKey: true }, "toggle-sidebar"],
  ] as const)("maps the exact cross-platform command %#", (event, command) => {
    expect(commandForWorkspaceShortcut(event)).toBe(command);
  });

  it("rejects repeats, IME, alt, extra shift, and non-command modifiers", () => {
    expect(
      commandForWorkspaceShortcut({ key: "k", metaKey: true, repeat: true }),
    ).toBeNull();
    expect(
      commandForWorkspaceShortcut({
        key: "k",
        metaKey: true,
        isComposing: true,
      }),
    ).toBeNull();
    expect(
      commandForWorkspaceShortcut({ key: "k", metaKey: true, altKey: true }),
    ).toBeNull();
    expect(
      commandForWorkspaceShortcut({ key: "k", metaKey: true, shiftKey: true }),
    ).toBeNull();
    expect(commandForWorkspaceShortcut({ key: "k" })).toBeNull();
  });

  it("recognizes input, textarea, select and contenteditable targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(
      [input, textarea, select, editable].map(
        isWorkspaceShortcutEditableTarget,
      ),
    ).toEqual([true, true, true, true]);
    expect(isWorkspaceShortcutEditableTarget(document.body)).toBe(false);
  });
});

describe("shortcut modifier labels", () => {
  /*
    快捷键本身两边都认 Ctrl（上面那组用例钉着），但**标签**此前写死了 ⌘/⇧——
    Windows 与 Linux 用户会看到一串自己键盘上没有的符号。判据与上游一致：
    user agent 里有没有 "Mac"。
  */
  it("follows the platform the way upstream does", () => {
    expect(
      shortcutModifierLabels("Mozilla/5.0 (Macintosh; Intel Mac OS X)"),
    ).toEqual({ meta: "\u2318", shift: "\u21e7" });
    expect(
      shortcutModifierLabels("Mozilla/5.0 (Windows NT 10.0; Win64)"),
    ).toEqual({ meta: "Ctrl+", shift: "Shift+" });
    expect(shortcutModifierLabels("Mozilla/5.0 (X11; Linux x86_64)")).toEqual({
      meta: "Ctrl+",
      shift: "Shift+",
    });
  });

  it("falls back to the non-Mac set when there is no user agent", () => {
    // SSR 与首帧走这一支，和上游 useState(false) 的起点一致。
    expect(shortcutModifierLabels(undefined)).toBe(OTHER_SHORTCUT_MODIFIERS);
  });

  it("leaves no hard-coded modifier glyph in the palette template", () => {
    /*
      光有 helper 不够：面板自己写死 ⌘ 的话上面那两条照样绿。
      `.dom.test.ts` 里 import.meta.url 不是 file: URL，所以走 cwd。
    */
    const palette = readFileSync(
      resolve(process.cwd(), "app/components/workspace/CommandPalette.vue"),
      "utf8",
    ).replaceAll(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, "");
    expect(palette).not.toMatch(/[\u2318\u21e7]/);
    expect(palette).toContain("shortcutModifierLabels(");
  });
});

describe("settings query state machine", () => {
  it("accepts only real settings sections", () => {
    expect(readSettingsSection("memory")).toBe("memory");
    expect(readSettingsSection(["appearance", "memory"])).toBe("appearance");
    expect(readSettingsSection("unknown")).toBeNull();
    expect(readSettingsSection(undefined)).toBeNull();
  });

  it("removes only settings while preserving the rest of query and hash", () => {
    expect(
      buildSettingsCloseLocation({
        path: "/workspace/chats/t-1",
        query: { settings: "memory", tab: "files", tag: ["a", "b"] },
        hash: "#run-2",
      }),
    ).toEqual({
      path: "/workspace/chats/t-1",
      query: { tab: "files", tag: ["a", "b"] },
      hash: "#run-2",
    });
  });
});
