/*
  【文件职责】     以 Vue/TypeScript AST 扫描会进入产品 UI 的英文 SFC 字面量。
  【架构位置】     构建脚本共享库
  【主要导出】     productVueInventory · scanVueSource · scanProductVueFiles
  【依赖关系】     vue/compiler-sfc · TypeScript · app product SFCs
  【边界与注意】   动态 backend/user/code/file/URL 不含字面量；测试 fixture 不属于产品清单。

                   **扫描面必须能自证覆盖全。** `PRODUCT_ROOTS` 是一张白名单，
                   而只从白名单出发的门禁看不见「自称是产品 SFC、但不在名单目录下」
                   的那些（线索 186）。wave 84 实测过一次：往 `app/error.vue`
                   （Nuxt 的约定文件之一）塞四条硬编码英文，
                   `make i18n-source-check`、`make i18n-check`、
                   `source-guard.test.ts` 与 `doc-facts.test.ts` **全绿**——
                   `checked` 仍是 217，而 `I18N_INVENTORY.md` 那句
                   「当前 checkout 共有 N 个 Vue SFC」当场变成假话。
                   所以 `productVueInventory()` 现在还返回 `unscanned`：
                   checkout 里没被这张白名单盖住的 `.vue`。**它必须恒为空**，
                   不为空时要么把那个目录加进 `PRODUCT_ROOTS`，
                   要么说清楚为什么它不是产品 UI——**不要加豁免表**
                   （豁免表为空才说明收口选对了，线索 180）。
*/

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileTemplate, parse } from "vue/compiler-sfc";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PRODUCT_ROOTS = [
  "app/components",
  "app/pages",
  "app/layouts",
  "app/core/settings",
];
const PRODUCT_ENTRY_FILES = ["app/app.vue"];
const TEST_FIXTURE_PREFIX = "app/pages/__m0/";
const ACCESSIBLE_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
]);
const UI_NAME =
  /(?:action|copy|empty|error|fallback|help|hint|label|message|notice|placeholder|statusLabel|subtitle|title|toast|tooltip|warning)s?$/i;
const UI_PROPERTY = new Set([
  "empty",
  "error",
  "hint",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "toast",
  "tooltip",
  "warning",
]);
const SHORTCUT = /^[⌘⇧⌥⌃+\s]*[A-Z,./]$/;
const BRAND = /^(?:DeerFlow(?: Vue)?|DF)$/;
const TECHNICAL_LITERAL =
  /^(?:https?:\/\/[^\s]+|(?:[\w-]+\.)?[A-Za-z0-9_-]+\.(?:md|json|skill|png|jpg|csv|tsv|pdf)|\.skill|\d+(?:\.\d+)? [KMGT]?i?B)$/;
const TECHNICAL_ACRONYM =
  /^(?:API|CLI|CSS|EN|HTML|HTTP|IME|JSON|MCP|MIME|OIDC|PDF|SSE|UI|URL|WS)$/;
const DICTIONARY_KEY = /^[a-z][\w-]*(?:\.[\w-]+)+$/;

function hasEnglishCopy(value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return (
    /[A-Za-z]{2,}/.test(normalized) &&
    !SHORTCUT.test(normalized) &&
    !BRAND.test(normalized) &&
    !TECHNICAL_ACRONYM.test(normalized) &&
    !TECHNICAL_LITERAL.test(normalized) &&
    !DICTIONARY_KEY.test(normalized)
  );
}

function isInternalExpressionToken(value) {
  const normalized = value.trim();
  return (
    /^[a-z_][a-z0-9_./:-]*$/.test(normalized) ||
    normalized === "noopener,noreferrer" ||
    /^\{[A-Za-z_]\w*\}$/.test(normalized) ||
    /^[a-z]{2,3}-[A-Z]{2}$/.test(normalized)
  );
}

