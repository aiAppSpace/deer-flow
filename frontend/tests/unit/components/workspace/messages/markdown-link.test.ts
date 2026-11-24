import { describe, expect, it } from "@rstest/core";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createMarkdownLinkComponent,
  isSafeHref,
  MessageArtifactPathsContext,
} from "@/components/workspace/messages/markdown-link";
import { I18nProvider } from "@/core/i18n/context";
import type { Locale } from "@/core/i18n/locale";
/*
 * These renderers now announce the blocked-link affordance through the
 * dictionary (`markdown.unsafeLink` / `unsafeLinkTitle`) instead of a
 * hardcoded English literal, so they need a provider. Rendering through
 * `I18nProvider` also lets the zh-CN cases below assert the localized
 * string, which is the whole point of moving it into the dictionary.
 */
function render(element: ReactElement, locale: Locale = "en-US") {
  /*
   * `I18nProvider` declares `children` as a required prop, but these are
   * `.ts` files so the provider has to be built with `createElement`, and
   * `react/no-children-prop` rejects passing `children` in the props bag.
   * Casting the props and passing the child positionally satisfies both.
   */
  const providerProps = {
    initialLocale: locale,
  } as ComponentProps<typeof I18nProvider>;
  return renderToStaticMarkup(
    createElement(I18nProvider, providerProps, element),
  );
}

describe("isSafeHref", () => {
  it("allows web URLs and same-origin paths", () => {
    expect(isSafeHref("https://example.com/path")).toBe(true);
    expect(isSafeHref("http://example.com/path")).toBe(true);
    expect(isSafeHref("/workspace/chats/1")).toBe(true);
    expect(isSafeHref("#section")).toBe(true);
  });

  it("allows scheme-less relative references", () => {
    expect(isSafeHref("report.md")).toBe(true);
    expect(isSafeHref("./report.md")).toBe(true);
    expect(isSafeHref("../assets/chart.png")).toBe(true);
  });

  it("allows non-executing contact schemes", () => {
    expect(isSafeHref("mailto:someone@example.com")).toBe(true);
    expect(isSafeHref("tel:+15551234567")).toBe(true);
  });

  it("rejects executable, local, and protocol-relative URLs", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("java\tscript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHref("file:///etc/passwd")).toBe(false);
    expect(isSafeHref("//example.com/path")).toBe(false);
    expect(isSafeHref("\\\\evil.com")).toBe(false);
    expect(isSafeHref(undefined)).toBe(false);
  });
});

