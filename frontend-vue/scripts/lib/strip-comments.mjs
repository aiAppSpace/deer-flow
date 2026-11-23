/*
  【文件职责】     用词法边界把选定的源码注释替换成等宽空格。
  【架构位置】     构建脚本共享库
  【主要导出】     stripComments
  【依赖关系】     无
  【边界与注意】   字符串、模板文本、正则字面量均保留；模板插值里的代码继续扫描。
                   正则通过表达式起始上下文识别，字符类和转义单独消费，避免引号
                   改写字符串状态；除法操作符不进入正则状态。HTML/hash 按调用方
                   选定样式处理，不改变扫描范围。保留 UTF-16 长度与所有换行位置。
*/

const EXPRESSION_PREFIX = new Set([
  "return",
  "throw",
  "case",
  "delete",
  "void",
  "typeof",
  "new",
  "in",
  "instanceof",
  "yield",
  "await",
  "of",
  "else",
  "do",
]);
const CONTROL_PAREN = new Set([
  "if",
  "while",
  "for",
  "with",
  "switch",
  "catch",
]);
const BLOCK_PREFIX = new Set(["else", "do", "try", "finally", "=>", ";", ""]);
const lineBreak = (ch) =>
  ch === "\n" || ch === "\r" || ch === "\u2028" || ch === "\u2029";
const identifierStart = (ch) => ch !== undefined && /[A-Za-z_$]/.test(ch);
const identifierPart = (ch) => ch !== undefined && /[A-Za-z0-9_$]/.test(ch);

/** Return a complete regex token's end, respecting escapes and character classes. */
function regexEnd(source, start) {
  let characterClass = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (lineBreak(ch)) return null;
    if (ch === "\\") {
      if (lineBreak(source[i + 1])) return null;
      i += 1;
    } else if (ch === "[") {
      characterClass = true;
    } else if (ch === "]" && characterClass) {
      characterClass = false;
    } else if (ch === "/" && !characterClass) {
      i += 1;
      while (identifierPart(source[i])) i += 1;
      return i;
    }
  }
  return null;
}

/** Replace selected comments with spaces, preserving source length and token positions. */
export function stripComments(source, styles) {
  const out = source.split("");
  const has = (style) => styles.includes(style);
  const parentheses = [];
  const braces = [];
  let i = 0;
  let state = "code";
  let quote = "";
  let expressionAllowed = true;
  let previous = "";
  let pendingFunction = null;
  let pendingFunctionBody = null;
  let pendingClass = null;
  let pendingFor = false;
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k += 1)
      if (!lineBreak(out[k])) out[k] = " ";
  };
  const lineEnd = (from) => {
    let end = from;
    while (end < source.length && !lineBreak(source[end])) end += 1;
    return end;
  };
  while (i < source.length) {
    const ch = source[i];
    const two = source.slice(i, i + 2);
    if (state === "string") {
      if (ch === "\\") i += 2;
      else {
        if (ch === quote) {
          state = "code";
          expressionAllowed = false;
          previous = "literal";
        }
        i += 1;
      }
      continue;
    }
    if (state === "template") {
      if (ch === "\\") i += 2;
      else if (two === "${") {
        braces.push("template");
        state = "code";
        expressionAllowed = true;
        previous = "${";
        i += 2;
      } else {
        if (ch === "`") {
          state = "code";
          expressionAllowed = false;
          previous = "literal";
        }
        i += 1;
      }
      continue;
    }
    if (has("block") && two === "/*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (has("html") && source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      const stop = end === -1 ? source.length : end + 3;
      blank(i, stop);
      i = stop;
      continue;
    }
    if ((has("line") && two === "//") || (has("hash") && ch === "#")) {
      const stop = lineEnd(i);
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      state = "string";
      i += 1;
      continue;
    }
    if (ch === "`") {
      state = "template";
      i += 1;
      continue;
    }
    // A closing HTML/JSX tag is not a JavaScript expression start.
    if (
      ch === "/" &&
      has("line") &&
      expressionAllowed &&
      source[i - 1] !== "<"
    ) {
      const end = regexEnd(source, i);
      if (end !== null) {
        i = end;
        expressionAllowed = false;
        previous = "literal";
        continue;
      }
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (identifierStart(ch)) {
      const start = i++;
      while (identifierPart(source[i])) i += 1;
      const word = source.slice(start, i);
      const property = previous === ".";
      const declaration =
        BLOCK_PREFIX.has(previous) ||
        previous === "control-close" ||
        previous === "export" ||
        previous === "default";
      if (!property && word === "function")
        pendingFunction = { expression: expressionAllowed && !declaration };
      if (!property && word === "class")
        pendingClass = {
          expression: expressionAllowed && !declaration,
          depth: parentheses.length,
        };
      if (!property && word === "for") pendingFor = true;
      expressionAllowed = !property && EXPRESSION_PREFIX.has(word);
      previous = property ? "property" : word;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      i += 1;
      while (source[i] !== undefined && /[A-Za-z0-9_.]/.test(source[i])) i += 1;
      expressionAllowed = false;
      previous = "literal";
      continue;
    }
    if (ch === "(") {
      parentheses.push({
        control: pendingFor || CONTROL_PAREN.has(previous),
        fn: pendingFunction,
      });
      pendingFor = false;
      pendingFunction = null;
      expressionAllowed = true;
    } else if (ch === ")") {
      const context = parentheses.pop();
      expressionAllowed = context?.control === true;
      if (context?.fn) pendingFunctionBody = context.fn;
      previous = expressionAllowed ? "control-close" : ")";
      i += 1;
      continue;
    } else if (ch === "{") {
      if (pendingFunctionBody) {
        braces.push(
          pendingFunctionBody.expression ? "expression-body" : "block",
        );
        pendingFunctionBody = null;
      } else if (pendingClass && pendingClass.depth === parentheses.length) {
        braces.push(pendingClass.expression ? "expression-body" : "block");
        pendingClass = null;
      } else {
        const block =
          !expressionAllowed ||
          BLOCK_PREFIX.has(previous) ||
          previous === "control-close";
        braces.push(block ? "block" : "object");
      }
      expressionAllowed = true;
    } else if (ch === "}") {
      const kind = braces.pop();
      if (kind === "template") state = "template";
      expressionAllowed = kind === "block";
    } else if (ch === "]" || ch === ".") {
      expressionAllowed = false;
    } else if (two === "++" || two === "--") {
      // Prefix operators keep expecting an expression; postfix operators do not.
      previous = two;
      i += 2;
      continue;
    } else if (two === "=>") {
      expressionAllowed = true;
      previous = two;
      i += 2;
      continue;
    } else {
      expressionAllowed = true;
    }
    previous = ch;
    i += 1;
  }
  return out.join("");
}
