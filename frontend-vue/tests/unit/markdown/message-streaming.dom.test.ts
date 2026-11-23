import { flushPromises, mount } from "@vue/test-utils";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { defineComponent, h, markRaw, nextTick } from "vue";

import MessageMarkdownContent from "@/components/chat/MessageMarkdownContent.vue";
import "@/components/markdown/StreamMarkdown.vue";

const wrappers: ReturnType<typeof mount>[] = [];
let reducedMotion = false;
let timeout: MockInstance<typeof globalThis.setTimeout>;
let clearTimeoutSpy: MockInstance<typeof globalThis.clearTimeout>;

beforeEach(() => {
  reducedMotion = false;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  timeout = vi.spyOn(globalThis, "setTimeout");
  clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
  vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
    matches: reducedMotion,
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function render(
  content: string,
  streaming = true,
  components?: Record<string, unknown>,
) {
  const wrapper = mount(MessageMarkdownContent, {
    props: { content, streaming, components },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

async function advance(milliseconds: number) {
  vi.advanceTimersByTime(milliseconds);
  await nextTick();
  await flushPromises();
}

describe("message streaming presentation owner", () => {
  it("shows short initial content immediately and paces long initial content on the visible cadence", async () => {
    const short = await render("short answer");
    expect(short.text()).toBe("short answer");
    const content = "a".repeat(200);
    const long = await render(content);
    expect(long.text()).toBe("");
    await advance(49);
    expect(long.text()).toBe("");
    await advance(1);
    expect(long.text()).toBe(content.slice(0, 64));
    await advance(250);
    expect(long.text()).toBe(content);
  });

  it("advances one append owner toward the latest target without restarting or replacing existing word nodes", async () => {
    const wrapper = await render("alpha beta");
    const alpha = wrapper.get('[data-md-word="0"]').element;
    const first = `alpha beta ${"gamma ".repeat(70)}`.trimEnd();
    await wrapper.setProps({ content: first });
    expect(wrapper.text()).toBe("alpha beta");
    await advance(50);
    const partial = wrapper.text();
    expect(partial.length).toBeGreaterThan(10);
    expect(partial.length).toBeLessThan(first.length);
    const latest = `${first} ${"delta ".repeat(40)}`.trimEnd();
    await wrapper.setProps({ content: latest });
    expect(wrapper.text()).toBe(partial);
    await advance(50);
    expect(wrapper.text().length).toBeGreaterThan(partial.length);
    expect(latest.startsWith(wrapper.text())).toBe(true);
    expect(wrapper.get('[data-md-word="0"]').element).toBe(alpha);
    await advance(250);
    expect(wrapper.text()).toBe(latest);
  });

  it("flushes replacement and loading completion immediately and retires pending ticks", async () => {
    const wrapper = await render("start");
    await wrapper.setProps({ content: "start" + "x".repeat(500) });
    await advance(50);
    const replacedTimerIndex = timeout.mock.calls.findLastIndex(
      ([, delay]) => delay === 50,
    );
    const replacedTimer = timeout.mock.results[replacedTimerIndex]?.value;
    clearTimeoutSpy.mockClear();
    await wrapper.setProps({ content: "replacement" });
    expect(wrapper.text()).toBe("replacement");
    expect(clearTimeoutSpy).toHaveBeenCalledWith(replacedTimer);
    await advance(400);
    expect(wrapper.text()).toBe("replacement");
    const completed = "replacement" + "y".repeat(500);
    await wrapper.setProps({ content: completed });
    await advance(50);
    expect(wrapper.text()).not.toBe(completed);
    const completedTimerIndex = timeout.mock.calls.findLastIndex(
      ([, delay]) => delay === 50,
    );
    const completedTimer = timeout.mock.results[completedTimerIndex]?.value;
    clearTimeoutSpy.mockClear();
    await wrapper.setProps({ streaming: false });
    expect(wrapper.text()).toBe(completed);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(completedTimer);
    expect(wrapper.find("[data-md-word]").exists()).toBe(false);
    timeout.mockClear();
    await advance(400);
    expect(timeout.mock.calls.some(([, delay]) => delay === 50)).toBe(false);
  });

  it("flushes immediately for reduced motion on mount and on the next append", async () => {
    reducedMotion = true;
    const content = "a".repeat(200);
    const wrapper = await render(content);
    expect(wrapper.text()).toBe(content);
    timeout.mockClear();
    await advance(400);
    expect(timeout.mock.calls.some(([, delay]) => delay === 50)).toBe(false);
    reducedMotion = false;
    await wrapper.setProps({ content: content + "b".repeat(300) });
    await advance(50);
    reducedMotion = true;
    const latest = content + "b".repeat(300) + "c";
    await wrapper.setProps({ content: latest });
    expect(wrapper.text()).toBe(latest);
    timeout.mockClear();
    await advance(400);
    expect(timeout.mock.calls.some(([, delay]) => delay === 50)).toBe(false);
  });

  it("cancels a pending reveal when its message consumer unmounts", async () => {
    const wrapper = await render("x".repeat(500));
    const timerIndex = timeout.mock.calls.findLastIndex(
      ([, delay]) => delay === 50,
    );
    expect(timerIndex).toBeGreaterThanOrEqual(0);
    const timer = timeout.mock.results[timerIndex]?.value;
    wrapper.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    timeout.mockClear();
    await advance(400);
    expect(timeout.mock.calls.some(([, delay]) => delay === 50)).toBe(false);
  });

  it("renders a streaming fence as plain code and hands it to the settled renderer on completion", async () => {
    const wrapper = await render("`inline`\n\n```ts\nconst x = 1;\n```");
    const block = wrapper.get('[data-streaming-code-block="true"]');
    expect(block.attributes("data-language")).toBe("ts");
    expect(block.get("pre").classes()).toEqual(
      expect.arrayContaining(["font-mono", "text-xs", "overflow-x-auto"]),
    );
    expect(block.get("code").text()).toBe("const x = 1;");
    expect(block.find("button, [data-streamdown]").exists()).toBe(false);
    expect(
      wrapper.get('[data-streaming-inline-code="true"]').classes(),
    ).toContain("text-sm");
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    expect(wrapper.find("[data-streaming-code-block]").exists()).toBe(false);
    expect(
      wrapper.get('[data-streamdown="code-block"]').attributes("data-language"),
    ).toBe("ts");
    expect(
      wrapper.find('[data-streamdown="code-block-copy-button"]').exists(),
    ).toBe(true);
  });

  it("does not add a language header for an unlabelled fence or eagerly render a streaming mermaid diagram", async () => {
    const wrapper = await render("```\nplain\n```");
    const block = wrapper.get("[data-streaming-code-block]");
    expect(block.attributes("data-language")).toBe("");
    expect(block.find("span").exists()).toBe(false);
    await wrapper.setProps({ content: "```mermaid\ngraph TD; A-->B\n```" });
    expect(
      wrapper.get("[data-streaming-code-block]").attributes("data-language"),
    ).toBe("mermaid");
    expect(wrapper.find('[data-streamdown="mermaid-block"]').exists()).toBe(
      false,
    );
  });

  it("keeps explicit caller pre and code overrides ahead of streaming defaults through handoff", async () => {
    const pre = markRaw(
      defineComponent({
        inheritAttrs: false,
        setup(_, { slots }) {
          return () => h("pre", { "data-caller-pre": "" }, slots.default?.());
        },
      }),
    );
    const code = markRaw(
      defineComponent({
        inheritAttrs: false,
        setup(_, { slots }) {
          return () => h("code", { "data-caller-code": "" }, slots.default?.());
        },
      }),
    );
    const wrapper = await render("`inline`\n\n```ts\nsource\n```", true, {
      pre,
      code,
    });
    expect(wrapper.findAll("[data-caller-code]")).toHaveLength(2);
    expect(wrapper.get("[data-caller-pre]").text()).toBe("source");
    expect(wrapper.find("[data-streaming-code-block]").exists()).toBe(false);
    await wrapper.setProps({ streaming: false });
    expect(wrapper.findAll("[data-caller-code]")).toHaveLength(2);
    expect(wrapper.get("[data-caller-pre]").text()).toBe("source");
  });

  it("uses streaming defaults for nullish overrides and leaves settled long content immediate", async () => {
    const stream = await render("```ts\nsource\n```", true, {
      pre: undefined,
      code: null,
    });
    expect(stream.get("[data-streaming-code-block] code").text()).toBe(
      "source",
    );
    const completed = await render("z".repeat(200), false);
    expect(completed.text()).toBe("z".repeat(200));
    expect(completed.find("[data-md-word]").exists()).toBe(false);
  });
});
