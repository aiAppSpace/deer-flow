import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rs,
  test,
} from "@rstest/core";
import { cleanup, render, screen } from "@testing-library/react";

import { VirtualMessageList } from "@/components/workspace/messages/virtual-message-list";
import type { MessageGroup } from "@/core/messages/utils";

const ports = rs.hoisted(() => ({
  stopScroll: rs.fn(),
  scrollToBottom: rs.fn(async () => true),
  scrollRef: { current: null as HTMLDivElement | null },
  isAtBottom: true,
}));
const measurement = rs.hoisted(() => ({
  getVirtualItems: () => [{ index: 0, key: "human-0", start: 0, end: 176 }],
  getTotalSize: () => 176,
  scrollOffset: 0,
  scrollToIndex: rs.fn(),
  scrollToOffset: rs.fn(),
  measureElement: rs.fn(),
}));
rs.mock("use-stick-to-bottom", () => ({
  useStickToBottomContext: () => ports,
}));
rs.mock("@tanstack/react-virtual", () => ({
  defaultRangeExtractor: () => [0],
  useVirtualizer: () => measurement,
}));

const group = (id: string): MessageGroup => ({
  id,
  type: "human",
  messages: [{ id, type: "human", content: id }],
});
const props = (groups: MessageGroup[]) => ({
  groups,
  isLoading: false,
  renderGroup: (item: MessageGroup) => <button>{item.id}</button>,
});

beforeEach(() => {
  ports.stopScroll.mockClear();
  ports.scrollToBottom.mockClear();
  ports.isAtBottom = true;
  ports.scrollRef.current = document.createElement("div");
  document.body.append(ports.scrollRef.current);
});
afterEach(() => {
  cleanup();
  ports.scrollRef.current?.remove();
});

describe("physical message follow owner and reading focus", () => {
  for (const count of [1, 60]) {
    test(`focus stops an active tail animation without replacing ${count} measured rows`, () => {
      const groups = Array.from({ length: count }, (_, i) =>
        group(`human-${i}`),
      );
      const { container } = render(<VirtualMessageList {...props(groups)} />);
      const list = container.firstElementChild;
      expect(ports.stopScroll).not.toHaveBeenCalled();
      screen.getByRole("button", { name: "human-0" }).focus();
      expect(ports.stopScroll).toHaveBeenCalledTimes(1);
      expect(container.firstElementChild).toBe(list);
    });
  }

  test("does not stop follow when focus belongs to the composer outside message rows", () => {
    render(
      <>
        <VirtualMessageList {...props([group("old")])} />
        <button>Composer</button>
      </>,
    );
    screen.getByRole("button", { name: "Composer" }).focus();
    expect(ports.stopScroll).not.toHaveBeenCalled();
  });
});
