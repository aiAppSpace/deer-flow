/**
 * Product modal semantics belong to the public Dialog/AlertDialog/Sheet primitives.
 * Keep listbox/disclosure semantics available to the composer and message UI.
 * Scan the complete current source set, trace real product consumers and all
 * public primitives, and prove the detector with invalid fixtures. AlertDialog
 * remains a reusable seam exercised by the mounted primitive tests; current
 * product dialogs use Dialog and Sheet.
 */

import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse } from "vue/compiler-sfc";

import { stripComments } from "../../scripts/lib/strip-comments.mjs";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));
const PRIMITIVE_DIR = "components/ui/";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === ".vue" || extname(full) === ".ts")
      out.push(full);
  }
  return out;
}

function codeOf(file: string): string {
  const source = readFileSync(file, "utf8");
  return stripComments(
    source,
    extname(file) === ".vue" ? ["line", "block", "html"] : ["line", "block"],
  );
}

/**
 * 模态语义的三个标志。**拼出来而不是写成字面量**，理由见文件头。
 *
 * - `role="dialog"` / `role="alertdialog"`：产品层不该自己声明对话框角色。
 * - `aria-modal`：同上，而且它只是声明，真正管用的是 primitive 打的 `aria-hidden`。
 * - `fixed inset-0`：全屏遮罩。产品层需要遮罩就意味着它在自己实现一个浮层。
 */
