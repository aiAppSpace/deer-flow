import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { flushPromises, mount } from "@vue/test-utils";
import ts from "typescript";
import { computed, defineComponent, h, ref } from "vue";
import { parse } from "vue/compiler-sfc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShowcaseThreadState } from "@/composables/useShowcaseThreadState";
import TodoList from "@/components/workspace/TodoList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Todo } from "@/core/todos";

// Mount the real public snapshot owner and TodoList with AgentChat's
// authoritative computed. Unrelated stream/panels remain outside this test.
const source = readFileSync(
  resolve(process.cwd(), "app/components/chat/AgentChat.vue"),
  "utf8",
);
const script = parse(source).descriptor.scriptSetup!.content;
const ast = ts.createSourceFile("AgentChat.ts", script, ts.ScriptTarget.Latest);
const todosStatement = ast.statements.find(
  (statement) =>
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(
      (declaration) => declaration.name.getText(ast) === "authoritativeTodos",
    ),
)!;
const productionOwner = ts.transpileModule(
  `${todosStatement.getText(ast)}\nauthoritativeTodos;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const report = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "public/demo/threads/fe3f7974-1bcb-4a01-a950-79673baafefd/thread.json",
    ),
    "utf8",
  ),
) as { values: { todos: Todo[] } };
const wrappers: ReturnType<typeof mount>[] = [];

function harness() {
  const routeThreadId = ref<string | null>("report-a");
  const isDemo = ref(true);
  let demoTodos!: Readonly<{ value: Todo[] }>;
  const pending: {
    signal: AbortSignal;
    resolve: (response: Response) => void;
  }[] = [];
  const fetch = vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise<Response>((done) =>
        pending.push({ signal: options.signal!, resolve: done }),
      ),
  );
  const workspaceTodos: Todo[] = [
    { content: "Private workspace task", status: "pending" },
  ];
  vi.stubGlobal("fetch", fetch);
  const Host = defineComponent({
    setup() {
      const showcaseState = useShowcaseThreadState(isDemo, routeThreadId);
      demoTodos = computed(() => showcaseState.value.todos ?? []);
      const todos = runInNewContext(productionOwner, {
        computed,
        routeThreadId,
        isDemo,
        demoTodos,
        stream: { state: ref({ todos: workspaceTodos }) },
        threads: { threads: [] },
      }) as { value: Todo[] };
      return () => h(TodoList, { todos: todos.value });
    },
  });
  const wrapper = mount(Host);
  wrappers.push(wrapper);
  const finish = (index: number, todos: unknown) => {
    pending[index]!.resolve(
      new Response(JSON.stringify({ values: { todos } }), { status: 200 }),
    );
  };
  return { wrapper, routeThreadId, isDemo, pending, finish, demoTodos };
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe("public fixture todos", () => {
  it("renders the actual report todos and its native collapse control", async () => {
    const { wrapper, finish } = harness();
    expect(wrapper.find("[data-testid='thread-todos']").exists()).toBe(false);
    finish(0, report.values.todos);
    await flushPromises();
    expect(wrapper.get("button").attributes("aria-expanded")).toBe("false");
    await wrapper.get("button").trigger("click");
    expect(wrapper.get("button").attributes("aria-expanded")).toBe("true");
    expect(wrapper.findAll("li").map((row) => row.text())).toEqual(
      report.values.todos.map((todo) => todo.content),
    );
    expect(wrapper.text()).not.toContain("Private workspace task");
  });

  it("clears a route immediately and rejects a late previous fixture", async () => {
    const { wrapper, finish, routeThreadId, pending, isDemo, demoTodos } =
      harness();
    finish(0, [{ content: "Report A", status: "completed" }]);
    await flushPromises();
    expect(wrapper.text()).toContain("Report A");
    routeThreadId.value = "report-b";
    expect(demoTodos.value).toEqual([]);
    await flushPromises();
    expect(wrapper.find("[data-testid='thread-todos']").exists()).toBe(false);
    routeThreadId.value = "report-c";
    expect(pending[1]!.signal.aborted).toBe(true);
    finish(2, [{ content: "Report C", status: "in_progress" }]);
    await flushPromises();
    finish(1, [{ content: "Late Report B", status: "completed" }]);
    await flushPromises();
    expect(wrapper.text()).toContain("Report C");
    expect(wrapper.text()).not.toContain("Late Report B");
    isDemo.value = false;
    expect(demoTodos.value).toEqual([]);
    await flushPromises();
    expect(wrapper.text()).toContain("Private workspace task");
    expect(wrapper.text()).not.toContain("Report C");
  });

  it("keeps malformed public values out of the real todo controls", async () => {
    const { wrapper, finish } = harness();
    finish(0, [
      null,
      { content: 17, status: "completed" },
      { content: "Unsupported state", status: "future-status" },
      { content: "Valid todo", status: "pending" },
    ]);
    await flushPromises();
    expect(wrapper.findAll("li").map((row) => row.text())).toEqual([
      "Valid todo",
    ]);
  });

  it("aborts the public fixture when its mounted owner retires", () => {
    const { wrapper, pending } = harness();
    wrapper.unmount();
    expect(pending[0]!.signal.aborted).toBe(true);
  });
});
