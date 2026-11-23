/*
  【文件职责】     从 SFC 的实际模板引用解析一层直接组件委托路径。
  【架构位置】     构建脚本共享库
  【主要导出】     directVueComponentPaths
  【依赖关系】     vue/compiler-sfc · TypeScript · node:path
  【边界与注意】   只解析 script setup 的运行时默认 SFC imports，不遍历子组件。
                   相对路径与 @/ 都指向精确文件；未渲染、type-only 或无关同名组件
                   不提供 marker。无模板的 render-function SFC 没有静态委托证据。
*/
import { dirname, resolve } from "node:path";

import ts from "typescript";
import { parse } from "vue/compiler-sfc";

/**
 * @param {string} file
 * @param {string} source
 * @param {string} vueRoot
 * @returns {string[]} Absolute paths of directly referenced SFCs, without recursion.
 */
export function directVueComponentPaths(file, source, vueRoot) {
  const { descriptor, errors } = parse(source, { filename: file });
  if (errors.length)
    throw new Error(`Cannot inspect ${file}: ${errors.join("; ")}`);
  if (!descriptor.template || !descriptor.scriptSetup) return [];

  const script = ts.createSourceFile(
    file,
    descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
    descriptor.scriptSetup.lang === "tsx"
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  if (script.parseDiagnostics.length)
    throw new Error(`Cannot inspect runtime imports in ${file}`);

  const imports = new Map();
  for (const statement of script.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier) || !specifier.text.endsWith(".vue"))
      continue;
    const target = specifier.text.startsWith("@/")
      ? resolve(vueRoot, specifier.text.slice(2))
      : specifier.text.startsWith("./") || specifier.text.startsWith("../")
        ? resolve(dirname(file), specifier.text)
        : undefined;
    if (!target) continue;
    if (clause.name) imports.set(clause.name.text, target);
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const binding of clause.namedBindings.elements) {
        if (!binding.isTypeOnly && binding.propertyName?.text === "default")
          imports.set(binding.name.text, target);
      }
    }
  }

  if (!descriptor.template.ast)
    throw new Error(`Cannot inspect template in ${file}`);
  const tags = new Set();
  const visit = (node) => {
    if (node.type === 1) tags.add(node.tag);
    if (node.children) node.children.forEach(visit);
  };
  visit(descriptor.template.ast);
  const paths = new Set();
  for (const [name, path] of imports) {
    const kebab = name.replace(/\B([A-Z])/g, "-$1").toLowerCase();
    if (tags.has(name) || tags.has(kebab)) paths.add(path);
  }
  return [...paths];
}
