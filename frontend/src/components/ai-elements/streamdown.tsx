"use client";

import { Component, type ComponentProps, type ReactNode } from "react";
import { Streamdown } from "streamdown";

import { stripLeakedSystemTags } from "@/core/streamdown/preprocess";
import { installClipboardFallback } from "@/core/clipboard";
import { useI18n } from "@/core/i18n/hooks";

export type ClipboardSafeStreamdownProps = ComponentProps<typeof Streamdown>;

// Only patch browser globals in client context; skip during SSR
if (typeof document !== "undefined") {
  installClipboardFallback();
}

// marked (used by Streamdown to split content into blocks) has mutually
// recursive tokenizers — blockquote/list nesting a couple thousand levels
// deep overflows the call stack during render and would otherwise take down
// the whole route. When rendering a message throws, fall back to showing
// that message as plain pre-formatted text instead.
class StreamdownFallbackBoundary extends Component<
  { raw: ClipboardSafeStreamdownProps["children"]; children: ReactNode },
  { errored: boolean; prevRaw: ClipboardSafeStreamdownProps["children"] }
> {
  state = { errored: false, prevRaw: this.props.raw };

  static getDerivedStateFromError() {
    return { errored: true };
  }

  static getDerivedStateFromProps(
    props: { raw: ClipboardSafeStreamdownProps["children"] },
    state: {
      errored: boolean;
      prevRaw: ClipboardSafeStreamdownProps["children"];
    },
  ) {
    // Retry rendering when the content changes (e.g. the next streaming chunk).
    if (props.raw !== state.prevRaw) {
      return { errored: false, prevRaw: props.raw };
    }
    return null;
  }

  render() {
    if (this.state.errored) {
      return (
        <div className="break-words whitespace-pre-wrap">
          {typeof this.props.raw === "string" ? this.props.raw : null}
        </div>
      );
    }
    return this.props.children;
  }
}

export function ClipboardSafeStreamdown({
  children,
  translations,
  ...props
}: ClipboardSafeStreamdownProps) {
  const { t } = useI18n();
  // Strip leaked system-internal tags (<memory>, <system-reminder>, etc.)
  // that would cause React to log "unrecognized tag" console errors when
  // the markdown renderer passes them through as raw HTML.
  const sanitizedChildren =
    typeof children === "string" ? stripLeakedSystemTags(children) : children;

  return (
    <StreamdownFallbackBoundary raw={sanitizedChildren}>
      {/*
        Streamdown owns the visible controls on every message: the code-block
        copy button, the table copy/download menus, the mermaid toolbar and the
        external-link confirmation. It ships those strings in English and takes
        a `translations` prop, but nothing here was passing it — so the whole
        markdown surface stayed English under zh-CN. The dictionary's en-US
        values are streamdown 2.5.0's own defaults verbatim, so this is a no-op
        for the English build.

        Zoom in / Zoom out / Reset zoom and pan / the diagram's alt text are
        *not* in `StreamdownTranslations`; they are hardcoded inside the
        library and stay English until it exposes them.

        `close` is deliberately left out of the dictionary so streamdown keeps
        its own "Close": that is a dialog-primitive affordance, and this repo's
        rule for those is that both apps announce the same English string
        (see `primitives.*` in the Vue app's I18N_INVENTORY).
      */}
      <Streamdown translations={{ ...t.markdown, ...translations }} {...props}>
        {sanitizedChildren}
      </Streamdown>
    </StreamdownFallbackBoundary>
  );
}
