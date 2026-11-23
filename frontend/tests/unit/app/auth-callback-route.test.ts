import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

/*
  The OAuth callback must not sit under a layout that redirects authenticated
  users away.

  `src/app/(auth)/layout.tsx` server-redirects to `/workspace` the moment
  `getServerSideUser()` reports `authenticated`. A real OIDC flow already holds
  the session cookie when it lands on `/auth/callback`, so while this page lived
  inside that group it never rendered: the `?next=` deep link the user started
  from was silently dropped, and the page's own `next` handling was dead code.

  Pinned structurally — "which layout owns this route" is exactly the defect.
*/
// `__dirname` rather than `import.meta.url`: rstest bundles the test and
// rewrites `new URL(..., import.meta.url)` into a `require`, matching the
// idiom already used by `layout-boundaries.test.ts`.
const appDir = path.resolve(__dirname, "../../../src/app");

/** Resolve a URL path to its page file, ignoring `(group)` segments. */
function findPage(segments: string[], dir = appDir): string | null {
  if (segments.length === 0) {
    const page = path.join(dir, "page.tsx");
    return existsSync(page) ? page : null;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    if (!isGroup && entry.name !== segments[0]) continue;
    const found = findPage(
      isGroup ? segments : segments.slice(1),
      path.join(dir, entry.name),
    );
    if (found) return found;
  }
  return null;
}

/** Every `layout.tsx` from `src/app/` down to the directory holding `page`. */
function layoutsAbove(page: string): string[] {
  const layouts: string[] = [];
  for (
    let dir = path.dirname(page);
    dir === appDir || dir.startsWith(appDir + path.sep);
    dir = path.dirname(dir)
  ) {
    const layout = path.join(dir, "layout.tsx");
    if (existsSync(layout)) layouts.push(layout);
  }
  return layouts;
}

describe("/auth/callback route placement", () => {
  const page = findPage(["auth", "callback"]);

  if (!page) {
    // Fail loudly rather than skipping: "no page found" is exactly the
    // regression this file exists to catch.
    throw new Error("no page.tsx resolves for /auth/callback");
  }

  it("resolves to a real page file", () => {
    expect(page).not.toBeNull();
    expect(layoutsAbove(page).length).toBeGreaterThan(0);
  });

  it("is governed by no layout that redirects authenticated users", () => {
    const redirecting = layoutsAbove(page).filter((layout) => {
      const source = readFileSync(layout, "utf8");
      return (
        source.includes('case "authenticated":') &&
        /redirect\(\s*["'`]\/workspace/.test(source)
      );
    });
    expect(
      redirecting.map((layout) => path.relative(appDir, layout)),
      "a layout above /auth/callback redirects authenticated users, so the page never renders and ?next= is dropped",
    ).toEqual([]);
  });

  it("provides locale context without an AuthProvider or a server session probe", () => {
    const source = readFileSync(path.join(appDir, "auth/layout.tsx"), "utf8");
    expect(source).toContain("I18nProvider initialLocale={locale}");
    expect(source).toContain("detectLocaleServer()");
    expect(source).not.toMatch(/<AuthProvider\b/);
    expect(source).not.toContain('from "@/core/auth/AuthProvider"');
    expect(source.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain(
      "getServerSideUser",
    );
  });

  it("still honours the ?next= deep link it was handed", () => {
    const source = readFileSync(page, "utf8");
    expect(source).toContain('searchParams.get("next")');
    expect(source).toContain("resolveAuthNextPath");
  });
});
