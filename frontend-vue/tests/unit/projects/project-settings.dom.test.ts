import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import ProjectSettingsSection from "@/components/workspace/projects/ProjectSettingsSection.vue";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import type { Project } from "@/core/projects";
const api = vi.hoisted(() => ({
  patch: vi.fn(),
  remove: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/composables/useProjects", () => ({
  useProjectMutations: () => ({
    patch: { mutateAsync: api.patch, isPending: ref(false) },
    archive: { isPending: ref(false) },
    restore: { isPending: ref(false) },
    remove: { mutateAsync: api.remove, isPending: ref(false) },
  }),
}));
const initial: Project = {
  id: "p-1",
  name: "old",
  instructions: "keep",
  status: "active",
  presentation: {},
  created_at: "",
  updated_at: "1",
};
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.stubGlobal("useRouter", () => ({ push: api.push }));
});
it("renames only name, retains the newer draft after refetch, and adopts remote names only for a clean draft", async () => {
  let settle!: () => void;
  api.patch.mockReturnValue(
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );
  const project = ref(initial);
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(ProjectSettingsSection, {
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
  await wrapper.get("input").setValue(" A ");
  await wrapper.get("button").trigger("click");
  await wrapper.get("input").setValue("B");
  project.value = { ...initial, name: "A", updated_at: "2" };
  settle();
  await flushPromises();
  expect(api.patch).toHaveBeenCalledWith({ id: "p-1", input: { name: "A" } });
  expect((wrapper.get("input").element as HTMLInputElement).value).toBe("B");
  project.value = { ...initial, id: "p-2", name: "other" };
  await flushPromises();
  expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
    "other",
  );
  project.value = { ...project.value, name: "remote" };
  await flushPromises();
  expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
    "remote",
  );
  wrapper.unmount();
});
