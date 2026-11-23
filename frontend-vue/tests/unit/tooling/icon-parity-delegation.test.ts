/*
  【文件职责】     以独立源码夹具运行实际 icon-parity CLI，验证一层组件委托。
  【架构位置】     工程扫描器单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     scripts/icon-parity.mjs · 临时 Vue/React 源码树
  【边界与注意】   不依赖 React checkout；保留实际别名、集合形状与过期豁免检查。
                   文件路径、模板使用关系和层级共同决定委托，不能用同名文件代替。
*/
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixtureFiles(root: string) {
  const absoluteRoot = resolve(root);
  return {
    root: absoluteRoot,
    write(path: string, content: string) {
      const file = resolve(absoluteRoot, path);
      const within = relative(absoluteRoot, file);
      if (!within || isAbsolute(within) || within.split(sep)[0] === "..")
        throw new Error("Fixture file must stay inside its declared root");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
      expect(readFileSync(file, "utf8")).toBe(content);
      return file;
    },
  };
}

function applicationFixture(
  root: string,
  name: string,
  sourceDirectory: "src" | "app",
) {
  const appRoot = join(root, name);
  return {
    root: appRoot,
    source: fixtureFiles(join(appRoot, sourceDirectory)),
    dependencies: fixtureFiles(join(appRoot, "node_modules")),
  };
}

function fixture(
  parent: string,
  children: Record<string, string>,
  reactPresent = true,
) {
  const root = mkdtempSync(join(tmpdir(), "icon-parity-delegation-"));
  roots.push(root);
  const react = applicationFixture(root, "frontend", "src");
  const vue = applicationFixture(root, "frontend-vue", "app");
  vue.source.write("components/Parent.vue", parent);
  react.source.write(
    "components/parent.tsx",
    '<section><span role="status" /><Tooltip /></section>',
  );
  for (const [path, source] of Object.entries(children))
    vue.source.write(path, source);

  // Valid alias/shape fixtures exercise the original guards without loading React.
  const shared = Array.from({ length: 60 }, (_, index) => `Icon${index}`);
  const reactOnly = ["ArrowDown", "Book", "ThumbsUp", "ThumbsDown"];
  const vueOnly = ["Github"];
  const declarations = [
    ...Array.from(
      { length: 1100 },
      (_, index) => `declare const Icon${index}: unknown;`,
    ),
    ...[...reactOnly, ...vueOnly, "CircleCheckBig", "CircleCheck"].map(
      (name) => `declare const ${name}: unknown;`,
    ),
    "export { CircleCheckBig as CheckCircleIcon, CircleCheck as CheckCircle2 };",
  ].join("\n");
  react.dependencies.write("lucide-react/dist/lucide-react.d.ts", declarations);
  vue.dependencies.write(
    "lucide-vue-next/dist/lucide-vue-next.d.ts",
    declarations,
  );
  react.source.write(
    "icons.ts",
    `import { ${[...shared, ...reactOnly].join(", ")} } from "lucide-react";`,
  );
  vue.source.write(
    "icons.ts",
    `import { ${[...shared, ...vueOnly].join(", ")} } from "lucide-vue-next";`,
  );
  react.source.write("glyph.tsx", "<span>×</span>");
  vue.source.write("Glyph.vue", "<template><span>×</span></template>");
  for (const name of ["landing", "docs", "blog"])
    mkdirSync(join(react.source.root, name));

  mkdirSync(join(vue.root, "scripts/lib"), { recursive: true });
  copyFileSync(
    join(workspace, "scripts/icon-parity.mjs"),
    join(vue.root, "scripts/icon-parity.mjs"),
  );
  const helper = "scripts/lib/icon-parity-components.mjs";
  if (existsSync(join(workspace, helper)))
    copyFileSync(join(workspace, helper), join(vue.root, helper));
  for (const dependency of ["vue", "typescript"])
    symlinkSync(
      resolve(workspace, "node_modules", dependency),
      join(vue.dependencies.root, dependency),
      "junction",
    );
  if (!reactPresent) rmSync(react.root, { recursive: true });
  return (expectedError?: string) => {
    const result = spawnSync(process.execPath, ["scripts/icon-parity.mjs"], {
      cwd: vue.root,
      encoding: "utf8",
    });
    expect(result.error).toBeUndefined();
    if (expectedError) {
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expectedError);
      return result.stdout;
    }
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    return result.stdout;
  };
}

const markers = '<template><span role="status" /><Tooltip /></template>';
const missingMarkers = "<template><p>Payload</p></template>";
function expectDelegated(output: string) {
  expect(output).not.toContain("## parent");
  expect(output).toContain("共 0 处待核");
}
function expectMissing(output: string) {
  expect(output).toContain("## parent");
  expect(output).toContain('role="status"：React 1 处，Vue 0 处');
  expect(output).toContain("Tooltip：React 1 处，Vue 0 处");
}

