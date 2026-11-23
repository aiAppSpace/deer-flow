import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rs,
  test,
} from "@rstest/core";
import { act, cleanup, render } from "@testing-library/react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { VirtualMessageList } from "@/components/workspace/messages/virtual-message-list";
import type { MessageGroup } from "@/core/messages/utils";

import reference from "./fixtures/conversation-initial-motion.json";

const frames = new Map<number, FrameRequestCallback>();
const observers = new Set<{
  callback: ResizeObserverCallback;
  targets: Set<Element>;
}>();
let frameId = 0;
let now = 0;
let contentHeight = 3000;
const positions = new WeakMap<HTMLElement, number>();
const groups: MessageGroup[] = Array.from({ length: 5 }, (_, index) => ({
  id: `motion-${index}`,
  type: "human",
  messages: [{ id: `motion-${index}`, type: "human", content: "History" }],
}));

beforeEach(() => {
  frames.clear();
  observers.clear();
  frameId = 0;
  now = 0;
  contentHeight = 3000;
  rs.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  rs.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  rs.spyOn(performance, "now").mockImplementation(() => now);
  rs.spyOn(Date, "now").mockImplementation(() => 100000 + now);
  rs.stubGlobal(
    "ResizeObserver",
    class {
      targets = new Set<Element>();
      constructor(public callback: ResizeObserverCallback) {
        observers.add(this);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
      disconnect() {
        this.targets.clear();
        observers.delete(this);
      }
    },
  );
  rs.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  rs.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
  rs.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  rs.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    () => contentHeight,
  );
  rs.spyOn(HTMLElement.prototype, "scrollTop", "get").mockImplementation(
    function (this: HTMLElement) {
      return positions.get(this) ?? 0;
    },
  );
  rs.spyOn(HTMLElement.prototype, "scrollTop", "set").mockImplementation(
    function (this: HTMLElement, value: number) {
      positions.set(
        this,
        Math.round(Math.max(0, Math.min(contentHeight - 600, value))),
      );
    },
  );
  rs.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, 800, 600),
  );
});
afterEach(() => {
  cleanup();
  frames.clear();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
  rs.useRealTimers();
});
function Host({ count = 5 }: { count?: number }) {
  return (
    <Conversation>
      <ConversationContent>
        <VirtualMessageList
          groups={groups.slice(0, count)}
          isLoading={false}
          renderGroup={(group) => <p>{group.id}</p>}
        />
      </ConversationContent>
    </Conversation>
  );
}
async function step(delta: number) {
  now += delta;
  const pending = [...frames.values()];
  frames.clear();
  await act(async () => {
    pending.forEach((callback) => callback(now));
  });
}
async function resize(content: Element) {
  await act(async () => {
    for (const observer of [...observers])
      if (observer.targets.has(content)) {
        observer.callback(
          [
            {
              target: content,
              contentRect: new DOMRect(0, 0, 800, contentHeight),
              borderBoxSize: [{ blockSize: contentHeight, inlineSize: 800 }],
            } as unknown as ResizeObserverEntry,
          ],
          observer as unknown as ResizeObserver,
        );
      }
  });
}
describe("actual conversation initial motion reference", () => {
  test.each([true, false])(
    "keeps following a same-cycle resize and upward offset, with ResizeObserver first=%s",
    async (resizeFirst) => {
      rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const view = render(<Host />);
      const viewport =
        view.container.querySelector<HTMLElement>('[role="log"] > div')!;
      const content = viewport.firstElementChild!;
      await resize(content);
      for (let i = 0; i < 5; i++) {
        await step(1000 / 60);
        await act(() => rs.advanceTimersByTimeAsync(2));
      }
      contentHeight += 100;
      if (resizeFirst) await resize(content);
      viewport.scrollTop -= 80;
      await act(async () => {
        viewport.dispatchEvent(new Event("scroll"));
      });
      if (!resizeFirst) await resize(content);
      await act(() => rs.advanceTimersByTimeAsync(2));
      const changed = viewport.scrollTop;
      for (let i = 0; i < 30; i++) {
        await step(1000 / 60);
        await act(() => rs.advanceTimersByTimeAsync(2));
      }
      expect(viewport.scrollTop).toBeGreaterThan(changed);
    },
  );
  test.each([true, false])(
    "external upward scroll exits actual React following, with prior own event delivered=%s",
    async (deliverOwn) => {
      rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const view = render(<Host />);
      const viewport =
        view.container.querySelector<HTMLElement>('[role="log"] > div')!;
      const content = viewport.firstElementChild!;
      await resize(content);
      for (let i = 0; i < 5; i++) {
        await step(1000 / 60);
        await act(() => rs.advanceTimersByTimeAsync(2));
      }
      expect(viewport.scrollTop).toBeGreaterThan(80);
      if (deliverOwn) {
        await act(async () => {
          viewport.dispatchEvent(new Event("scroll"));
        });
        await act(() => rs.advanceTimersByTimeAsync(2));
      }
      viewport.scrollTop -= 80;
      await act(async () => {
        viewport.dispatchEvent(new Event("scroll"));
      });
      await act(() => rs.advanceTimersByTimeAsync(2));
      const reading = viewport.scrollTop;
      for (let i = 0; i < 30; i++) {
        await step(1000 / 60);
        await act(() => rs.advanceTimersByTimeAsync(2));
      }
      expect(viewport.scrollTop).toBe(reading);
    },
  );
  for (const { name, deltas, trace: expected } of reference.rows)
    test(name, async () => {
      const view = render(<Host />);
      const viewport =
        view.container.querySelector<HTMLElement>('[role="log"] > div')!;
      const content = viewport.firstElementChild!;
      expect(viewport.scrollTop).toBe(0);
      await resize(content);
      expect(viewport.scrollTop).toBe(0);
      const trace: number[] = [];
      for (const delta of deltas) {
        await step(delta);
        trace.push(viewport.scrollTop);
      }
      expect(trace).toEqual(expected);
      expect(trace.some((value) => value > 0 && value < 2399)).toBe(true);
      for (let i = 0; i < 200 && frames.size; i++) await step(1000 / 60);
      expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
    });
  for (const {
    emptyHeight,
    before: expectedBefore,
    trace: expectedTrace,
  } of reference.asyncRows)
    test(`observe asynchronous initial content after empty height ${emptyHeight}`, async () => {
      contentHeight = emptyHeight;
      const view = render(<Host count={0} />);
      const viewport =
        view.container.querySelector<HTMLElement>('[role="log"] > div')!;
      const content = viewport.firstElementChild!;
      await resize(content);
      await step(1000 / 60);
      const before = viewport.scrollTop;
      contentHeight = 3000;
      view.rerender(<Host count={5} />);
      await resize(content);
      const trace: number[] = [];
      for (let i = 0; i < 12; i++) {
        await step(1000 / 60);
        trace.push(viewport.scrollTop);
      }
      expect(before).toBe(expectedBefore);
      expect(trace).toEqual(expectedTrace);
      expect(view.container.querySelector('[role="log"] > div')).toBe(viewport);
    });
});
