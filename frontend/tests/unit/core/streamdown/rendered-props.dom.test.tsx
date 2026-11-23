import { afterEach, beforeEach, expect, it } from "@rstest/core";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { CustomRendererProps } from "streamdown";

import { ClipboardSafeStreamdown } from "@/components/ai-elements/streamdown";
import { I18nProvider } from "@/core/i18n/context";
import { toStreamdownComponents } from "@/core/streamdown/components";

beforeEach(() => {
  document.cookie = "locale=en-US; path=/";
});
afterEach(cleanup);

function content(
  markdown: string,
  props: Partial<ComponentProps<typeof ClipboardSafeStreamdown>> = {},
) {
  return (
    <I18nProvider initialLocale="en-US">
      <ClipboardSafeStreamdown mode="static" {...props}>
        {markdown}
      </ClipboardSafeStreamdown>
    </I18nProvider>
  );
}

for (const [name, source, selector] of [
  ["paragraph", "Sunny", "p"],
  ["heading", "# Sunny", "h1"],
  ["unordered item", "- Sunny", "li"],
  ["ordered item", "1. Sunny", "li"],
  ["blockquote", "> Sunny", "blockquote p"],
  ["strong", "**Sunny**", '[data-streamdown="strong"]'],
  ["emphasis", "*Sunny*", "em"],
  ["strikethrough", "~~Sunny~~", "del"],
  ["inline code", "`Sunny`", "code"],
  ["link label", "[Sunny](https://example.com)", '[data-streamdown="link"]'],
  ["table heading", "| Sunny |\n| --- |\n| Cloud |", "th"],
  ["table cell", "| Weather |\n| --- |\n| Sunny |", "td"],
] as const) {
  it(`updates equal-length ${name} text without replacing its DOM node`, async () => {
    const next = source.replace("Sunny", "Rainy");
    expect(next.length).toBe(source.length);
    const view = render(content(source));
    const node = view.container.querySelector(selector)!;
    expect(node.textContent).toBe("Sunny");
    view.rerender(content(next));
    await waitFor(() => expect(node.textContent).toBe("Rainy"));
    expect(view.container.querySelector(selector)).toBe(node);
  });
}

for (const [name, before, after, selector, attribute, expected] of [
  [
    "link destination",
    "[Weather](https://example.com/sunny)",
    "[Weather](https://example.com/rainy)",
    "a",
    "href",
    "https://example.com/rainy",
  ],
  [
    "link title",
    '[Weather](https://example.com "Sunny")',
    '[Weather](https://example.com "Rainy")',
    "a",
    "title",
    "Rainy",
  ],
  [
    "image description",
    "![Sunny](https://example.com/map.png)",
    "![Rainy](https://example.com/map.png)",
    "img",
    "alt",
    "Rainy",
  ],
  ["ordered list start", "1. Weather", "9. Weather", "ol", "start", "9"],
] as const) {
  it(`updates equal-length ${name} without replacing the element`, async () => {
    expect(after.length).toBe(before.length);
    // The public linkSafety=false mode renders native anchors; the default
    // safety button deliberately has no href/title attributes.
    const props = name.startsWith("link")
      ? { linkSafety: { enabled: false } }
      : {};
    const view = render(content(before, props));
    const node = view.container.querySelector(selector)!;
    expect(node).not.toBeNull();
    expect(node.getAttribute(attribute)).not.toBe(expected);
    view.rerender(content(after, props));
    await waitFor(() => expect(node.getAttribute(attribute)).toBe(expected));
    expect(view.container.querySelector(selector)).toBe(node);
  });
}

it("delivers changed code-fence metadata through the real public renderer contract", async () => {
  const Probe = ({ code, meta }: CustomRendererProps) => (
    <pre data-testid="meta-consumer" data-meta={meta}>
      {code}
    </pre>
  );
  const plugins = { renderers: [{ language: "probe", component: Probe }] };
  const before = "```probe startLine=10\nunchanged code\n```";
  const after = before.replace("startLine=10", "startLine=20");
  const view = render(content(before, { plugins }));
  const node = await view.findByTestId("meta-consumer");
  expect(node.getAttribute("data-meta")).toBe("startLine=10");
  view.rerender(content(after, { plugins }));
  await waitFor(() =>
    expect(node.getAttribute("data-meta")).toBe("startLine=20"),
  );
  expect(view.getByTestId("meta-consumer")).toBe(node);
  expect(node.textContent).toContain("unchanged code");
});

for (const animated of [false, true]) {
  it(`keeps unchanged earlier streaming blocks memoized with animation=${animated}`, async () => {
    let stableRenders = 0;
    const StableStrong = ({ children }: ComponentProps<"strong">) => {
      stableRenders += 1;
      return <strong>{children}</strong>;
    };
    const props = {
      components: toStreamdownComponents({ strong: StableStrong }),
      mode: "streaming" as const,
      isAnimating: true,
      animated,
    };
    // Static mode parses the whole document as one tree. Only streaming mode
    // owns the upper block cache whose render-skip contract is under test.
    const view = render(content("**Stable**\n\nGrowing", props));
    const node = view.container.querySelector("strong");
    expect(stableRenders).toBe(1);
    view.rerender(content("**Stable**\n\nGrowing answer", props));
    await waitFor(() =>
      expect(view.container.textContent).toContain("Growing answer"),
    );
    expect(view.container.querySelector("strong")).toBe(node);
    expect(stableRenders).toBe(1);
  });
}
