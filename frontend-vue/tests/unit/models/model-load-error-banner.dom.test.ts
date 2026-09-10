/*
  【文件职责】     守住模型加载失败横幅：什么时候出现、重试期间不闪、401 不报。
  【架构位置】     测试
  【依赖关系】     ModelLoadErrorBanner.vue · composables/useModels
  【边界与注意】   「重试期间不闪」这一条最容易被改坏：另一个观察者重取时
                   TanStack 会先把 error 清掉，不记住的话横幅会消失一瞬又出现。
                   它没有一眼可见的症状，只有一次视觉抖动——所以要有用例钉住。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const models = vi.hoisted(() => ({
  error: undefined as unknown as { value: Error | null },
  fetching: undefined as unknown as { value: boolean },
  refetch: vi.fn(),
}));
vi.mock("@/composables/useModels", async () => {
  const { ref: makeRef } = await import("vue");
  models.error = makeRef(null);
  models.fetching = makeRef(false);
  return {
    useModels: () => ({
      models: makeRef([]),
      tokenUsageEnabled: makeRef(false),
      loading: makeRef(false),
      fetching: models.fetching,
      error: models.error,
      refetch: models.refetch,
    }),
  };
});

import ModelLoadErrorBanner from "@/components/workspace/ModelLoadErrorBanner.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { UnauthorizedError } from "@/core/api/errors";

beforeEach(() => {
  models.error.value = null;
  models.fetching.value = false;
  models.refetch.mockReset();
  models.refetch.mockResolvedValue(undefined);
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const mountBanner = (props: Record<string, unknown> = {}) =>
  mount(ModelLoadErrorBanner, { props });

const banner = (wrapper: ReturnType<typeof mountBanner>) =>
  wrapper.find('[data-testid="model-load-error-banner"]');

describe("模型加载失败横幅", () => {
  it("没出错就不渲染", () => {
    const wrapper = mountBanner();
    expect(banner(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it("出错时说清楚并给重试", async () => {
    models.error.value = new Error("boom");
    const wrapper = mountBanner();
    await flushPromises();
    expect(banner(wrapper).text()).toContain(enUS.workspace.modelLoadFailed);
    expect(banner(wrapper).text()).toContain(enUS.workspace.modelLoadRetry);
    wrapper.unmount();
  });

  it("401 不报：那条错误已经在跳登录了", async () => {
    models.error.value = new UnauthorizedError();
    const wrapper = mountBanner();
    await flushPromises();
    expect(banner(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it("Gateway 整体不可用时让给那条横幅", async () => {
    models.error.value = new Error("boom");
    const wrapper = mountBanner({ gatewayUnavailable: true });
    await flushPromises();
    // 两条横幅叠在一起只会互相干扰。
    expect(banner(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it("别人重取把 error 清掉的那一瞬间，横幅不消失", async () => {
    models.error.value = new Error("boom");
    const wrapper = mountBanner();
    await flushPromises();
    expect(banner(wrapper).exists()).toBe(true);

    // TanStack 在另一个观察者重取时会先清掉这份查询的 error。
    models.error.value = null;
    models.fetching.value = true;
    await flushPromises();
    expect(banner(wrapper).exists()).toBe(true);

    // 那次重取成功了，这才该消失。
    models.fetching.value = false;
    await flushPromises();
    expect(banner(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  /*
    「只观察、不自己发请求」这一条**行为测不到**：这个文件把 useModels 换成了
    替身，替身不会理会 `enabled`。而它承重——挂成 enabled 的话，一个只想报错的
    横幅会自己去拉一遍模型列表，多一次请求还可能把别人的失败盖掉。
    所以钉源码。
  */
  it("以 enabled: false 观察共享查询，不自己发请求", async () => {
    const source = await import("node:fs").then((fs) =>
      fs
        .readFileSync(
          "app/components/workspace/ModelLoadErrorBanner.vue",
          "utf8",
        )
        // 先剥注释：解释这条的注释里就写着 enabled。
        .replaceAll(/<!--[\s\S]*?-->/g, "")
        .replaceAll(/\/\*[\s\S]*?\*\//g, ""),
    );
    expect(source).toContain("useModels({ enabled: false })");
  });

  it("点重试时按钮禁用并标 aria-busy，回来后恢复", async () => {
    models.error.value = new Error("boom");
    let release!: () => void;
    models.refetch.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const wrapper = mountBanner();
    await flushPromises();

    await wrapper.get("button").trigger("click");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    expect(wrapper.get("button").attributes("aria-busy")).toBe("true");
    expect(wrapper.get("button").text()).toBe(enUS.workspace.modelLoadRetrying);

    release();
    await flushPromises();
    expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("button").text()).toBe(enUS.workspace.modelLoadRetry);
    wrapper.unmount();
  });
});
