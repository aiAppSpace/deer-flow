import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, expect, it, vi } from "vitest";

import { useArtifactPreviewContent } from "@/composables/useArtifactPreviewContent";

afterEach(() => vi.useRealTimers());

it("throttles active write previews to 3 seconds, then flushes completion and identity changes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
  const content = ref("first");
  const writing = ref(true);
  const identity = ref("first-file");
  let preview!: ReturnType<typeof useArtifactPreviewContent>;
  const wrapper = mount(
    defineComponent({
      setup() {
        preview = useArtifactPreviewContent({ content, writing, identity });
        return () => null;
      },
    }),
  );
  content.value = "second";
  content.value = "latest";
  await nextTick();
  expect(preview.value).toBe("first");
  vi.advanceTimersByTime(2_999);
  expect(preview.value).toBe("first");
  vi.advanceTimersByTime(1);
  expect(preview.value).toBe("latest");
  content.value = "complete";
  writing.value = false;
  await nextTick();
  expect(preview.value).toBe("complete");
  writing.value = true;
  content.value = "pending";
  identity.value = "second-file";
  await nextTick();
  expect(preview.value).toBe("pending");
  content.value = "last pending";
  await nextTick();
  expect(vi.getTimerCount()).toBe(1);
  wrapper.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