function lineOf(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function stringLiterals(expression) {
  const file = ts.createSourceFile(
    "expression.ts",
    `const __value = (${expression})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const values = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      values.push({ text: node.text, offset: node.getStart(file) });
    } else if (ts.isTemplateExpression(node)) {
      values.push({ text: node.head.text, offset: node.head.getStart(file) });
      for (const span of node.templateSpans) {
        values.push({
          text: span.literal.text,
          offset: span.literal.getStart(file),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return values.filter(
    ({ text }) => hasEnglishCopy(text) && !isInternalExpressionToken(text),
  );
}

function nameText(node) {
  if (!node) return "";
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "value"
      ? nameText(node.expression)
      : node.name.text;
  }
  return "";
}

function enclosingUiName(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isVariableDeclaration(current)) {
      return nameText(current.name);
    }
    if (ts.isFunctionDeclaration(current)) return nameText(current.name);
    if (ts.isPropertyAssignment(current)) return nameText(current.name);
    if (ts.isBinaryExpression(current)) return nameText(current.left);
  }
  return "";
}

function isUiScriptLiteral(node) {
  const parent = node.parent;
  if (
    ts.isBinaryExpression(parent) &&
    [
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].includes(parent.operatorToken.kind)
  ) {
    return false;
  }
  if (
    ts.isPropertyAssignment(parent) &&
    UI_PROPERTY.has(nameText(parent.name))
  ) {
    return true;
  }
  const name = enclosingUiName(node);
  if (UI_NAME.test(name)) return true;
  for (let current = parent; current; current = current.parent) {
    if (
      ts.isNewExpression(current) &&
      nameText(current.expression) === "Error"
    ) {
      return true;
    }
    if (ts.isCallExpression(current)) {
      const callee = current.expression.getText();
      if (/(?:toast|notify|notification|showError|new Error)/i.test(callee)) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(current.expression) &&
        ["add", "push"].includes(current.expression.name.text) &&
        UI_NAME.test(nameText(current.expression.expression))
      ) {
        return true;
      }
    }
    if (ts.isStatement(current)) break;
  }
  return false;
}

function scanScript(source, content, startOffset, issues) {
  const file = ts.createSourceFile(
    "component.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node) => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      isUiScriptLiteral(node)
    ) {
      const values = ts.isTemplateExpression(node)
        ? [
            node.head.text,
            ...node.templateSpans.map((span) => span.literal.text),
          ]
        : [node.text];
      for (const text of values.filter(
        (value) => hasEnglishCopy(value) && !isInternalExpressionToken(value),
      )) {
        issues.push({
          kind: "script-ui",
          text: text.replace(/\s+/g, " ").trim(),
          line: lineOf(source, startOffset + node.getStart(file)),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

function scanTemplate(source, content, startOffset, filename, issues) {
  const compiled = compileTemplate({
    source: content,
    filename,
    id: "i18n-source-guard",
  });
  if (compiled.errors.length) {
    throw new Error(
      `${filename}: template parse failed: ${compiled.errors[0]}`,
    );
  }
  const visit = (node) => {
    if (node.type === 2 && hasEnglishCopy(node.content)) {
      issues.push({
        kind: "template-text",
        text: node.content.replace(/\s+/g, " ").trim(),
        line: lineOf(source, startOffset + node.loc.start.offset),
      });
    }
    for (const property of node.props ?? []) {
      if (
        property.type === 6 &&
        ACCESSIBLE_ATTRIBUTES.has(property.name) &&
        property.value &&
        hasEnglishCopy(property.value.content)
      ) {
        issues.push({
          kind: "template-attribute",
          text: property.value.content.trim(),
          line: lineOf(source, startOffset + property.loc.start.offset),
        });
      }
      if (
        property.type === 7 &&
        property.name === "bind" &&
        property.arg?.type === 4 &&
        ACCESSIBLE_ATTRIBUTES.has(property.arg.content) &&
        property.exp
      ) {
        const expression =
          property.exp.loc.source ||
          (property.exp.type === 4 ? property.exp.content : "");
        for (const literal of stringLiterals(expression)) {
          issues.push({
            kind: "template-bound-attribute",
            text: literal.text.replace(/\s+/g, " ").trim(),
            line: lineOf(source, startOffset + property.loc.start.offset),
          });
        }
      }
    }
    if (node.type === 5 && node.content) {
      const expression =
        node.content.loc.source ||
        (node.content.type === 4 ? node.content.content : "");
      for (const literal of stringLiterals(expression)) {
        issues.push({
          kind: "template-expression",
          text: literal.text.replace(/\s+/g, " ").trim(),
          line: lineOf(source, startOffset + node.loc.start.offset),
        });
      }
    }
    for (const child of node.children ?? []) visit(child);
    for (const branch of node.branches ?? []) visit(branch);
  };
  visit(compiled.ast);
}

export function scanVueSource(source, filename) {
  const { descriptor, errors } = parse(source, { filename });
  if (errors.length)
    throw new Error(`${filename}: SFC parse failed: ${errors[0]}`);
  const issues = [];
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block) continue;
    scanScript(source, block.content, block.loc.start.offset, issues);
  }
  if (descriptor.template) {
    scanTemplate(
      source,
      descriptor.template.content,
      descriptor.template.loc.start.offset,
      filename,
      issues,
    );
  }
  return issues.map((issue) => ({ filename, ...issue }));
}

function vueFiles(relRoot) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(ROOT, directory), {
      withFileTypes: true,
    })) {
      const next = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (extname(entry.name) === ".vue") files.push(next);
    }
  };
  walk(relRoot);
  return files;
}

/**
 * checkout 里全部 `.vue`：**已跟踪 + 未跟踪且未被忽略**。
 *
 * 后半截不能省：新写的 SFC 在提交之前只看 `git ls-files` 是看不见的，
 * 而「这次改动引入了一个没人扫的 SFC」正是要当场拦住的那件事
 * （`scripts/standalone-check.mjs` 里同一条理由）。
 */
function allVueFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.vue"],
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .filter((rel) => existsSync(join(ROOT, rel)))
    .sort();
}

export function productVueInventory() {
  /*
    **点名的根与入口必须真的在**（wave 112）。`vueFiles` 走的是
    `git ls-files <root>`，对一个不存在的路径它**不报错、只返回空**——
    于是把 `app/layouts` 改个名，这份清单会安静地少掉一整个目录，
    而「产品 SFC 218 / 总 220」这类数字**照样自洽**（它们是从这里算出来的）。
    与 `PRODUCT_ROOTS` 那条白名单的自证覆盖是同一件事的另一半：
    那边管「有没有漏掉的目录」，这边管「点名的目录还在不在」。
  */
  const missing = [...PRODUCT_ENTRY_FILES, ...PRODUCT_ROOTS].filter(
    (rel) => !existsSync(join(ROOT, rel)),
  );
  if (missing.length > 0) {
    throw new Error(
      `i18n 扫描面点名的路径不存在了（改名了？）：${missing.join("、")}`,
    );
  }
  const discovered = [
    ...PRODUCT_ENTRY_FILES,
    ...PRODUCT_ROOTS.flatMap(vueFiles),
  ].sort();
  // Unit SFC fixtures live outside Nuxt app sources and are compiled only by tests.
  // Keep them enumerated; unknown product roots must still fail as unscanned.
  const checkout = allVueFiles();
  const unitFixtures = checkout.filter((file) => file.startsWith("tests/"));
  const covered = new Set([...discovered, ...unitFixtures]);
  return {
    checked: discovered.filter((file) => !file.startsWith(TEST_FIXTURE_PREFIX)),
    excludedTestFixtures: [
      ...discovered.filter((file) => file.startsWith(TEST_FIXTURE_PREFIX)),
      ...unitFixtures,
    ].sort(),
    // 白名单没盖住的 `.vue`。恒为空；不为空说明扫描面漏了一块。
    unscanned: checkout.filter((file) => !covered.has(file)),
  };
}

export function scanProductVueFiles() {
  return productVueInventory().checked.flatMap((file) =>
    scanVueSource(readFileSync(join(ROOT, file), "utf8"), file),
  );
}

export function relativeGuardPath(path) {
  return relative(ROOT, path);
}
