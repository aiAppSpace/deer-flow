/*
  会话页自己拼出来的那个 thread 对象**不许给标题兜底**。

  它只喂 ExportTrigger，而导出用的 `titleOfThread` 自己带 "Untitled" 兜底，
  与上游 `core/threads/export.ts` 是同一条链。此前 AgentChat 在这一支里填的是
  `currentTitle`，而 currentTitle 在这一支里恒等于 `pages.newChat`——于是同一条
  无标题会话，React 导出 `Untitled.md`、本仓导出 `New Chat.md`，中文界面下还会
  变成 `新对话.md`，导出文件名跟着界面语言走。

  台账取不到它：导出要点开菜单，文件名根本不在 DOM 里。所以这里一半用源码守卫
  钉住"没有兜底"，另一半用 titleOfThread 钉住"兜底在下游、且是英文常量"。
*/

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { computed, ref } from "vue";

import { describe, expect, it } from "vitest";

import { titleOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";

/** 坑 59：先剥注释，否则锚点串会在解释它的注释里被找到。 */
const stripComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

function currentThreadBlock() {
  const source = stripComments(
    readFileSync(
      resolve(process.cwd(), "app/components/chat/AgentChat.vue"),
      "utf8",
    ),
  );
  const start = source.indexOf("const currentThread = computed");
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  return rest.slice(0, rest.indexOf("\n});") + 4);
}

describe("AgentChat synthesised thread", () => {
  it.each([
    [false, "stale public title", undefined],
    [true, "Actual public report", "Actual public report"],
    [true, undefined, undefined],
  ])(
    "uses only an actual public title for demo=%s, title=%s",
    (demo, title, expected) => {
      const actual = runInNewContext(
        ts.transpileModule(`${currentThreadBlock()}\ncurrentThread.value;`, {
          compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText,
        {
          computed,
          routeThreadId: ref("public-or-user-thread"),
          threads: { threads: [] },
          isDemo: ref(demo),
          showcaseState: ref({ title }),
          visibleMessages: ref([]),
          stream: { state: ref({}) },
        },
      ) as AgentThread;
      expect(actual.values.title).toBe(expected);
      expect(titleOfThread(actual)).toBe(expected ?? "Untitled");
    },
  );

  it("a public report title takes precedence over a same-ID account list row", () => {
    const actual = runInNewContext(
      ts.transpileModule(`${currentThreadBlock()}\ncurrentThread.value;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        computed,
        routeThreadId: ref("public-thread"),
        threads: {
          threads: [
            { thread_id: "public-thread", values: { title: "Account title" } },
          ],
        },
        isDemo: ref(true),
        showcaseState: ref({ title: "Public title" }),
        visibleMessages: ref([]),
        stream: { state: ref({}) },
      },
    ) as AgentThread;
    expect(actual.values.title).toBe("Public title");
  });

  it("has no localized title fallback left in the file", () => {
    const source = stripComments(
      readFileSync(
        resolve(process.cwd(), "app/components/chat/AgentChat.vue"),
        "utf8",
      ),
    );

    expect(source).not.toContain("currentTitle");
  });

  it("lets titleOfThread supply the untranslated upstream fallback", () => {
    const thread = {
      thread_id: "t-1",
      values: { messages: [] },
    } as unknown as AgentThread;

    expect(titleOfThread(thread)).toBe("Untitled");
  });
});
