/*
  【文件职责】     守住「计划明确点名不装的包」不许出现在 frontend-vue 的依赖里。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     package.json
  【边界与注意】   依赖禁用约定保持有效：Vue 使用自有框架无关协议/消息类型和渲染器，
                   不因搬运 React 适配器引入第二套 SDK。清单变更须审阅实际生产边界，
                   不能为孤立的适配器安装完整依赖。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** 每条都必须能在 02/04 里找到原文。改这张表 = 推翻一条已记录的裁决。 */
const FORBIDDEN: Record<string, string> = {
  "@langchain/langgraph-sdk":
    "02 §106 ❌ 移除 / §372「不必装进项目」；值导入的处置是自写 core/api/client.ts（02 §249，M2）",
  "@langchain/core":
    "02 §107 ❌ 移除；唯一的 type-only 引用（ToolCall）内联进 app/core/types/message.ts",
  ai: "Vue 使用本地 File 与消息附件描述符；上传提交由 core/uploads/submission-files.ts 负责，不引入第二套 SDK",
  // M3 补的三条。同一个形状第三次出现：搬 `core/streamdown/` 时遇到解析不了的
  // `import { code } from "@streamdown/code"`，装包最省事，而「不装」的裁决
  // 躺在 02 §259 的「内容渲染」表里。这次在写代码之前就先把门关上。
  streamdown:
    "02 §259 内容渲染表：streamdown → `hast-util-to-jsx-runtime` + `remend` + `rehype-harden` + 自写流式层（M3 已落地 app/core/markdown/）",
  "@streamdown/code":
    "02 §259 同上；代码块 UI 由 app/components/markdown/CodeBlock.vue 自写",
  "@streamdown/mermaid":
    "02 §259 同上；mermaid UI 由 app/components/markdown/MermaidDiagram.vue 自写",
};

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../package.json", import.meta.url)),
    "utf8",
  ),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("计划点名不装的包", () => {
  it("不在 dependencies / devDependencies 里", () => {
    const declared = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const violations = Object.keys(FORBIDDEN)
      .filter((name) => name in declared)
      .map((name) => `${name} —— ${FORBIDDEN[name]}`);
    expect(violations).toEqual([]);
  });
});
