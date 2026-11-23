import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import ts from "typescript";
import { computed, defineComponent, ref } from "vue";
import { parse } from "vue/compiler-sfc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProjectAffiliationBadge from "@/components/workspace/ProjectAffiliationBadge.vue";
import { projectIdOfThread } from "@/core/threads/utils";
const api = vi.hoisted(() => ({ getProject: vi.fn() }));
vi.mock("@/core/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/projects")>()),
  getProject: api.getProject,
}));

const component = parse(
  readFileSync(
    resolve(process.cwd(), "app/components/chat/AgentChat.vue"),
    "utf8",
  ),
).descriptor;
const ast = ts.createSourceFile(
  "AgentChat.ts",
  component.scriptSetup!.content,
  ts.ScriptTarget.Latest,
);
const statement = ast.statements.find(
  (node) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(
      (declaration) => declaration.name.getText(ast) === "affiliatedProjectId",
    ),
)!;
const owner = ts.transpileModule(
  `${statement.getText(ast)}\naffiliatedProjectId;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const header = component.template!.content.match(
  /<div\s+class="flex min-w-0 flex-1 items-center[^"]*"[\s\S]*?<\/div>/,
)?.[0];
if (!header) throw new Error("The actual chat title header was not found");
const link = { props: ["to"], template: '<a :href="to"><slot /></a>' };
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
beforeEach(() => {
  api.getProject
    .mockReset()
    .mockResolvedValue({ id: "project/a", name: "Quarterly research" });
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
});
function harness({
  demo = false,
  agent = false,
  id = "thread-a" as string | null,
} = {}) {
  const metadata = ref({ metadata: { deerflow_project_id: "project/a" } });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const Host = defineComponent({
    components: {
      ProjectAffiliationBadge,
      FlipDisplay: { template: "<div><slot /></div>" },
    },
    template: header,
    setup() {
      return {
        affiliatedProjectId: runInNewContext(owner, {
          computed,
          routeThreadId: ref(id),
          isDemo: ref(demo),
          props: { agentName: agent ? "agent-a" : undefined },
          threadMetadata: { data: metadata },
          projectIdOfThread,
        }),
        headerTitle: "Chat title",
        routeThreadId: id,
        isDemo: demo,
        agentName: agent ? "agent-a" : undefined,
        threadMetadata: { data: metadata },
      };
    },
  });
  const wrapper = mount(Host, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      stubs: { NuxtLink: link, ThreadArchiveStatus: true },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, metadata };
}
describe("actual chat header project affiliation", () => {
  it("loads and links the materialized thread's canonical project", async () => {
    const { wrapper } = harness();
    await flushPromises();
    expect(wrapper.get("a").text()).toBe("Quarterly research");
    expect(wrapper.get("a").attributes("href")).toBe(
      "/workspace/projects/project%2Fa",
    );
    expect(api.getProject).toHaveBeenCalledTimes(1);
    expect(api.getProject.mock.calls[0]![0]).toBe("project/a");
  });
  it.each([{ demo: true }, { agent: true }, { id: null }])(
    "does not look up projects outside ordinary materialized chats: %s",
    async (options) => {
      const { wrapper } = harness(options);
      await flushPromises();
      expect(wrapper.find("a").exists()).toBe(false);
      expect(api.getProject).not.toHaveBeenCalled();
    },
  );
  it("hides a deleted project and retires an old affiliation on metadata change", async () => {
    const { wrapper, metadata } = harness();
    await flushPromises();
    expect(wrapper.get("a").text()).toBe("Quarterly research");
    api.getProject.mockRejectedValue(new Error("Project deleted"));
    metadata.value = { metadata: { deerflow_project_id: "deleted-project" } };
    await flushPromises();
    expect(wrapper.find("a").exists()).toBe(false);
    expect(api.getProject).toHaveBeenCalledTimes(2);
  });
});
