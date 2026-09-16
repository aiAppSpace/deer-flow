import { describe, expect, it } from "@rstest/core";
import {
  createElement,
  type ComponentProps,
  type ReactElement,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ArtifactLink } from "@/components/workspace/citations/artifact-link";
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


// Render-level coverage for the .md artifact preview link renderer: a
// prompt-injected javascript:/data: href must never reach a real anchor in
// the main document (mirrors the MarkdownLink guard).
describe("ArtifactLink rendering", () => {
  it("renders an unsafe href as a disabled span, never an anchor", () => {
    const html = render(
      createElement(ArtifactLink, { href: "javascript:alert(1)" }, "click me"),
    );
    expect(html).not.toContain("<a");
    expect(html).toContain("<span");
    expect(html).toContain("click me");
    expect(html).not.toContain("href=");
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
      createElement(ArtifactLink, { href: "javascript:alert(1)" }, "click me"),
      "zh-CN",
    );
    expect(zh).toContain('aria-label="已省略不安全链接"');
    expect(zh).toContain("链接协议不安全：javascript:alert(1)");

    const en = render(
      createElement(ArtifactLink, { href: "javascript:alert(1)" }, "click me"),
    );
    expect(en).toContain('aria-label="Unsafe link omitted"');
    expect(en).toContain("Unsafe link scheme in javascript:alert(1)");
  });

  it("renders a safe https href as a hardened anchor", () => {
    const html = render(
      createElement(ArtifactLink, { href: "https://example.com/x" }, "site"),
    );
    expect(html).toContain("<a");
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders citation labels when children are React elements", () => {
    const html = render(
      createElement(
        ArtifactLink,
        { href: "https://example.com/report" },
        createElement("span", null, "citation:Test Source"),
      ),
    );
    expect(html).not.toContain("citation:");
    expect(html).toContain("Test Source");
  });

  it("renders scheme-less relative hrefs as navigable anchors", () => {
    const tests = ["report.md", "./report.md", "../assets/chart.png"];
    for (const href of tests) {
      const html = render(
        createElement(ArtifactLink, { href }, "doc"),
      );
      expect(html).toContain("<a");
      expect(html).toContain(`href="${href}"`);
    }
  });
});
