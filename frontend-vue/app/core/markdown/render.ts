/*
  【文件职责】     hast → Vue vnode，以及逐词动画所需的稳定 key 注入。
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     renderHast · applyWordAnimation · VUE_JSX_OPTIONS
  【依赖关系】     hast-util-to-jsx-runtime · vue/jsx-runtime · ./animate
  【边界与注意】   两个选项是 Vue 侧的硬性要求，不是口味：

                   - `elementAttributeNameCase: "html"` —— 库 readme 的 "Example: Vue" 明写。
                     ⚠️ 连带影响：**组件覆盖拿到的 prop 是 `class` 不是 `className`**
                     （05 M3）。components map 里每个覆盖都要按 `class` 写。
                   - `stylePropertyNameCase: "css"` —— 取 `css` 而不是默认的 `dom`。
                     Vue 的 style 绑定认 kebab-case；给它 `fontSize` 这样的驼峰键，
                     Vue 会原样当自定义属性写出去。

                   `passNode` 保持开启且**只对函数组件生效**（库内部按 `typeof type !== 'string'`
                   判断），所以它不会给内建标签写出一个 `node="[object Object]"` 属性。

                   ── 逐词动画为什么落在这一层 ──

                   05 M4 与 frontend/AGENTS.md 都禁止用 per-word rehype 插件：那样做时
                   key 由 `hast-util-to-jsx-runtime` 按「同名兄弟计数」生成（`span-0`
                   `span-1` …），块内结构一变，已渲染过的词就换 key、重挂载、重播动画。

                   这里的做法是：切词发生在**渲染器边界**（`applyWordAnimation` 是普通函数，
                   不进 unified 管线），并且用一层 `jsx` 包装把 key **强制**改成
                   `w{绝对字符偏移}`。偏移只增不改，所以 key 与兄弟计数无关——
                   这正是「不要用 rehype 插件」那条铁律真正要的东西。
*/

import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "vue/jsx-runtime";

import { splitAnimatedWords } from "./animate";

import type { Element, ElementContent, Nodes, Root } from "hast";
import type { VNode } from "vue";

/** 词段元素带上的属性名；`jsx` 包装靠它认出「这是一个词」。 */
const WORD_OFFSET_ATTRIBUTE = "data-md-word";

/** 这些子树里的文本不切词：代码要保持原样，KaTeX 的结构不能塞东西进去。 */
const ANIMATION_OPAQUE_TAGS = new Set(["pre", "code", "script", "style"]);

function isKatexSubtree(node: Element): boolean {
  const className = node.properties?.className;
  const names = Array.isArray(className) ? className : [className];
  return names.some(
    (name) => typeof name === "string" && name.startsWith("katex"),
  );
}

export interface WordAnimationOptions {
  /** 上一帧已渲染到第几个字符；`0` 表示首帧，一律不播动画。 */
  revealedLength: number;
  /** 新词的入场 class。 */
  newWordClass: string;
  /** 已经在屏幕上的词的 class（通常为空串）。 */
  settledWordClass?: string;
}

export interface WordAnimationResult {
  tree: Root;
  /** 本次切到的总字符数——调用方把它存下来当下一帧的 `revealedLength`。 */
  renderedLength: number;
}

/**
 * 把树里的文本节点换成带稳定 key 的词段元素。
 *
 * **返回新树，不改原树**：原树可能来自处理器缓存或被上层记忆化，就地改会让
 * 第二次渲染拿到已经切过词的树，词再被切一次。
 */
export function applyWordAnimation(
  tree: Root,
  options: WordAnimationOptions,
): WordAnimationResult {
  let offset = 0;

  const walkChildren = (
    children: readonly ElementContent[],
    opaque: boolean,
  ): ElementContent[] => {
    const output: ElementContent[] = [];
    for (const child of children) {
      if (child.type === "text") {
        if (opaque) {
          offset += child.value.length;
          output.push(child);
          continue;
        }
        const words = splitAnimatedWords(
          child.value,
          offset,
          options.revealedLength,
        );
        offset += child.value.length;
        for (const word of words) {
          output.push({
            type: "element",
            tagName: "span",
            properties: {
              [WORD_OFFSET_ATTRIBUTE]: String(word.offset),
              // hast 的 className 是数组；给空串会渲染出一个多余的 `class=""`。
              className: [
                word.isNew
                  ? options.newWordClass
                  : (options.settledWordClass ?? ""),
              ].filter(Boolean),
            },
            children: [{ type: "text", value: word.text }],
          });
        }
        continue;
      }
      if (child.type === "element") {
        output.push({
          ...child,
          children: walkChildren(
            child.children,
            opaque ||
              ANIMATION_OPAQUE_TAGS.has(child.tagName) ||
              isKatexSubtree(child),
          ),
        });
        continue;
      }
      output.push(child);
    }
    return output;
  };

  const next: Root = {
    ...tree,
    children: walkChildren(tree.children as ElementContent[], false),
  };
  return { tree: next, renderedLength: offset };
}

/**
 * `jsx` / `jsxs` 包装：认出词段元素并把 key 换成绝对偏移。
 *
 * 库自己生成的 key 是「同名兄弟第几个」，块内结构一变就漂；偏移不漂。
 */
function withStableWordKeys(
  create: (
    type: unknown,
    props: Record<string, unknown>,
    key?: string,
  ) => VNode,
) {
  return (type: unknown, props: Record<string, unknown>, key?: string) => {
    // Vue 的 Fragment 要求 children 是数组，React 的不要求。
    // 只有一个文本子节点时 `toJsxRuntime` 会直接给字符串——Vue 会当成数组去写下标，
    // 抛 "Cannot assign to read only property '0' of string"。实测触发条件是
    // 「整块只有一个裸文本节点」（例如被转义的 raw HTML 单独成块）。
    const children =
      type === Fragment &&
      props.children !== undefined &&
      !Array.isArray(props.children)
        ? [props.children]
        : props.children;
    // HAST supplies children eagerly; Vue components consume function slots.
    // Keep native elements and Fragments on their normal children path.
    const isComponent =
      typeof type === "function" || (typeof type === "object" && type !== null);
    const normalized = {
      ...props,
      children:
        isComponent && children !== undefined
          ? { default: () => children }
          : children,
    };
    const offset = props[WORD_OFFSET_ATTRIBUTE];
    return create(
      type,
      normalized,
      typeof offset === "string" ? `w${offset}` : key,
    );
  };
}

type JsxFn = (
  type: unknown,
  props: Record<string, unknown>,
  key?: string,
) => VNode;

/** 两个大小写选项是 Vue 侧硬性要求，见文件头。 */
export const VUE_JSX_OPTIONS = {
  Fragment: Fragment as unknown as never,
  jsx: withStableWordKeys(jsx as unknown as JsxFn) as never,
  jsxs: withStableWordKeys(jsxs as unknown as JsxFn) as never,
  elementAttributeNameCase: "html",
  stylePropertyNameCase: "css",
  ignoreInvalidStyle: true,
  passKeys: true,
  passNode: true,
} as const;

export interface RenderHastOptions {
  /** 元素覆盖表。⚠️ 覆盖组件收到的是 `class`，不是 `className`。 */
  components?: Record<string, unknown>;
}

/** hast → Vue vnode。 */
export function renderHast(
  tree: Nodes,
  options: RenderHastOptions = {},
): VNode {
  return toJsxRuntime(tree, {
    ...VUE_JSX_OPTIONS,
    components: options.components as never,
  }) as unknown as VNode;
}
