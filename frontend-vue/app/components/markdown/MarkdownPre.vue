<script lang="ts">
/*
  【文件职责】     `pre` 槽位的覆盖：把围栏代码块分派给代码块 UI 或 mermaid 图。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./CodeBlock.vue · ./MermaidDiagram.vue
  【边界与注意】   语言与源码从 **hast 节点**读，不从 vnode 子树读。
                   `renderHast` 开了 `passNode`，覆盖组件会拿到 `node` prop；
                   从 vnode 里反推需要判断 children 是字符串还是数组、是不是被动画切过词，
                   而这些形态在流式期间都会变。

                   ⚠️ prop 是 `class` **不是 `className`**（05 M3）。这是
                   `elementAttributeNameCase: "html"` 的连带影响，components map 里
                   每个覆盖都要按 `class` 写。这里虽然用不到 `class`，仍显式声明，
                   否则它会落进 attrs 被透传到根元素上，与上游 DOM 不一致。
*/
import { computed, defineComponent, h, type PropType } from "vue";

import MarkdownCodeBlock from "./CodeBlock.vue";
import MermaidDiagram from "./MermaidDiagram.vue";

import type { Element } from "hast";

/** 从 hast 元素里取纯文本。 */
function textOf(node: Element): string {
  return node.children
    .map((child) =>
      child.type === "text"
        ? child.value
        : child.type === "element"
          ? textOf(child)
          : "",
    )
    .join("");
}

function languageOf(node: Element | undefined): string {
  if (!node) return "";
  // hast 的 className 声明成 `string | number | boolean | (string|number)[] | null`，
  // 实际只会是数组或字符串。先摊平成字符串数组再找，省掉一串窄化分支。
  const raw: unknown = node.properties?.className;
  const names = (Array.isArray(raw) ? raw : [raw])
    .filter((name): name is string => typeof name === "string")
    .flatMap((name) => name.split(/\s+/));
  for (const name of names) {
    if (name.startsWith("language-")) return name.slice("language-".length);
  }
  return "";
}

export default defineComponent({
  name: "MarkdownPre",
  props: {
    node: { type: Object as PropType<Element>, default: undefined },
    /** ⚠️ `class`，不是 `className`——见文件头。 */
    class: { type: String, default: "" },
  },
  setup(props, { slots }) {
    const code = computed(() => {
      const child = props.node?.children.find(
        (candidate): candidate is Element =>
          candidate.type === "element" && candidate.tagName === "code",
      );
      return child
        ? { text: textOf(child), language: languageOf(child) }
        : null;
    });

    return () => {
      const value = code.value;
      // 拿不到 hast 节点（调用方没开 passNode）就退回原样渲染，不吞内容。
      if (!value) return h("pre", { class: props.class }, slots.default?.());
      if (value.language === "mermaid") {
        return h(MermaidDiagram, { code: value.text });
      }
      // Nuxt's h(Component) loader resolves registered names before local imports.
      // Keep this Markdown renderer distinct from the shadcn tool CodeBlock.
      return h(MarkdownCodeBlock, {
        code: value.text,
        language: value.language,
      });
    };
  },
});
</script>
