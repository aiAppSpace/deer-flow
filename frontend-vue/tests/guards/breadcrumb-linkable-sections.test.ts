/** Every index route has an explicit breadcrumb policy; every link resolves.
 * Reachability alone does not make a current-page label a navigation link.
 */
import {
  existsSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  CURRENT_PAGE_SECTIONS,
  LINKABLE_SECTIONS,
} from "@/core/workspace-shell/breadcrumb";

const workspacePages = fileURLToPath(
  new URL("../../app/pages/workspace", import.meta.url),
);

/**
 * `/workspace/<段>` 真的能到达的那些段。Nuxt 两种写法都算：
 * `<段>/index.vue`（目录 + index）和 `<段>.vue`（单文件路由）。
 */
function routableSections(directory = workspacePages): string[] {
  const found = new Set<string>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (existsSync(join(directory, entry.name, "index.vue"))) {
        found.add(entry.name);
      }
    } else if (entry.name.endsWith(".vue") && entry.name !== "index.vue") {
      found.add(entry.name.slice(0, -".vue".length));
    }
  }
  return [...found].sort();
}

function expectCompletePolicy(
  routes: string[],
  links: Record<string, unknown>,
  current: readonly string[],
) {
  expect(current.filter((section) => section in links)).toEqual([]);
  // Only the route scanner deduplicates equivalent index URLs. A duplicate
  // policy remains an error, as do missing and orphan policies.
  expect([...Object.keys(links), ...current].sort()).toEqual(routes);
}

describe("index-route scanner and policy validation", () => {
  const fixtures: string[] = [];
  afterEach(() => {
    for (const directory of fixtures.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });
  it.each([
    { files: ["agents.vue"], expected: ["agents"] },
    { files: ["agents/index.vue"], expected: ["agents"] },
    { files: ["agents.vue", "agents/index.vue"], expected: ["agents"] },
    { files: ["agents/[name].vue"], expected: [] },
  ])("maps $files to its real index URL once", ({ files, expected }) => {
    const directory = mkdtempSync(
      join(tmpdir(), "deerflow-breadcrumb-policy-"),
    );
    fixtures.push(directory);
    for (const file of files) {
      const path = join(directory, file);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "<template><div /></template>", "utf8");
    }
    expect(routableSections(directory)).toEqual(expected);
  });
  it("rejects missing, orphan, duplicate and conflicting policies", () => {
    expectCompletePolicy(["agents"], {}, ["agents"]);
    expect(() => expectCompletePolicy(["agents"], {}, [])).toThrow();
    expect(() =>
      expectCompletePolicy(["agents"], {}, ["agents", "orphan"]),
    ).toThrow();
    expect(() =>
      expectCompletePolicy(["agents"], {}, ["agents", "agents"]),
    ).toThrow();
    expect(() =>
      expectCompletePolicy(["agents"], { agents: {} }, ["agents"]),
    ).toThrow();
  });
});

describe("面包屑可链接段与真实路由对账", () => {
  const routable = routableSections();

  it("形状先断言：两边都扫到了东西", () => {
    // 少了这条，`readdirSync` 指错目录就会在空集上恒绿。
    expect(routable.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(LINKABLE_SECTIONS).length).toBeGreaterThanOrEqual(3);
    // 而且真的存在「有目录、但没有 index 路由」的段——否则这条门禁守的是空气。
    const dirsWithoutIndex = readdirSync(workspacePages, {
      withFileTypes: true,
    })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !existsSync(join(workspacePages, entry.name, "index.vue")),
      )
      .map((entry) => entry.name);
    expect(dirsWithoutIndex.length).toBeGreaterThanOrEqual(1);
  });

  it("表里的每一段都真的有路由——否则面包屑把人送去 404", () => {
    expect(Object.keys(LINKABLE_SECTIONS).sort()).toEqual(
      Object.keys(LINKABLE_SECTIONS)
        .filter((section) => routable.includes(section))
        .sort(),
    );
  });

  it("every index route has one explicit link or current-page policy", () => {
    expectCompletePolicy(routable, LINKABLE_SECTIONS, CURRENT_PAGE_SECTIONS);
  });
});