// Render-level coverage: these tests exercise the component itself, so
// removing (or inverting) the isSafeHref guard inside MarkdownLink fails
// them even though isSafeHref stays untouched.
describe("MarkdownLink rendering", () => {
  const MarkdownLink = createMarkdownLinkComponent();

  it("renders an unsafe href as a disabled span, never an anchor", () => {
    const html = render(
      createElement(MarkdownLink, { href: "javascript:alert(1)" }, "click me"),
    );
    expect(html).not.toContain("<a");
    expect(html).toContain("<span");
    expect(html).toContain("click me");
    expect(html).not.toContain("href=");
    expect(html).toContain('aria-label="Unsafe link omitted"');
  });

  /*
   * The blocked-link affordance used to be a hardcoded English literal here,
   * so a zh-CN reader heard "Unsafe link omitted" while the Vue app announced
   * the translated string — the same control saying two different things in
   * the two apps. Both now read the dictionary; this case is what keeps it
   * that way (an English-literal regression makes it fail).
   */
  it("announces the blocked link through the dictionary, localized", () => {
    const zh = render(
      createElement(MarkdownLink, { href: "javascript:alert(1)" }, "click me"),
      "zh-CN",
    );
    expect(zh).toContain('aria-label="已省略不安全链接"');
    expect(zh).toContain("链接协议不安全：javascript:alert(1)");

    const en = render(
      createElement(MarkdownLink, { href: "javascript:alert(1)" }, "click me"),
    );
    expect(en).toContain('aria-label="Unsafe link omitted"');
    expect(en).toContain("Unsafe link scheme in javascript:alert(1)");
  });

  it("blocks unsafe hrefs before the citation branch", () => {
    const html = render(
      createElement(
        MarkdownLink,
        { href: "javascript:alert(1)" },
        "citation:evil",
      ),
    );
    expect(html).not.toContain("<a");
    expect(html).not.toContain("href=");
  });

  it("renders a safe https href as a hardened anchor", () => {
    const html = render(
      createElement(
        MarkdownLink,
        { href: "https://example.com/report" },
        "report",
      ),
    );
    expect(html).toContain("<a");
    expect(html).toContain('href="https://example.com/report"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders citation labels when children are React element arrays", () => {
    const html = render(
      createElement(
        MarkdownLink,
        { href: "https://example.com/report" },
        createElement("span", { key: "prefix" }, "citation:"),
        createElement("span", { key: "title" }, "Test Source"),
      ),
    );
    expect(html).not.toContain("citation:");
    expect(html).toContain("Test Source");
  });

  it("renders a scheme-less relative href as a navigable anchor", () => {
    const tests = ["report.md", "./report.md", "../assets/chart.png"];
    for (const href of tests) {
      const html = render(createElement(MarkdownLink, { href }, "doc"));
      expect(html).toContain("<a");
      expect(html).toContain(`href="${href}"`);
    }
  });
});

// Inside the message list a relative link must open the thread artifact it
// names. Left as a relative href, the browser resolves it against the chat
// route (/workspace/chats/<file>), which then loads the file name as a thread.
describe("MarkdownLink relative artifact links", () => {
  const artifacts = [
    "/mnt/user-data/outputs/final report.md",
    "/mnt/user-data/outputs/first/shared.md",
    "/mnt/user-data/outputs/second/shared.md",
    "/mnt/user-data/outputs/notes.md",
  ];
  const MessageLink = createMarkdownLinkComponent("thread-1");
  const reportURL =
    "/api/threads/thread-1/artifacts/mnt/user-data/outputs/final%20report.md";
  const notesURL =
    "/api/threads/thread-1/artifacts/mnt/user-data/outputs/notes.md";

  function render(href: string, paths: readonly string[] | null = artifacts) {
    const link = createElement(MessageLink, { href }, "doc");
    return renderToStaticMarkup(
      paths === null
        ? link
        : createElement(
            MessageArtifactPathsContext.Provider,
            { value: paths },
            link,
          ),
    );
  }

  it("rewrites a uniquely matching relative link to the artifact URL", () => {
    // Markdown destinations reach the renderer percent-encoded.
    const html = render("final%20report.md");
    expect(html).toContain(`href="${reportURL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("text-primary");
    expect(render("./final report.md")).toContain(`href="${reportURL}"`);
    expect(render("././outputs/notes.md")).toContain(`href="${notesURL}"`);
  });

  it("keeps ?query and #fragment suffixes on the rewritten URL", () => {
    expect(render("notes.md?v=2#part-1")).toContain(
      `href="${notesURL}?v=2#part-1"`,
    );
  });

  it("renders ambiguous or unmatched links as text, never a relative href", () => {
    for (const href of ["shared.md", "missing.md", "./missing.md"]) {
      const html = render(href);
      expect(html).not.toContain("<a");
      expect(html).not.toContain("href=");
      expect(html).toContain("<span");
      expect(html).toContain("doc");
    }
    // The artifact list is empty until the thread state loads.
    expect(render("notes.md", [])).not.toContain("href=");
  });

  it("renders traversal paths inert and preserves non-artifact links", () => {
    for (const href of ["../notes.md", "..%2fnotes.md"]) {
      const html = render(href);
      expect(html).not.toContain("<a");
      expect(html).not.toContain("href=");
      expect(html).not.toContain("/api/threads/");
    }
    const external = render("https://example.com/notes.md");
    expect(external).toContain('href="https://example.com/notes.md"');
    expect(external).toContain('target="_blank"');
    expect(render("#notes.md")).toContain('href="#notes.md"');
    expect(render("mailto:a@example.com")).toContain(
      'href="mailto:a@example.com"',
    );
    expect(render("/workspace/chats/new")).toContain(
      'href="/workspace/chats/new"',
    );
  });

  it("styles /mnt/ artifact links like other links", () => {
    const html = render("/mnt/user-data/outputs/chart.png?v=2#detail");
    expect(html).toContain(
      'href="/api/threads/thread-1/artifacts/mnt/user-data/outputs/chart.png?v=2#detail"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain("text-primary");
  });

  it("leaves relative links alone outside the message list", () => {
    expect(render("missing.md", null)).toContain('href="missing.md"');
    const GenericLink = createMarkdownLinkComponent();
    expect(
      renderToStaticMarkup(
        createElement(
          MessageArtifactPathsContext.Provider,
          { value: artifacts },
          createElement(GenericLink, { href: "notes.md" }, "doc"),
        ),
      ),
    ).toContain('href="notes.md"');
  });
});