const MARKERS: Array<[string, RegExp]> = [
  ["role=dialog", new RegExp(`role=["']${"dialog"}["']`)],
  ["role=alertdialog", new RegExp(`role=["']${"alertdialog"}["']`)],
  ["role 绑定成 dialog", new RegExp(`['"]${"dialog"}['"]\\s*:\\s*undefined`)],
  ["aria-modal", new RegExp(`${"aria"}-${"modal"}`)],
  ["全屏遮罩", /["'`](?=[^"'`]*\bfixed\b)(?=[^"'`]*\binset-0\b)[^"'`]*["'`]/],
];

function violations(files: string[]): string[] {
  const rows: string[] = [];
  for (const file of files) {
    const code = codeOf(file);
    for (const [label, pattern] of MARKERS) {
      if (pattern.test(code))
        rows.push(`${relative(appDir, file)} —— ${label}`);
    }
  }
  return rows;
}

function withSourceFile(source: string, verify: (file: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "deerflow-modal-guard-"));
  const file = join(directory, "Fixture.vue");
  try {
    writeFileSync(file, source, "utf8");
    verify(file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function namedImports(source: string, module: string) {
  const descriptor = parse(source).descriptor;
  const script = ts.createSourceFile(
    "consumer.ts",
    descriptor.scriptSetup?.content ?? descriptor.script?.content ?? source,
    ts.ScriptTarget.Latest,
  );
  return script.statements.flatMap((node) =>
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === module &&
    node.importClause?.namedBindings &&
    ts.isNamedImports(node.importClause.namedBindings)
      ? node.importClause.namedBindings.elements.map((element) => ({
          imported: element.propertyName?.text ?? element.name.text,
          local: element.name.text,
        }))
      : [],
  );
}

function templateTags(source: string): Set<string> {
  const tags = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const value = node as { tag?: string; children?: unknown[] };
    if (value.tag) tags.add(value.tag);
    value.children?.forEach(visit);
  };
  visit(parse(source).descriptor.template?.ast);
  return tags;
}

const all = walk(appDir).sort();
// Independent filesystem inventory catches accidental exclusions in walk/partition.
const inventory = readdirSync(appDir, { recursive: true, encoding: "utf8" })
  .filter((name) => /\.(?:vue|ts)$/.test(name))
  .map((name) => join(appDir, name))
  .filter((file) => statSync(file).isFile())
  .sort();
const primitive = (file: string) =>
  relative(appDir, file).startsWith(PRIMITIVE_DIR);
const product = all.filter((file) => !primitive(file));
const primitives = all.filter(primitive);
const publicModals = [
  { family: "dialog", content: "DialogContent", reka: "DialogContent" },
  {
    family: "alert-dialog",
    content: "AlertDialogContent",
    reka: "AlertDialogContent",
  },
  { family: "sheet", content: "SheetContent", reka: "DialogContent" },
] as const;

function assertScanScope(scanned: readonly string[]) {
  expect(scanned).toEqual(inventory);
  expect(scanned).toContain(join(appDir, "app.vue"));
  const productFiles = scanned.filter((file) => !primitive(file));
  const primitiveFiles = scanned.filter(primitive);
  expect(new Set([...productFiles, ...primitiveFiles])).toEqual(
    new Set(inventory),
  );
  expect(productFiles.some(primitive)).toBe(false);
  expect(primitiveFiles.every(primitive)).toBe(true);
}

function publicConsumers(family: string, content: string) {
  return product.filter((file) => {
    // Only SFC templates can consume these tags. Check the import first instead
    // of parsing every product template once for each primitive family.
    if (extname(file) !== ".vue") return false;
    const source = codeOf(file);
    const imports = namedImports(source, `@/components/ui/${family}`).filter(
      (item) => item.imported === content,
    );
    if (!imports.length) return false;
    const tags = templateTags(source);
    return imports.some((item) => tags.has(item.local));
  });
}

function contentModule(barrel: string, content: string) {
  const exports = ts.createSourceFile(
    "index.ts",
    barrel,
    ts.ScriptTarget.Latest,
  );
  for (const node of exports.statements) {
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause) &&
      node.exportClause.elements.some((item) => item.name.text === content) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      return node.moduleSpecifier.text;
  }
  throw new Error(
    `The public barrel must export ${content} from its implementation`,
  );
}

function assertPrimitiveBoundary(
  family: string,
  content: string,
  reka: string,
  barrel: string,
  implementation: string,
) {
  expect(
    contentModule(barrel, content),
    `${family} content must be a Vue primitive`,
  ).toMatch(/\.vue$/);
  const imports = namedImports(implementation, "reka-ui");
  const tags = templateTags(implementation);
  expect(
    imports.some((item) => item.imported === reka && tags.has(item.local)),
    `${content} must render its actual Reka modal content`,
  ).toBe(true);
  expect(
    MARKERS.find(([name]) => name === "aria-modal")?.[1].test(implementation),
    `${content} owns the modal accessibility declaration`,
  ).toBe(true);
}

describe("product modal ownership", () => {
  it("scans the complete current source set with disjoint product/primitive partitions", () => {
    assertScanScope(all);
  });

  it("rejects an empty scan or a missing real modal consumer", () => {
    expect(() => assertScanScope([])).toThrow();
    const consumer = publicConsumers("dialog", "DialogContent")[0];
    expect(consumer).toBeDefined();
    expect(() =>
      assertScanScope(all.filter((file) => file !== consumer)),
    ).toThrow();
  });

  it("keeps all product code free of hand-written modal semantics", () => {
    expect(
      violations(product),
      "Use the public Dialog, AlertDialog or Sheet; modal semantics belong to their primitives.",
    ).toEqual([]);
  });

  it.each(publicModals.filter(({ family }) => family !== "alert-dialog"))(
    "traces actual $family product consumers through the public content export",
    ({ family, content }) => {
      const consumers = publicConsumers(family, content);
      expect(
        consumers,
        `${family} must have an actual template consumer`,
      ).not.toEqual([]);
      for (const consumer of consumers) expect(product).toContain(consumer);
    },
  );

  it.each(publicModals)(
    "traces every public $family content export to its accessible Reka primitive",
    ({ family, content, reka }) => {
      const barrel = join(appDir, PRIMITIVE_DIR, family, "index.ts");
      const implementation = join(
        appDir,
        PRIMITIVE_DIR,
        family,
        contentModule(codeOf(barrel), content),
      );
      expect(primitives).toContain(barrel);
      expect(primitives).toContain(implementation);
      assertPrimitiveBoundary(
        family,
        content,
        reka,
        codeOf(barrel),
        codeOf(implementation),
      );
    },
  );

  it.each(publicModals)(
    "rejects an unexported, disconnected or inaccessible $family implementation",
    ({ family, content, reka }) => {
      const implementation = codeOf(
        join(appDir, PRIMITIVE_DIR, family, `${content}.vue`),
      );
      const barrel = codeOf(join(appDir, PRIMITIVE_DIR, family, "index.ts"));
      for (const [badBarrel, badImplementation] of [
        ["export {};", implementation],
        [barrel, '<template><div :aria-modal="true" /></template>'],
        [barrel, implementation.replaceAll("aria-modal", "data-modal")],
      ]) {
        expect(() =>
          assertPrimitiveBoundary(
            family,
            content,
            reka,
            badBarrel!,
            badImplementation!,
          ),
        ).toThrow();
      }
    },
  );

  it.each([
    ['<div role="dialog" />', "role=dialog"],
    ["<div role='alertdialog' />", "role=alertdialog"],
    ["<div :role=\"modal ? 'dialog' : undefined\" />", "role 绑定成 dialog"],
    ['<div :aria-modal="open" />', "aria-modal"],
    ['<div class="fixed inset-0 z-50" />', "全屏遮罩"],
    ['<div class="inset-0 z-50 fixed" />', "全屏遮罩"],
  ])("detects forbidden modal semantics in %s", (source, marker) => {
    withSourceFile(source, (file) => {
      expect(violations([file])).toContain(
        `${relative(appDir, file)} —— ${marker}`,
      );
    });
  });

  it.each([
    '<div role="listbox"><span role="option" /></div>',
    '<button :aria-expanded="open">Details</button>',
    '<div class="fixed bottom-0" /><div class="absolute inset-0" />',
    '<!-- <div role="dialog" aria-modal="true" class="fixed inset-0" /> -->',
    '<script>/* role="dialog" aria-modal fixed inset-0 */</script>',
  ])("preserves non-modal semantics and ignores comments: %s", (source) => {
    withSourceFile(source, (file) => expect(violations([file])).toEqual([]));
  });
});
