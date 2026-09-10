/*
  【文件职责】     固定表格产物预览的可见行为：字面量渲染、分页、诚实的样本标注、
                   长单元格外置、失败态、以及换文件时的状态重置。
  【架构位置】     测试
  【依赖关系】     ArtifactTablePreview · useDelimitedPreview（本文件替身）
  【边界与注意】   解析器和调度层各有自己的用例，这里只管**画出来的东西**，
                   所以把 composable 换成可控替身，用它喂各种解析结果。

                   「换文件重置表头/翻页」这条在 React 那边是靠 `key={identity}`
                   整体重挂载顺带做掉的，本仓是显式 watch——它是本仓自己的实现，
                   必须自己有用例守着。
*/

import { mount } from "@vue/test-utils";
import type { Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DelimitedPreviewResult } from "@/core/artifacts/delimited-preview-types";

interface PreviewStore {
  result: Ref<DelimitedPreviewResult | undefined>;
  status: Ref<"loading" | "ready" | "error">;
  retry: ReturnType<typeof vi.fn>;
}

// vi.hoisted 跑在所有 import 之前，那时候还拿不到 vue；refs 只能在
// mock 工厂（懒执行）里建，再挂回这个容器上让用例改。
const holder = vi.hoisted(() => ({
  store: undefined as PreviewStore | undefined,
}));

vi.mock("@/composables/useDelimitedPreview", async () => {
  const { ref } = await import("vue");
  const store: PreviewStore = {
    result: ref(undefined),
    status: ref("ready"),
    retry: vi.fn(),
  };
  holder.store = store;
  return { useDelimitedPreview: () => store };
});

import ArtifactTablePreview from "@/components/workspace/artifacts/ArtifactTablePreview.vue";

const state = () => holder.store!;

function render(props: Record<string, unknown> = {}) {
  return mount(ArtifactTablePreview, {
    attachTo: document.body,
    props: {
      content: "fixture",
      delimiter: ",",
      truncated: false,
      identity: "file-1",
      ...props,
    },
  });
}

const byLabel = (label: string) =>
  document.body.querySelector<HTMLElement>(`[aria-label="${label}"]`);

beforeEach(() => {
  state().status.value = "ready";
  state().retry.mockClear();
  state().result.value = {
    rows: [
      ["ID", "Note"],
      ["00123", "<script>alert(1)</script>"],
    ],
    columnCount: 2,
    limited: false,
    unevenRows: false,
  };
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("ArtifactTablePreview", () => {
  it("原样渲染数据，且首行可以退回成数据行", async () => {
    const wrapper = render();
    const headers = wrapper.findAll("thead th").map((th) => th.text());
    expect(headers).toEqual(["#", "ID", "Note"]);
    // 前导零不能被当成数字吃掉。
    expect(wrapper.text()).toContain("00123");
    // 单元格内容是文本，不是标签。
    expect(wrapper.element.querySelector("script")).toBeNull();
    expect(wrapper.text()).toContain("<script>alert(1)</script>");

    await wrapper.find('input[type="checkbox"]').setValue(false);
    const relabeled = wrapper.findAll("thead th").map((th) => th.text());
    expect(relabeled).toEqual(["#", "Column 1", "Column 2"]);
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.find("tbody tr").text()).toContain("ID");
  });

  it("本地翻页，并如实说明这是有界样本", async () => {
    state().result.value = {
      rows: [
        ["ID", "Note"],
        ...Array.from({ length: 202 }, (_, i) => [String(i + 1), "note"]),
      ],
      columnCount: 2,
      limited: false,
      unevenRows: false,
    };
    const wrapper = render();
    // 样本被 200 行上限截过，就不能说成「共 N 行」。
    expect(wrapper.text()).toContain("Preview of first 200 rows");
    expect(wrapper.text()).toContain("1–50 of preview");

    await byLabel("Next page")!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("51–100 of preview");
    const firstCell = wrapper.find("tbody tr th").text();
    expect(firstCell).toBe("51");
  });

  it("列数超上限和行宽不齐都会明说", () => {
    state().result.value = {
      rows: [["ID", "Note"], ["1"]],
      columnCount: 80,
      limited: false,
      unevenRows: true,
    };
    const wrapper = render();
    expect(wrapper.text()).toContain("Showing the first 50 columns");
    expect(wrapper.text()).toContain("Some rows have different numbers");
    // 缺失字段要标出来，而不是留一个看不出区别的空格。
    expect(wrapper.text()).toContain("Missing");
    expect(wrapper.findAll("thead th")).toHaveLength(51);
  });

  it("长单元格收进对话框，不撑高整行", async () => {
    const longText = "first line\n" + "x".repeat(200);
    state().result.value = {
      rows: [
        ["ID", "Note"],
        ["00123", longText],
      ],
      columnCount: 2,
      limited: false,
      unevenRows: false,
    };
    const wrapper = render();
    // 表格里只放得下截断的一段。
    expect(wrapper.text()).not.toContain(longText);

    await byLabel("View cell: row 1, column 2")!.click();
    await wrapper.vm.$nextTick();
    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Cell value"]',
    );
    expect(textarea?.value).toBe(longText);
  });

  it("解析失败时不画旧数据，只给一次显式重试", async () => {
    state().status.value = "error";
    const wrapper = render();
    expect(wrapper.find("table").exists()).toBe(false);
    expect(wrapper.text()).toContain("Unable to preview this table reliably");

    const retry = wrapper
      .findAll("button")
      .find((button) => button.text() === "Retry preview");
    await retry!.trigger("click");
    expect(state().retry).toHaveBeenCalled();
  });

  it("空文件和「一条完整记录都放不下」是两句话", async () => {
    // 具名放一份：`result` 是可空的，直接展开它会把每个字段变成可选。
    const empty = {
      rows: [] as string[][],
      columnCount: 0,
      limited: false,
      unevenRows: false,
    };
    state().result.value = empty;
    const wrapper = render();
    expect(wrapper.text()).toContain("This file is empty.");

    state().result.value = { ...empty, limited: true };
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("No complete records fit in this preview");
  });

  it("换文件重置表头选择和翻页；只改内容只重置翻页", async () => {
    state().result.value = {
      rows: [
        ["ID", "Note"],
        ...Array.from({ length: 120 }, (_, i) => [String(i + 1), "note"]),
      ],
      columnCount: 2,
      limited: false,
      unevenRows: false,
    };
    const wrapper = render();
    await wrapper.find('input[type="checkbox"]').setValue(false);
    await byLabel("Next page")!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("51–100");
    expect(wrapper.findAll("thead th")[1]!.text()).toBe("Column 1");

    // 只改内容（草稿编辑）：回到第一页，但表头是用户的选择，留着。
    await wrapper.setProps({ content: "edited" });
    expect(wrapper.text()).toContain("1–50");
    expect(wrapper.findAll("thead th")[1]!.text()).toBe("Column 1");

    // 换文件：两样都回到默认。
    await wrapper.setProps({ identity: "file-2" });
    expect(wrapper.text()).toContain("1–50");
    expect(wrapper.findAll("thead th")[1]!.text()).toBe("ID");
  });

  it("面板收起时整块隐藏", async () => {
    const wrapper = render({ active: false });
    expect(
      wrapper
        .find('[data-testid="artifact-table-preview"]')
        .attributes("hidden"),
    ).toBeDefined();
    await wrapper.setProps({ active: true });
    expect(
      wrapper
        .find('[data-testid="artifact-table-preview"]')
        .attributes("hidden"),
    ).toBeUndefined();
  });
});
