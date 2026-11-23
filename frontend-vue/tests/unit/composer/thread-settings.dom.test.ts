import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";

describe("thread-scoped context settings", () => {
  it("restores canonical thread overrides while separate agent conversations inherit the React base context", async () => {
    localStorage.clear();
    vi.resetModules();
    const { useThreadSettings } =
      await import("@/composables/useThreadSettings");
    localStorage.setItem("deerflow.thread-model.thread-a", "existing-model");
    const scope = ref("thread-a");
    let settings!: ReturnType<typeof useThreadSettings>["settings"];
    let update!: ReturnType<typeof useThreadSettings>["update"];
    const wrapper = mount(
      defineComponent({
        setup() {
          ({ settings, update } = useThreadSettings(scope));
          return () => h("div");
        },
      }),
    );

    expect(settings.value.context.model_name).toBe("existing-model");
    update("context", {
      model_name: "reasoner",
      mode: "pro",
      reasoning_effort: "medium",
    });
    await nextTick();
    expect(settings.value.context).toMatchObject({
      model_name: "reasoner",
      mode: "pro",
      reasoning_effort: "medium",
    });

    scope.value = "thread-b";
    await nextTick();
    // React keeps mode/effort and the most recent model as the base for a new
    // thread until that thread gets its own model override.
    expect(settings.value.context.model_name).toBe("reasoner");
    update("context", { model_name: "basic", mode: "flash" });
    await nextTick();

    scope.value = "thread-a";
    await nextTick();
    expect(settings.value.context.model_name).toBe("reasoner");
    expect(settings.value.context.mode).toBe("flash");

    scope.value = "analyst-thread";
    await nextTick();
    expect(settings.value.context.model_name).toBe("basic");
    update("context", { model_name: "analyst-default", mode: "thinking" });
    await nextTick();

    scope.value = "thread-a";
    await nextTick();
    expect(settings.value.context.model_name).toBe("reasoner");
    scope.value = "analyst-thread";
    await nextTick();
    expect(settings.value.context.model_name).toBe("analyst-default");

    expect(localStorage.getItem("deerflow.thread-model.thread-a")).toBe(
      "reasoner",
    );
    expect(localStorage.getItem("deerflow.thread-model.analyst-thread")).toBe(
      "analyst-default",
    );
    wrapper.unmount();
  });
});
