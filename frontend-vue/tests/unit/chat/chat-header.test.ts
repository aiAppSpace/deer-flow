/** Header composition uses public title/container structure; state behavior is mounted next to it. */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "vue/compiler-sfc";

type TemplateNode = NonNullable<
  NonNullable<ReturnType<typeof parse>["descriptor"]["template"]>["ast"]
>["children"][number];
type TemplateElement = Extract<TemplateNode, { type: 1 }>;

function elementsOf(nodes: readonly TemplateNode[]): TemplateElement[] {
  return nodes.flatMap((node) =>
    node.type === 1 ? [node, ...elementsOf(node.children)] : [],
  );
}

function assertThreadTitleTemplate(componentSource: string) {
  const { descriptor, errors } = parse(componentSource);
  expect(errors).toEqual([]);
  const ast = descriptor.template?.ast;
  expect(ast).toBeDefined();
  if (!ast) throw new Error("The chat template must have a parsed AST");
  const headers = elementsOf(ast.children).filter(
    (node) => node.tag === "header",
  );
  expect(headers).toHaveLength(1);
  const header = headers[0]!;
  const titles = elementsOf(header.children).filter(
    (node) => node.tag === "FlipDisplay",
  );
  expect(titles).toHaveLength(1);
  const title = titles[0]!;
  const containers = elementsOf(header.children).filter(
    (node) => node.tag === "div" && node.children.includes(title),
  );
  expect(containers).toHaveLength(1);
  expect(
    title.props.some(
      (prop) =>
        prop.type === 7 &&
        prop.name === "bind" &&
        prop.arg?.type === 4 &&
        prop.arg.content === "unique-key" &&
        Boolean(prop.exp?.loc.source.trim()),
    ),
    "The public FlipDisplay must receive a reactive key",
  ).toBe(true);
  expect(title.children.some((child) => child.type === 5)).toBe(true);
}

const actual = readFileSync(
  new URL("../../../app/components/chat/AgentChat.vue", import.meta.url),
  "utf8",
);

describe("chat title public composition", () => {
  it("renders one FlipDisplay inside the header title container", () => {
    assertThreadTitleTemplate(actual);
  });
  it("allows equivalent expressions and additional container classes", () => {
    assertThreadTitleTemplate(`<template><header>
      <div :class="titleClasses"><FlipDisplay v-if="titleVisible" :unique-key="titleIdentity">{{ titleText }}</FlipDisplay></div>
    </header></template>`);
  });
  it("rejects a missing title, a title outside its container or a disconnected key", () => {
    for (const template of [
      "<header><div /></header>",
      '<header><div /><FlipDisplay :unique-key="identity">{{ title }}</FlipDisplay></header>',
      "<header><div><FlipDisplay>{{ title }}</FlipDisplay></div></header>",
    ])
      expect(() =>
        assertThreadTitleTemplate(`<template>${template}</template>`),
      ).toThrow();
  });
});
