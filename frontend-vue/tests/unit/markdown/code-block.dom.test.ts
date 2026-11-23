/*
  【文件职责】     代码块槽位的首帧 DOM 对照与高亮行为验收。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     tests/fixtures/react-markdown-dom.json · app/components/markdown/*
  【边界与注意】   这里比的是**首帧**：shiki 的高亮是异步的，上游 SSR 拿到的同样是未高亮的
                   回退结构，两边在这一帧上可以逐属性对齐。高亮之后的 token DOM 不在
                   夹具里（SSR 录不到），所以只做行为断言——这一条写进证据文档的红项。

                   代码块与 mermaid 是本层唯二复刻的 streamdown 槽位，理由见
                   `app/components/markdown/components.ts`：它们是行为不是样式。
                   mermaid 在 `mermaid.dom.test.ts`——它要在模块级 mock 掉 mermaid 包，
                   和这里的真实 shiki 加载放同一个文件会互相干扰。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import CodeBlock from "@/components/markdown/CodeBlock.vue";
import { richContentComponents } from "@/components/markdown/components";
import { appRemarkPlugins } from "@/core/markdown/plugins";

import fixture from "../../fixtures/react-markdown-dom.json";
import {
  normalizeChildren,
  normalizeHtml,
  type NormalizedNode,
} from "../../support/dom-equivalence";

const entries = fixture.entries as unknown as Record<
  string,
  { styledHtml: string }
>;

const PIPELINE = {
  remarkPlugins: appRemarkPlugins,
  rehypePlugins: [], // 消息路径的同步 rehype 链现在是空的：KaTeX 由 core/markdown/math.ts 按内容加载。
  components: richContentComponents as unknown as Record<string, unknown>,
};

/**
 * 等到 shiki 真的高亮完。
 *
 * ⚠️ **一次 `flushPromises()` 不够**，这是实测数字：shiki 的 `codeToTokens` 内部还要
 * 按需动态 import 语法与主题，每个都是独立的模块加载。实测第 1 轮与第 5 轮拿到的都还是
 * 未高亮的回退结构（每行 1 个 token span），到第 20 轮才变成 11 个。
 * 等不够的后果不是红，是**假绿**——组件失败时静默回退，文本一样在。
 */
async function settle(wrapper: { vm: unknown }): Promise<void> {
  void wrapper;
  for (let round = 0; round < 40; round += 1) {
    await flushPromises();
  }
}

/** 在归一化树里找第一个带指定 data-streamdown 槽位名的元素。 */
function findSlot(
  nodes: NormalizedNode[],
  slot: string,
): NormalizedNode | undefined {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (node.attributes["data-streamdown"] === slot) return node;
    const hit = findSlot(node.children, slot);
    if (hit) return hit;
  }
  return undefined;
}

describe("代码块槽位 · 首帧 DOM 与上游一致", () => {
  for (const suffix of ["\n", "\n\n\n"]) {
    it(`fallback and real highlighting omit terminal newlines (${suffix.length}) while preserving interior blank lines`, async () => {
      const code = `const first = 1;\n\nconst last = 2;${suffix}`;
      const wrapper = mount(CodeBlock, {
        props: { code, language: "ts" },
      });
      const rows = () =>
        wrapper.findAll('[data-streamdown="code-block-body"] code > span');
      expect(rows()).toHaveLength(3);
      await vi.waitFor(() => {
        expect(
          wrapper
            .find('[data-streamdown="code-block-body"] code span span')
            .attributes("style"),
        ).toMatch(/--sdm-c:\s*#[0-9a-f]{6}/i);
      });
      expect(rows()).toHaveLength(3);
      expect(rows()[1]?.text()).toBe("");
      expect(rows()[2]?.text()).toBe("const last = 2;");
      expect(wrapper.props("code")).toBe(code);
      const clipboard = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue();
      const createURL = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:raw-code");
      const anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
      try {
        await wrapper
          .find('[data-streamdown="code-block-copy-button"]')
          .trigger("click");
        expect(clipboard).toHaveBeenCalledExactlyOnceWith(code);
        await wrapper
          .find('[data-streamdown="code-block-download-button"]')
          .trigger("click");
        expect(createURL).toHaveBeenCalledTimes(1);
        expect(await (createURL.mock.calls[0]![0] as Blob).text()).toBe(code);
        expect(anchorClick).toHaveBeenCalledTimes(1);
      } finally {
        clipboard.mockRestore();
        createURL.mockRestore();
        anchorClick.mockRestore();
      }
      wrapper.unmount();
    });
  }

  for (const [id, language] of [
    ["code-block", "ts"],
    ["code-block-no-language", ""],
  ] as const) {
    it(`${id}（language=${JSON.stringify(language)}）`, () => {
      const markdown =
        language === "ts"
          ? "```ts\nconst x: number = 1;\n```"
          : "```\nplain text\n```";
      const wrapper = mount(StreamMarkdown, {
        props: { content: markdown, ...PIPELINE },
      });

      const expected = findSlot(
        normalizeHtml(entries[id]!.styledHtml),
        "code-block",
      );
      const actual = findSlot(normalizeChildren(wrapper.element), "code-block");

      expect(expected).toBeDefined();
      expect(actual).toEqual(expected);
      wrapper.unmount();
    });
  }

  it("真的高亮了（不是静默回退到未高亮结构）", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: { content: "```ts\nconst x: number = 1;\n```", ...PIPELINE },
    });
    await vi.waitFor(
      () => {
        expect(
          wrapper.findAll('[data-streamdown="code-block-body"] code span span')
            .length,
        ).toBeGreaterThan(1);
      },
      { timeout: 5_000 },
    );

    const tokens = wrapper.findAll(
      '[data-streamdown="code-block-body"] code span span',
    );
    // ⚠️ 这条断言的形状是被实测逼出来的。原来只断言「文本还在」——
    // 而 shiki 失败时组件是**静默回退**到未高亮结构，文本一样还在，用例照样绿。
    // 实测：回退结构是每行 1 个 token span，真高亮是 11 个。
    expect(tokens.length).toBeGreaterThan(1);
    // 颜色变量真的落到了 style 上，不是占位的 inherit。
    expect(tokens[0]?.attributes("style")).toMatch(/--sdm-c:\s*#[0-9a-f]{6}/i);
    expect(tokens[0]?.attributes("style")).toMatch(
      /--shiki-dark:\s*#[0-9a-f]{6}/i,
    );
    expect(
      wrapper.find('[data-streamdown="code-block-body"]').text(),
    ).toContain("const x: number = 1;");
    wrapper.unmount();
  });

  it("不认识的语言退回未高亮结构，不让代码块消失", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "```not-a-real-language\nx := 1\n```",
        ...PIPELINE,
      },
    });
    await settle(wrapper);
    // 回退的形状：每行只有一个 token span，颜色是占位的 inherit。
    const tokens = wrapper.findAll(
      '[data-streamdown="code-block-body"] code span span',
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.attributes("style")).toContain("inherit");
    expect(
      wrapper.find('[data-streamdown="code-block-body"]').text(),
    ).toContain("x := 1");
    wrapper.unmount();
  });
});
