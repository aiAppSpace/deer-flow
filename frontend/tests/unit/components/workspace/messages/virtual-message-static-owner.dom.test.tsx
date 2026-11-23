import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rs,
  test,
} from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useCallback, useState } from "react";

import { VirtualMessageList } from "@/components/workspace/messages/virtual-message-list";
import type { MessageGroup } from "@/core/messages/utils";

// Keep the actual TanStack hook/core. Only the existing follow owner's public
// context is supplied by this host, whose parent ref commits after the child.
const ports = rs.hoisted(() => ({
  stopScroll: rs.fn(),
  scrollToBottom: rs.fn(async () => true),
  scrollRef: { current: null as HTMLDivElement | null },
  isAtBottom: false,
}));
rs.mock("use-stick-to-bottom", () => ({
  useStickToBottomContext: () => ports,
}));

const groups = (count: number): MessageGroup[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `human-${index}`,
    type: "human",
    messages: [{ id: `human-${index}`, type: "human", content: "History" }],
  }));
const scrollWrites = rs.fn();
function Host({
  count,
  tailRequest = 0,
}: {
  count: number;
  tailRequest?: number;
}) {
  const [, updateFollowContext] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const attach = useCallback((element: HTMLDivElement | null) => {
    ports.scrollRef.current = element;
    if (!element) return;
    Object.defineProperties(element, {
      clientHeight: { configurable: true, value: 400 },
      offsetHeight: { configurable: true, value: 400 },
      offsetWidth: { configurable: true, value: 800 },
    });
    element.getBoundingClientRect = () => new DOMRect(0, 0, 800, 400);
    element.scrollTo = (options: ScrollToOptions | number = {}, y?: number) => {
      const top = typeof options === "number" ? (y ?? 0) : (options.top ?? 0);
      scrollWrites(top);
      element.scrollTop = top;
    };
  }, []);
  ports.stopScroll.mockImplementation(() => {
    ports.isAtBottom = false;
    updateFollowContext((value) => value + 1);
  });
  return (
    <div ref={attach}>
      <VirtualMessageList
        groups={groups(count)}
        isLoading={false}
        tailRequest={tailRequest}
        renderGroup={(group) => (
          <button onClick={() => setExpanded((value) => !value)}>
            {group.id}: {expanded ? "Opened" : "Details"}
          </button>
        )}
      />
    </div>
  );
}

beforeEach(() => {
  ports.scrollRef.current = null;
  ports.isAtBottom = false;
  ports.stopScroll.mockReset();
  ports.scrollToBottom.mockClear();
  scrollWrites.mockClear();
  // happy-dom has no layout engine. Supply the estimated physical row height
  // to the real virtualizer, so zero-sized synthetic rows cannot move reading.
  rs.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.dataset.index === undefined ? 0 : 176;
    },
  );
  rs.stubGlobal(
    "ResizeObserver",
    class {
      observed = new Set<Element>();
      observe(element: Element) {
        this.observed.add(element);
      }
      unobserve(element: Element) {
        this.observed.delete(element);
      }
      disconnect() {
        this.observed.clear();
      }
    },
  );
});
afterEach(() => {
  cleanup();
  ports.scrollRef.current = null;
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
});

describe("static transcript has no virtual scroll writer", () => {
  test("late parent ref and first reading focus preserve the static viewport and disclosure node", () => {
    render(<Host count={3} />);
    const viewport = ports.scrollRef.current!;
    viewport.scrollTop = 270;
    scrollWrites.mockClear();
    const trigger = screen.getByRole("button", { name: "human-1: Details" });
    act(() => trigger.focus());
    expect(ports.stopScroll).toHaveBeenCalledTimes(1);
    expect(viewport.scrollTop).toBe(270);
    expect(scrollWrites).not.toHaveBeenCalled();
    expect(ports.scrollRef.current).toBe(viewport);
    expect(screen.getByRole("button", { name: "human-1: Details" })).toBe(
      trigger,
    );
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "human-1: Opened" })).toBe(
      trigger,
    );
    expect(viewport.scrollTop).toBe(270);
  });

  test("activating measured rows at the real threshold adopts the existing reading offset", () => {
    const host = render(<Host count={59} />);
    const viewport = ports.scrollRef.current!;
    viewport.scrollTop = 270;
    scrollWrites.mockClear();
    host.rerender(<Host count={60} />);
    expect(ports.scrollRef.current).toBe(viewport);
    expect(viewport.scrollTop).toBe(270);
    expect(scrollWrites.mock.calls.every(([top]) => top === 270)).toBe(true);
    expect(ports.scrollToBottom).not.toHaveBeenCalled();
    host.rerender(<Host count={59} />);
    viewport.scrollTop = 420;
    scrollWrites.mockClear();
    act(() => screen.getByRole("button", { name: "human-1: Details" }).focus());
    expect(viewport.scrollTop).toBe(420);
    expect(scrollWrites).not.toHaveBeenCalled();
  });

  test("a static rerender never restores following without an explicit tail request", () => {
    const host = render(<Host count={3} tailRequest={0} />);
    const viewport = ports.scrollRef.current!;
    viewport.scrollTop = 270;
    scrollWrites.mockClear();
    host.rerender(<Host count={4} tailRequest={0} />);
    expect(viewport.scrollTop).toBe(270);
    expect(scrollWrites).not.toHaveBeenCalled();
    expect(ports.scrollToBottom).not.toHaveBeenCalled();
    host.rerender(<Host count={4} tailRequest={1} />);
    expect(ports.scrollToBottom).toHaveBeenCalledExactlyOnceWith({
      animation: "instant",
    });
  });
});
