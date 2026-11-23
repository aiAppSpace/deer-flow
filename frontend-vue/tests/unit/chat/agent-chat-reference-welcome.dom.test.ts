import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { mount } from "@vue/test-utils";
import ts from "typescript";
import { computed, defineComponent, h, nextTick, ref } from "vue";
import { parse } from "vue/compiler-sfc";
import { describe, expect, it, vi } from "vitest";

const source = parse(
  readFileSync(
    resolve(process.cwd(), "app/components/chat/AgentChat.vue"),
    "utf8",
  ),
).descriptor.scriptSetup!.content;
const ast = ts.createSourceFile("AgentChat.ts", source, ts.ScriptTarget.Latest);
const statements = ast.statements.filter(
  (statement) =>
    (ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "adoptPreparedThread") ||
    (ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => declaration.name.getText(ast) === "isWelcomeMode",
      )),
);
const owner = ts.transpileModule(
  `${statements.map((statement) => statement.getText(ast)).join("\n")}\n({isWelcomeMode, adoptPreparedThread});`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const UUID = "f7d5c66b-9f65-4f8c-8311-0b1c6705af71";

function harness(initialThread: string | null = null) {
  const routeThreadId = ref(initialThread);
  const preparedThreadId = ref<string | null>(UUID);
  const props = {
    bootstrap: false,
    agentName: undefined as string | undefined,
  };
  const router = {
    replace: vi.fn(async (path: string) => {
      routeThreadId.value = path.split("/").at(-1)!;
    }),
  };
  let adopt!: () => Promise<void>;
  const wrapper = mount(
    defineComponent({
      setup() {
        const actual = runInNewContext(owner, {
          computed,
          routeThreadId,
          preparedThreadId,
          props,
          router,
          lastStartedThreadId: null,
          visibleMessages: ref([]),
          stream: { isHistoryLoading: ref(false) },
          encodeURIComponent,
        }) as {
          isWelcomeMode: { value: boolean };
          adoptPreparedThread: () => Promise<void>;
        };
        adopt = actual.adoptPreparedThread;
        return () =>
          h("div", { "data-welcome": String(actual.isWelcomeMode.value) });
      },
    }),
  );
  return { wrapper, adopt, router, routeThreadId, props, preparedThreadId };
}

describe("reference attachment materializes the welcome thread", () => {
  it("exits welcome on the exact prepared UUID before any message is sent", async () => {
    const subject = harness();
    try {
      expect(subject.wrapper.attributes("data-welcome")).toBe("true");
      await subject.adopt();
      await nextTick();
      expect(subject.router.replace).toHaveBeenCalledExactlyOnceWith(
        `/workspace/chats/${UUID}`,
      );
      expect(subject.wrapper.attributes("data-welcome")).toBe("false");
      subject.routeThreadId.value = null;
      await nextTick();
      expect(subject.wrapper.attributes("data-welcome")).toBe("true");
    } finally {
      subject.wrapper.unmount();
    }
  });
  it("keeps an existing empty thread outside welcome and never adopts another ID", async () => {
    const subject = harness("existing-thread");
    try {
      expect(subject.wrapper.attributes("data-welcome")).toBe("false");
      await subject.adopt();
      expect(subject.router.replace).not.toHaveBeenCalled();
    } finally {
      subject.wrapper.unmount();
    }
  });
  it("keeps bootstrap ownership and agent-specific adoption separate", async () => {
    const subject = harness();
    try {
      subject.props.bootstrap = true;
      await subject.adopt();
      expect(subject.router.replace).not.toHaveBeenCalled();
      subject.props.bootstrap = false;
      subject.props.agentName = "Research Assistant";
      await subject.adopt();
      expect(subject.router.replace).toHaveBeenCalledExactlyOnceWith(
        `/workspace/agents/Research%20Assistant/chats/${UUID}`,
      );
      expect(subject.wrapper.attributes("data-welcome")).toBe("false");
    } finally {
      subject.wrapper.unmount();
    }
  });
});
