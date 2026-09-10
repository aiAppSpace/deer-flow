/*
  【文件职责】     钉住「只有分组模式才去取项目列表」。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【边界与注意】   **平铺是默认模式**，而平铺下整个分组列表都不渲染——项目列表取回来
                   没人看。差别不是「少两个请求」这么轻：默认模式意味着每个用户每次
                   打开工作区都会白发两个。

                   上游用的是另一种写法（把 `useProjects` 放进只有分组模式才渲染的
                   子组件 `GroupedProjectList` 里），本仓不拆子组件、改用 `enabled`
                   表达同一件事。**写法不同、可观察行为必须相同**，所以这里钉的是
                   「发没发请求」而不是「用了哪种写法」。

                   这条差异是 2026-09-10 的对照台账读出来的
                   （`GET /api/projects?status=*` 进了 requestsOnlyVue，98 处），
                   在那之前本仓一直在白发。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const api = vi.hoisted(() => ({ listProjects: vi.fn() }));
vi.mock("@/core/projects/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listProjects: api.listProjects,
}));

const settings = vi.hoisted(() => ({
  displayMode: "flat" as "flat" | "grouped",
}));
vi.mock("@/core/settings/local", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getLocalSettings: () => ({
      ...(actual.DEFAULT_LOCAL_SETTINGS as Record<string, unknown>),
      projects: { displayMode: settings.displayMode },
    }),
    saveLocalSettings: vi.fn(),
  };
});
vi.mock("@/composables/useThreads", () => ({
  useThreads: () => ({ threads: [], displayedThreads: [] }),
}));

import ProjectsSection from "@/components/workspace/projects/ProjectsSection.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

beforeEach(() => {
  api.listProjects.mockReset();
  api.listProjects.mockResolvedValue([]);
  settings.displayMode = "flat";
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("useRoute", () => ({
    path: "/workspace/chats/new",
    params: {},
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mountSection() {
  return mount(ProjectsSection, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false } },
            }),
          },
        ],
      ],
      stubs: { NuxtLink: { template: "<a><slot /></a>" } },
      provide: {
        [workspaceToastKey as symbol]: createWorkspaceToastStore(),
      },
    },
  });
}

describe("项目列表的取数闸门", () => {
  it("平铺模式（默认）不去取项目列表", async () => {
    const wrapper = mountSection();
    await flushPromises();
    expect(api.listProjects).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("分组模式才取，active 与 archived 各一次", async () => {
    settings.displayMode = "grouped";
    const wrapper = mountSection();
    await flushPromises();
    expect(api.listProjects.mock.calls.map((call) => call[0]).sort()).toEqual([
      "active",
      "archived",
    ]);
    wrapper.unmount();
  });
});
