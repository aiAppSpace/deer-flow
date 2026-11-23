import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyTable,
  extractTableData,
  serializeTable,
  tableDownload,
} from "@/core/markdown/table";

function makeTable() {
  const table = document.createElement("table");
  table.innerHTML =
    "<thead><tr><th> City </th><th>Weather</th></tr></thead><tbody><tr><td><strong>上海</strong></td><td>Sunny</td></tr></tbody>";
  return table;
}

let clipboardDescriptor: PropertyDescriptor | undefined;
beforeEach(() => {
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
});
afterEach(() => {
  if (clipboardDescriptor)
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  vi.unstubAllGlobals();
});

describe("rendered table data and exports", () => {
  it("extracts rendered cell text and trims cell boundaries", () => {
    expect(extractTableData(makeTable())).toEqual({
      headers: ["City", "Weather"],
      rows: [["上海", "Sunny"]],
    });
  });
  it("escapes Markdown pipes and backslashes, pads short rows and retains wide rows", () => {
    expect(
      serializeTable(
        { headers: ["A|B", "C\\D"], rows: [["one"], ["x", "y", "z"]] },
        "markdown",
      ),
    ).toBe("| A\\|B | C\\\\D |\n| --- | --- |\n| one |  |\n| x | y | z |");
  });
  it("keeps headerless CSV/TSV without inventing an empty header", () => {
    const data = { headers: [], rows: [["first", "second"]] };
    expect(serializeTable(data, "csv")).toBe("first,second");
    expect(serializeTable(data, "tsv")).toBe("first\tsecond");
    expect(serializeTable(data, "markdown")).toBe("");
  });
  it("preserves CSV quotes and newlines with CSV escaping", () => {
    expect(
      serializeTable(
        { headers: ["Name", "Note"], rows: [['a,"b"', "line1\nline2"]] },
        "csv",
      ),
    ).toBe('Name,Note\n"a,""b""","line1\nline2"');
  });
  it("escapes TSV tabs and line endings without silently dropping content", () => {
    expect(
      serializeTable({ headers: ["Name"], rows: [["a\tb\nc\rd"]] }, "tsv"),
    ).toBe("Name\na\\tb\\nc\\rd");
  });
  it("writes both plain text and the actual rendered HTML", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write, writeText: vi.fn() },
    });
    const table = makeTable();
    expect(await copyTable(table, "markdown")).toBe(true);
    const item = write.mock.calls[0]![0][0] as ClipboardItem;
    expect(await (await item.getType("text/plain")).text()).toBe(
      "| City | Weather |\n| --- | --- |\n| 上海 | Sunny |",
    );
    expect(await (await item.getType("text/html")).text()).toBe(
      table.outerHTML,
    );
  });
  it("keeps CSV BOM bytes for Excel and leaves Markdown without a BOM", async () => {
    const csv = tableDownload(makeTable(), "csv");
    const md = tableDownload(makeTable(), "markdown");
    expect(csv.filename).toBe("table.csv");
    expect(
      Array.from(new Uint8Array(await csv.blob.arrayBuffer()).slice(0, 3)),
    ).toEqual([0xef, 0xbb, 0xbf]);
    expect(md.filename).toBe("table.md");
    expect(await md.blob.text()).toBe(
      "| City | Weather |\n| --- | --- |\n| 上海 | Sunny |",
    );
  });
});