describe("icon parity direct rendered component delegation", () => {
  it("writes real source and dependency files within each declared temporary root", () => {
    const root = mkdtempSync(join(tmpdir(), "icon-parity-file-boundary-"));
    roots.push(root);
    const react = applicationFixture(root, "frontend", "src");
    const vue = applicationFixture(root, "frontend-vue", "app");
    for (const app of [react, vue]) {
      const sourceFile = app.source.write("nested/entry.ts", "source payload");
      const declaration = app.dependencies.write(
        "fixture-package/dist/index.d.ts",
        "dependency payload",
      );
      expect(sourceFile).toBe(join(app.source.root, "nested/entry.ts"));
      expect(readFileSync(sourceFile, "utf8")).toBe("source payload");
      expect(declaration).toBe(
        join(app.dependencies.root, "fixture-package/dist/index.d.ts"),
      );
      expect(readFileSync(declaration, "utf8")).toBe("dependency payload");
      for (const files of [app.source, app.dependencies]) {
        expect(() => files.write("../escaped.ts", "outside")).toThrow(
          "Fixture file must stay inside its declared root",
        );
        expect(() => files.write(join(root, "absolute.ts"), "outside")).toThrow(
          "Fixture file must stay inside its declared root",
        );
        expect(existsSync(join(files.root, "../escaped.ts"))).toBe(false);
      }
    }
    expect(existsSync(join(root, "absolute.ts"))).toBe(false);
  });

  it("retains the original successful skip when React is absent", () => {
    const run = fixture("<template><p>Parent</p></template>", {}, false);
    expect(run()).toContain("跳过：找不到上游");
  });

  it("fails explicitly on an unparseable SFC instead of reporting a valid empty delegate set", () => {
    const run = fixture(
      '<script setup>import Child from "./Child.vue";</script><template><Child',
      { "components/Child.vue": markers },
    );
    run("Cannot inspect");
  });

  it("follows an actual relative default import under its local template name", () => {
    const run = fixture(
      '<script setup>import Payload from "./Child.vue";</script><template><Payload /></template>',
      { "components/Child.vue": markers },
    );
    expectDelegated(run());
  });

  it("resolves an alias import outside components and its kebab template name", () => {
    const run = fixture(
      "<script setup>import StatusPayload from '@/shared/Child.vue';</script><template><status-payload /></template>",
      { "shared/Child.vue": markers },
    );
    expectDelegated(run());
  });

  it("normalizes a parent-relative import to the precise scanned file", () => {
    const run = fixture(
      '<script setup>import Child from "../shared/Child.vue";</script><template><Child /></template>',
      { "shared/Child.vue": markers },
    );
    expectDelegated(run());
  });

  it("does not count an imported child absent from the template", () => {
    const run = fixture(
      '<script setup>import Child from "@/components/Child.vue";</script><template><p>Parent</p></template>',
      { "components/Child.vue": markers },
    );
    expectMissing(run());
  });

  it("cannot borrow markers from an unrelated component with the same basename", () => {
    const run = fixture(
      '<script setup>import Child from "@/components/selected/Child.vue";</script><template><Child /></template>',
      {
        "components/selected/Child.vue": missingMarkers,
        "components/unrelated/Child.vue": markers,
      },
    );
    expectMissing(run());
  });

  it("does not treat a template comment or script string as a rendered child", () => {
    const run = fixture(
      '<script setup>import Child from "@/components/Child.vue"; const example = "<Child />";</script><template><!-- <Child /> --><p>Parent</p></template>',
      { "components/Child.vue": markers },
    );
    expectMissing(run());
  });

  it("keeps delegation to one layer even when a grandchild provides the markers", () => {
    const run = fixture(
      '<script setup>import Child from "./Child.vue";</script><template><Child /></template>',
      {
        "components/Child.vue":
          '<script setup>import Grandchild from "./Grandchild.vue";</script><template><Grandchild /></template>',
        "components/Grandchild.vue": markers,
      },
    );
    expectMissing(run());
  });

  it("does not count a type-only SFC import as a rendered runtime component", () => {
    const run = fixture(
      '<script setup lang="ts">import type Child from "@/components/Child.vue";</script><template><Child /></template>',
      { "components/Child.vue": markers },
    );
    expectMissing(run());
  });

  it("reports an actual delegated child after its status role is removed", () => {
    const run = fixture(
      '<script setup>import Child from "./Child.vue";</script><template><Child /></template>',
      { "components/Child.vue": "<template><span /><Tooltip /></template>" },
    );
    const output = run();
    expect(output).toContain('role="status"：React 1 处，Vue 0 处');
    expect(output).not.toContain("Tooltip：React 1 处，Vue 0 处");
  });

  it("reports an actual delegated child after its tooltip is removed", () => {
    const run = fixture(
      '<script setup>import Child from "./Child.vue";</script><template><Child /></template>',
      { "components/Child.vue": '<template><span role="status" /></template>' },
    );
    const output = run();
    expect(output).toContain("Tooltip：React 1 处，Vue 0 处");
    expect(output).not.toContain('role="status"：React 1 处，Vue 0 处');
  });
});
