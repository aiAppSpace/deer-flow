/*
  【文件职责】     解析一段**有界的** CSV/TSV 样本。
  【架构位置】     L3 纯函数（只在 Worker 里跑）
  【主要导出】     parseDelimitedPreview · DelimitedPreviewResult
  【依赖关系】     papaparse · ./delimited-preview-types
  【边界与注意】   **只在 Worker 里调用**：一份病态输入（超宽的未闭合引号记录）能让
                   解析长时间不返回，跑在主线程上界面就没了。

                   三处看起来像细节、实则承重：
                   1. `detectRecordNewline` 自己找换行，不用 Papa 的自动探测——
                      自动探测会把**未闭合引号字段里的 CR** 数进去，于是截断样本
                      被切成一堆错行。
                   2. Papa 在末尾分隔符之后会吐一条 EOF 空记录，它的 cursor 不前进；
                      靠 `nextCursor === cursor` 把它丢掉，而真正的空行会消耗自己的分隔符。
                   3. 输入被截断时，**末尾那条没有换行结尾的记录要丢掉**——
                      它是残的，显示出来就是一行凭空少了几列的数据。
*/

import Papa from "papaparse";

import {
  DELIMITED_COLUMN_LIMIT,
  DELIMITED_RECORD_LIMIT,
  type DelimitedPreviewInput,
  type DelimitedPreviewResult,
} from "./delimited-preview-types";

export type { DelimitedPreviewResult } from "./delimited-preview-types";

/** 找出第一个**在引号之外**的记录分隔符，截断样本上也要能找对。 */
function detectRecordNewline(
  content: string,
  delimiter: string,
): "\n" | "\r" | "\r\n" {
  let quoted = false;
  let fieldStart = true;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') index++;
        else quoted = false;
      }
      continue;
    }
    if (char === '"' && fieldStart) quoted = true;
    else if (char === "\r") return content[index + 1] === "\n" ? "\r\n" : "\r";
    else if (char === "\n") return "\n";
    fieldStart = char === delimiter;
  }
  // 没有完整的记录分隔符：Papa 仍会校验引号，残缺的末记录由下面那条规则丢掉。
  return "\n";
}

export function parseDelimitedPreview({
  content,
  delimiter,
  truncated,
}: DelimitedPreviewInput): DelimitedPreviewResult {
  // Papa 自己也会剥 BOM；这里先剥，好让 cursor 与 length 用同一套坐标。
  const input = content.startsWith("﻿") ? content.slice(1) : content;
  const result: DelimitedPreviewResult = {
    rows: [],
    columnCount: 0,
    limited: truncated,
    unevenRows: false,
  };
  let cursor = 0;
  let firstWidth: number | undefined;

  Papa.parse<string[]>(input, {
    delimiter,
    newline: detectRecordNewline(input, delimiter),
    header: false,
    dynamicTyping: false,
    skipEmptyLines: false,
    worker: false,
    download: false,
    step(record, parser) {
      const nextCursor = record.meta.cursor;
      const terminal = nextCursor === input.length;
      const incompleteQuotes =
        record.errors.length > 0 &&
        record.errors.every((error) => error.code === "MissingQuotes");
      if (record.errors.length > 0) {
        // 截断样本的最后一条记录引号没闭合是正常的，不是文件坏了。
        if (truncated && terminal && incompleteQuotes) {
          parser.abort();
          return;
        }
        throw new Error("Invalid delimited file syntax");
      }
      if (nextCursor === cursor) return;
      cursor = nextCursor;
      if (truncated && terminal && !input.endsWith(record.meta.linebreak)) {
        return;
      }
      const width = record.data.length;
      firstWidth ??= width;
      result.unevenRows ||= width !== firstWidth;
      result.columnCount = Math.max(result.columnCount, width);
      result.rows.push(record.data.slice(0, DELIMITED_COLUMN_LIMIT));
      if (result.rows.length === DELIMITED_RECORD_LIMIT) {
        result.limited ||= cursor < input.length;
        parser.abort();
      }
    },
  });

  return result;
}
