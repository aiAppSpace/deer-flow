/** Message-only streaming code presentation, before the settled rich renderer. */
import {
  computed,
  defineComponent,
  h,
  inject,
  markRaw,
  provide,
  type PropType,
} from "vue";

import { cn } from "@/lib/utils";

import type { Element } from "hast";

const streamingCodeBlock = Symbol("message-streaming-code-block");

export const MessageStreamingPre = markRaw(
  defineComponent({
    name: "MessageStreamingPre",
    inheritAttrs: false,
    props: { node: { type: Object as PropType<Element>, default: undefined } },
    setup(props, { slots }) {
      provide(streamingCodeBlock, true);
      const language = computed(() => {
        const code = props.node?.children.find(
          (child): child is Element =>
            child.type === "element" && child.tagName === "code",
        );
        const raw = code?.properties.className;
        const names = Array.isArray(raw) ? raw.join(" ") : String(raw ?? "");
        return /(?:^|\s)language-([^\s]+)/.exec(names)?.[1] ?? "";
      });
      return () =>
        h(
          "div",
          {
            class: "my-4 w-full overflow-hidden rounded-xl border",
            "data-language": language.value,
            "data-streaming-code-block": "true",
          },
          [
            language.value
              ? h(
                  "div",
                  {
                    class: "bg-muted/80 text-muted-foreground p-3 text-xs",
                  },
                  h(
                    "span",
                    { class: "ml-1 font-mono lowercase" },
                    language.value,
                  ),
                )
              : null,
            h(
              "pre",
              {
                class:
                  "bg-muted/40 overflow-x-auto border-t p-4 font-mono text-xs",
              },
              slots.default?.(),
            ),
          ],
        );
    },
  }),
);

export const MessageStreamingCode = markRaw(
  defineComponent({
    name: "MessageStreamingCode",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const isBlock = inject(streamingCodeBlock, false);
      return () => {
        const { node: _node, class: incomingClass, ...rest } = attrs;
        void _node;
        return h(
          "code",
          {
            ...rest,
            class: isBlock
              ? incomingClass
              : cn(
                  "bg-muted rounded px-1.5 py-0.5 font-mono text-sm",
                  incomingClass as string | undefined,
                ),
            ...(isBlock ? {} : { "data-streaming-inline-code": "true" }),
          },
          slots.default?.(),
        );
      };
    },
  }),
);
