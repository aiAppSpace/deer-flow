import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

afterEach(cleanup);

function fixture(onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>) {
  const readings: { root: number; prevented: boolean }[] = [];
  render(
    <div
      onKeyDown={(event) => {
        readings.push({
          root: screen.getByRole("group").tabIndex,
          prevented: event.defaultPrevented,
        });
      }}
    >
      <ToggleGroup type="single" defaultValue="preview" onKeyDown={onKeyDown}>
        <ToggleGroupItem value="source">Source</ToggleGroupItem>
        <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
        <input aria-label="Draft" defaultValue="abcdef" />
      </ToggleGroup>
    </div>,
  );
  return readings;
}

describe("ToggleGroup native back-out boundary", () => {
  it("publishes the requested back-out before the parent FocusScope reads its edges", () => {
    const caller = rs.fn();
    const readings = fixture(caller);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Preview" }), {
      key: "Tab",
      shiftKey: true,
    });
    expect(caller).toHaveBeenCalledTimes(1);
    expect(readings).toEqual([{ root: -1, prevented: false }]);
  });

  it("keeps the initial native group entry until an item has received focus", () => {
    fixture();
    expect(screen.getByRole("group").tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "Source" }).tabIndex).toBe(-1);
    expect(screen.getByRole("radio", { name: "Preview" }).tabIndex).toBe(-1);
  });

  it("runs the caller first and leaves its preventDefault decision intact", () => {
    const readings = fixture((event) => event.preventDefault());
    fireEvent.keyDown(screen.getByRole("radio", { name: "Preview" }), {
      key: "Tab",
      shiftKey: true,
    });
    expect(readings).toEqual([{ root: 0, prevented: true }]);
  });

  it.each([
    { key: "Tab" },
    { key: "ArrowLeft" },
    { key: "Home" },
    { key: "Tab", shiftKey: true, ctrlKey: true },
    { key: "Tab", shiftKey: true, altKey: true },
    { key: "Tab", shiftKey: true, metaKey: true },
  ])("leaves ordinary or modified $key ownership to Radix", (keys) => {
    const readings = fixture();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Preview" }), keys);
    expect(readings).toEqual([{ root: 0, prevented: keys.key !== "Tab" }]);
  });

  it("does not apply an item back-out to an embedded input", () => {
    const readings = fixture();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Draft" }), {
      key: "Tab",
      shiftKey: true,
    });
    expect(readings).toEqual([{ root: 0, prevented: false }]);
  });

  it("keeps a caller-owned root tab stop when roving focus is disabled", () => {
    const readings: number[] = [];
    render(
      <div onKeyDown={() => readings.push(screen.getByRole("group").tabIndex)}>
        <ToggleGroup type="single" rovingFocus={false} tabIndex={0}>
          <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
        </ToggleGroup>
      </div>,
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "Preview" }), {
      key: "Tab",
      shiftKey: true,
    });
    expect(readings).toEqual([0]);
  });

  it("supports the actual item DOM node provided through asChild", () => {
    const readings: number[] = [];
    render(
      <div onKeyDown={() => readings.push(screen.getByRole("group").tabIndex)}>
        <ToggleGroup type="single" defaultValue="report">
          <ToggleGroupItem value="report" asChild>
            <a href="#report">Report</a>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>,
    );
    const item = screen.getByRole("radio", { name: "Report" });
    expect(item.tagName).toBe("A");
    fireEvent.keyDown(item, { key: "Tab", shiftKey: true });
    expect(readings).toEqual([-1]);
  });

  it("only synchronizes the nearest group for nested item events", () => {
    const readings: [number, number][] = [];
    render(
      <div
        onKeyDown={() => {
          const groups = screen.getAllByRole("group");
          readings.push([groups[0]!.tabIndex, groups[1]!.tabIndex]);
        }}
      >
        <ToggleGroup type="single" defaultValue="outer">
          <ToggleGroupItem value="outer">Outer</ToggleGroupItem>
          <ToggleGroup type="single" defaultValue="inner">
            <ToggleGroupItem value="inner">Inner</ToggleGroupItem>
          </ToggleGroup>
        </ToggleGroup>
      </div>,
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "Inner" }), {
      key: "Tab",
      shiftKey: true,
    });
    expect(readings).toEqual([[0, -1]]);
  });
});
