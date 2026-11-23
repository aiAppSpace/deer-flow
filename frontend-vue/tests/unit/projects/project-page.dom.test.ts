import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { expect, it, vi } from "vitest";
import ProjectPage from "@/pages/workspace/projects/[id].vue";
const project = ref({
  id: "p",
  name: "Project",
  status: "active",
  instructions: "",
  presentation: {},
  created_at: "",
  updated_at: "",
});
vi.mock("@/composables/useProjects", () => ({
  useProject: () => ({ data: project, isError: ref(false) }),
  useProjectThreads: () => ({
    data: ref({ pages: [[]] }),
    isError: ref(false),
    isLoading: ref(false),
    hasNextPage: ref(false),
    isFetchingNextPage: ref(false),
  }),
}));
vi.mock("@/components/workspace/projects/ProjectThreadsSection.vue", () => ({
  default: defineComponent({ setup: () => () => h("section", "Chats body") }),
}));
vi.mock("@/components/workspace/projects/ProjectDocumentsSection.vue", () => ({
  default: defineComponent({
    setup: () => () => h("section", "Documents body"),
  }),
}));
vi.mock(
  "@/components/workspace/projects/ProjectInstructionsSection.vue",
  () => ({
    default: defineComponent({
      setup: () => () => h("section", "Instructions body"),
    }),
  }),
);
vi.mock("@/components/workspace/projects/ProjectSettingsSection.vue", () => ({
  default: defineComponent({
    setup: () => () => h("section", "Settings body"),
  }),
}));
vi.mock("@/components/workspace/WorkspaceContainer.vue", () => ({
  default: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h("main", slots.default?.()),
  }),
}));
it("exposes four local-state tabs with the corresponding actual page consumers", async () => {
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useRoute", () => ({ params: { id: "p" } }));
  const wrapper = mount(ProjectPage);
  expect(wrapper.findAll('[role="tab"]').map((node) => node.text())).toEqual([
    "Chats",
    "Documents",
    "Instructions",
    "Settings",
  ]);
  for (const [index, text] of [
    "Chats",
    "Documents",
    "Instructions",
    "Settings",
  ].entries()) {
    const trigger = wrapper.findAll('[role="tab"]')[index]!;
    await trigger.trigger("mousedown", { button: 0 });
    await trigger.trigger("click");
    expect(wrapper.text()).toContain(`${text} body`);
  }
  expect(window.location.search).toBe("");
  wrapper.unmount();
});
