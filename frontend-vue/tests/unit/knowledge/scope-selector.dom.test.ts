import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KnowledgeScopeSelector from "@/components/workspace/KnowledgeScopeSelector.vue";
import { fetch } from "@/core/api/fetcher";
import type { KnowledgeScopeSelection } from "@/core/knowledge";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
let wrapper: VueWrapper;
let client: QueryClient;
const body = () => new DOMWrapper(document.body);
const response = (items: unknown[], total = items.length) =>
  Response.json({ items, page: 1, page_size: 100, total });
const selected: KnowledgeScopeSelection = {
  mode: "selected",
  datasets: [{ id: "base", name: "Policies", documents: { mode: "all" } }],
};
function button(label: string) {
  const element = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === label,
  );
  if (!element) throw new Error(`Missing button ${label}`);
  return new DOMWrapper(element);
}
function render(
  selection: KnowledgeScopeSelection,
  extra: Record<string, unknown> = {},
) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  wrapper = mount(KnowledgeScopeSelector, {
    attachTo: document.body,
    props: { agentName: "researcher", selection, ...extra },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  });
  return wrapper;
}
beforeEach(() => {
  vi.mocked(fetch).mockReset();
});
afterEach(() => {
  wrapper?.unmount();
  client?.clear();
  document.body.innerHTML = "";
});

describe("knowledge scope selection", () => {
  it("exposes its dialog relationship and returns focus after closing", async () => {
    render({ mode: "all" });
    const trigger = wrapper.get('[data-testid="knowledge-scope-trigger"]');
    expect(trigger.attributes("aria-haspopup")).toBe("dialog");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    (trigger.element as HTMLButtonElement).focus();
    await trigger.trigger("click");
    await flushPromises();
    const dialog = body().get('[role="dialog"]');
    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(trigger.attributes("aria-controls")).toBe(dialog.attributes("id"));
    await button("Cancel").trigger("click");
    await vi.waitFor(() => {
      expect(body().find('[role="dialog"]').exists()).toBe(false);
      expect(document.activeElement).toBe(trigger.element);
    });
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });
  it.each(["all", "disabled"] as const)(
    "keeps the %s trigger icon-only and does not discover before opening",
    (mode) => {
      render({ mode });
      const trigger = wrapper.get('[data-testid="knowledge-scope-trigger"]');
      expect(trigger.text()).toBe("");
      expect(trigger.attributes("aria-pressed")).toBe(String(mode === "all"));
      expect(trigger.find("svg").exists()).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("does not fetch a forbidden assistant catalog", async () => {
    render(selected, { unavailableReason: "Assistant has no knowledge tool" });
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("loads document pages only after explicit selected-files mode, preserves drafts until Apply and excludes unselectable entries", async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      String(input).includes("/documents?")
        ? response([
            { id: "doc", name: "Guide.pdf", selectable: true },
            { id: "blocked", name: "Unparsed.pdf", selectable: false },
          ])
        : response([
            { id: "base", name: "Policies", selectable: true },
            { id: "empty", name: "Empty base", selectable: false },
          ]),
    );
    render(selected);
    await wrapper
      .get('[data-testid="knowledge-scope-trigger"]')
      .trigger("click");
    await flushPromises();
    expect(
      body().get('input[aria-label="Empty base"]').attributes("disabled"),
    ).toBeDefined();
    await button("Files").trigger("click");
    await flushPromises();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
    const radios = body().findAll('input[name="documents-base"]');
    await radios[1]!.setValue(true);
    await flushPromises();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
    expect(
      body().get('input[aria-label="Unparsed.pdf"]').attributes("disabled"),
    ).toBeDefined();
    expect(button("Apply").attributes("disabled")).toBeDefined();
    await body().get('input[aria-label="Guide.pdf"]').setValue(true);
    expect(wrapper.emitted("change")).toBeUndefined();
    await button("Apply").trigger("click");
    expect(wrapper.emitted("change")?.[0]?.[0]).toMatchObject({
      mode: "selected",
      datasets: [
        {
          id: "base",
          documents: {
            mode: "selected",
            items: [{ id: "doc", name: "Guide.pdf" }],
          },
        },
      ],
    });
    expect(selected).toEqual({
      mode: "selected",
      datasets: [{ id: "base", name: "Policies", documents: { mode: "all" } }],
    });
  });
  it("keeps selected items across dataset search pages and resets page on changed search", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = new URL(String(input), "https://deerflow.test");
      return response(
        [
          {
            id: url.searchParams.get("page") === "2" ? "next" : "base",
            name: "Policies",
            selectable: true,
          },
        ],
        201,
      );
    });
    render(selected);
    await wrapper
      .get('[data-testid="knowledge-scope-trigger"]')
      .trigger("click");
    await flushPromises();
    await button("Next").trigger("click");
    await flushPromises();
    expect(String(vi.mocked(fetch).mock.calls.at(-1)![0])).toContain("page=2");
    await body()
      .get('input[placeholder="Search knowledge bases"]')
      .setValue("policy");
    await flushPromises();
    expect(String(vi.mocked(fetch).mock.calls.at(-1)![0])).toContain("page=1");
    expect(String(vi.mocked(fetch).mock.calls.at(-1)![0])).toContain(
      "search=policy",
    );
    await button("Apply").trigger("click");
    expect(wrapper.emitted("change")?.[0]?.[0]).toEqual(selected);
  });
  it.each([409, 503])(
    "keeps %s as a visible catalog failure with no implicit retry",
    async (status) => {
      vi.mocked(fetch).mockResolvedValue(
        Response.json({ detail: "Unavailable" }, { status }),
      );
      render(selected);
      await wrapper
        .get('[data-testid="knowledge-scope-trigger"]')
        .trigger("click");
      await flushPromises();
      expect(body().text()).toContain(
        "The catalog could not be loaded. Your current selection is unchanged.",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(wrapper.emitted("change")).toBeUndefined();
    },
  );
});
