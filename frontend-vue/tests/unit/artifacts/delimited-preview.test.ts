/*
  【文件职责】     固定 CSV/TSV 预览解析器的边界行为。
  【架构位置】     测试
  【依赖关系】     app/core/artifacts/delimited-preview.ts
  【边界与注意】   这里几乎每一条都在守一个**具体的坏结果**，不是在守「解析对了」：
                   空记录不能被吞（吞了行号就对不上原文）、截断样本的残记录不能显示
                   （显示出来是一行凭空缺列的假数据）、引号里的 CR 不能算记录边界
                   （算了整份预览就错行）、语法真的坏了要抛（不能默默显示半份）。
                   改实现前先想清楚要让哪一条失效。
*/

import { describe, expect, it } from "vitest";

import { parseDelimitedPreview } from "@/core/artifacts/delimited-preview";

const parse = (
  content: string,
  truncated = false,
  delimiter: "," | "\t" = ",",
) => parseDelimitedPreview({ content, truncated, delimiter });

describe("delimited preview parser", () => {
  it("原样保留字符串、BOM、重复/空表头和带引号字段", () => {
    expect(
      parse(
        '﻿名字,,名字\r\n001,"a,b","say ""hi"""\r\n12345678901234567890,"多\n行", true ',
      ).rows,
    ).toEqual([
      ["名字", "", "名字"],
      ["001", "a,b", 'say "hi"'],
      // 长数字不能变成 1.2345678901234568e19，前导/尾随空格也不能被吃掉。
      ["12345678901234567890", "多\n行", " true "],
    ]);
  });

  it.each(["\n", "\r\n", "\r"])("保留 %j 的真实空记录", (newline) => {
    expect(parse(`a${newline}${newline}b${newline}`).rows).toEqual([
      ["a"],
      [""],
      ["b"],
    ]);
    expect(parse(newline).rows).toEqual([[""]]);
  });

  it("区分空文件、空字段和缺字段", () => {
    expect(parse("").rows).toEqual([]);
    expect(parse("a,b\n,\nx")).toEqual({
      rows: [["a", "b"], ["", ""], ["x"]],
      columnCount: 2,
      unevenRows: true,
      limited: false,
    });
  });

  it("按传入的分隔符解析 TSV，逗号只是普通字符", () => {
    expect(parse('a\tb\n"x\ty"\t1,000', false, "\t").rows).toEqual([
      ["a", "b"],
      ["x\ty", "1,000"],
    ]);
  });

  it("只丢掉截断样本末尾那条残记录", () => {
    expect(parse('a,b\n"multi\nline",tail', true).rows).toEqual([["a", "b"]]);
    expect(parse('a,b\n"multi\n', true).rows).toEqual([["a", "b"]]);
    // 有换行结尾就说明这条是完整的，要留。
    expect(parse('a,b\n"multi\nline",tail\n', true).rows).toEqual([
      ["a", "b"],
      ["multi\nline", "tail"],
    ]);
    expect(parse("abc", true).rows).toEqual([]);
    expect(parse("﻿a\nb\n", true).rows).toEqual([["a"], ["b"]]);
    expect(parse("a\n\n", true).rows).toEqual([["a"], [""]]);
  });

  it("引号语法真的坏了就抛，前缀样本也一样", () => {
    expect(() => parse('a\n"unfinished')).toThrow();
    expect(() => parse('a\n"bad"x\n', true)).toThrow();
    expect(() => parse('a\n"bad"x\n')).toThrow();
  });

  it.each(["," as const, "\t" as const])(
    "分隔符 %j：未闭合引号字段里的 CR 不算记录边界",
    (delimiter) => {
      const prefix = `ID${delimiter}Note\r\n001${delimiter}good\r\n"hello\rworld\rthird`;
      const content = prefix + "x".repeat(1_048_576 - prefix.length);
      expect(parse(content, true, delimiter)).toEqual({
        rows: [
          ["ID", "Note"],
          ["001", "good"],
        ],
        columnCount: 2,
        limited: true,
        unevenRows: false,
      });
    },
  );

  it.each(["\r\n", "\n", "\r"])(
    "首字段是带引号的多行内容时仍能找到 %j 记录边界",
    (newline) => {
      expect(
        parse(
          `"hello\rworld\nwith ""quotes""",Note${newline}001,good${newline}`,
        ).rows,
      ).toEqual([
        ['hello\rworld\nwith "quotes"', "Note"],
        ["001", "good"],
      ]);
    },
  );

  it("不把无引号字段里的字面引号当成开引号", () => {
    expect(
      parse('inch",Note\r\n001,good\r\n"unfinished\ra\rb', true).rows,
    ).toEqual([
      ['inch"', "Note"],
      ["001", "good"],
    ]);
  });

  it("限记录数和列数，但 columnCount 报的是样本真实宽度", () => {
    const result = parse(
      Array.from({ length: 300 }, () =>
        Array.from({ length: 60 }, (_, i) => `${i}`).join(","),
      ).join("\n"),
    );
    expect(result.rows).toHaveLength(202);
    expect(result.rows.every((row) => row.length === 50)).toBe(true);
    expect(result.columnCount).toBe(60);
    expect(result.limited).toBe(true);
    expect(result.unevenRows).toBe(false);
  });

  it("不校验有界样本之外的内容", () => {
    expect(parse(`${"a\n".repeat(202)}"broken`).rows).toHaveLength(202);
  });
});
