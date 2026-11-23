import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import ProjectInstructionsSection from "@/components/workspace/projects/ProjectInstructionsSection.vue";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import type { Project } from "@/core/projects/types";

const api = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/composables/useProjects", () => ({
  useProjectMutations: () => ({
    patch: {
      mutateAsync: api.patch,
      isPending: ref(false),
      isSuccess: ref(false),
    },
  }),
}));
vi.mock("@/composables/useProjectDocuments", () => ({
  useProjectsConfig: () => ({
    data: ref({ instructions_max_bytes: 6, trash_retention_days: 30 }),
  }),
}));
const initial: Project = {
  id: "p-1",
  name: "Project",
  instructions: "old",
  status: "active",
  presentation: {},
  created_at: "",
  updated_at: "1",
};
beforeEach(() => api.patch.mockReset());

function mountEditor() {
  const project = ref(initial);
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(ProjectInstructionsSection, {
          project: project.value,
          key: project.value.id,
        }),
    }),
    {
      global: {
        provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      },
    },
  );
  return { wrapper, project };
}

it("enforces the configured UTF-8 byte limit, including multibyte text", async () => {
  const { wrapper } = mountEditor();
  await wrapper.get("textarea").setValue("中文🙂");
  expect(wrapper.get("textarea").attributes("aria-invalid")).toBe("true");
  expect(wrapper.text()).toContain("10 / 6 bytes");
  expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  await wrapper.get("button").trigger("click");
  expect(api.patch).not.toHaveBeenCalled();
  wrapper.unmount();
});

it("submits A without overwriting B on response/refetch and resets only when the project changes", async () => {
  let settle!: () => void;
  api.patch.mockReturnValue(
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );
  const { wrapper, project } = mountEditor();
  await wrapper.get("textarea").setValue("A");
  await wrapper.get("button").trigger("click");
  await wrapper.get("textarea").setValue("B");
  project.value = { ...initial, instructions: "A", updated_at: "2" };
  settle();
  await flushPromises();
  expect(api.patch).toHaveBeenCalledWith({
    id: "p-1",
    input: { instructions: "A" },
  });
  expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
    "B",
  );
  project.value = { ...initial, id: "p-2", instructions: "other" };
  await flushPromises();
  expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
    "other",
  );
  wrapper.unmount();
});
