/*
  【文件职责】     真实表格单元格的数据、复制与下载格式合同。
  【架构位置】     L2
  【主要导出】     extractTableData · serializeTable · copyTable · tableDownload
  【依赖关系】     通用 clipboard 适配 · DOM/Blob
  【边界与注意】   不读取消息、会话或后端；调用者提供自己的实际 table。
*/

import { installClipboardFallback } from "@/core/clipboard";

/** Streamdown table data contract. Read the rendered cells, not the Markdown input. */
export interface TableData {
  headers: string[];
  rows: string[][];
}

export type TableFormat = "markdown" | "csv" | "tsv";

export function extractTableData(table: HTMLTableElement): TableData {
  return {
    headers: Array.from(
      table.querySelectorAll("thead th"),
      (cell) => cell.textContent?.trim() ?? "",
    ),
    rows: Array.from(table.querySelectorAll("tbody tr"), (row) =>
      Array.from(
        row.querySelectorAll("td"),
        (cell) => cell.textContent?.trim() ?? "",
      ),
    ),
  };
}

function markdownCell(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|");
}

export function serializeTable(data: TableData, format: TableFormat): string {
  if (format === "markdown") {
    if (!data.headers.length) return "";
    const rows = data.rows.map((row) =>
      Array.from(
        { length: Math.max(row.length, data.headers.length) },
        (_, index) => markdownCell(row[index] ?? ""),
      ),
    );
    return [
      data.headers.map(markdownCell),
      data.headers.map(() => "---"),
      ...rows,
    ]
      .map((row) => `| ${row.join(" | ")} |`)
      .join("\n");
  }
  const rows = data.headers.length ? [data.headers, ...data.rows] : data.rows;
  const cell =
    format === "csv"
      ? (value: string) =>
          /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
      : (value: string) =>
          value
            .replaceAll("\t", "\\t")
            .replaceAll("\n", "\\n")
            .replaceAll("\r", "\\r");
  return rows
    .map((row) => row.map(cell).join(format === "csv" ? "," : "\t"))
    .join("\n");
}

export async function copyTable(
  table: HTMLTableElement,
  format: TableFormat,
): Promise<boolean> {
  installClipboardFallback();
  if (!navigator.clipboard?.write) return false;
  const item = new ClipboardItem({
    "text/plain": new Blob([serializeTable(extractTableData(table), format)], {
      type: "text/plain",
    }),
    "text/html": new Blob([table.outerHTML], { type: "text/html" }),
  });
  await navigator.clipboard.write([item]);
  return true;
}

export function tableDownload(
  table: HTMLTableElement,
  format: "markdown" | "csv",
) {
  const content = serializeTable(extractTableData(table), format);
  return {
    filename: format === "csv" ? "table.csv" : "table.md",
    blob: new Blob([format === "csv" ? `\uFEFF${content}` : content], {
      type: format === "csv" ? "text/csv" : "text/markdown",
    }),
  };
}
