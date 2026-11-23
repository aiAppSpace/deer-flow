import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useThreadChat } from "@/components/workspace/chats/use-thread-chat";

const { route, mint } = rs.hoisted(() => ({
  route: { pathname: "/workspace/chats/new", paramsId: "new", search: "" },
  mint: rs.fn(),
}));
rs.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useParams: () => ({ thread_id: route.paramsId }),
  useSearchParams: () => new URLSearchParams(route.search),
}));
rs.mock("@/core/utils/uuid", () => ({ uuid: mint }));

function navigate(pathname: string, paramsId: string, search = "") {
  route.pathname = pathname;
  route.paramsId = paramsId;
  route.search = search;
  window.history.replaceState(
    null,
    "",
    pathname + (search ? `?${search}` : ""),
  );
}

beforeEach(() => {
  mint.mockReset();
  let serial = 0;
  mint.mockImplementation(() => `draft-${++serial}`);
  navigate("/workspace/chats/new", "new");
});
afterEach(cleanup);

it.each([
  "/workspace/chats/%6Eew",
  "/workspace/agents/writer/chats/%6Eew",
  "/workspace/chats/new/",
])("keeps one decoded new-route owner across ordinary renders: %s", (path) => {
  navigate(path, "new");
  const view = renderHook(() => useThreadChat());
  const first = view.result.current.threadId;
  view.rerender();
  expect(view.result.current.threadId).toBe(first);
  expect(view.result.current.isNewThread).toBe(true);
  expect(mint).toHaveBeenCalledTimes(1);
});

it.each([
  ["/workspace/chats/thread%2Done", "thread-one"],
  ["/workspace/chats/%256Eew", "%6Eew"],
])(
  "decodes a persisted route once without creating a draft: %s",
  (path, id) => {
    navigate(path, "new");
    const view = renderHook(() => useThreadChat());
    expect(view.result.current.threadId).toBe(id);
    expect(view.result.current.isNewThread).toBe(false);
    view.rerender();
    expect(view.result.current.threadId).toBe(id);
    expect(mint).not.toHaveBeenCalled();
  },
);

it.each([
  "/workspace/chats/persisted-thread",
  "/workspace/agents/writer/chats/persisted-thread",
  "/showcase/persisted-thread",
])(
  "restores the existing owner on the first render despite stale new params: %s",
  (path) => {
    navigate(path, "new");
    const renders: { id: string; isNew: boolean }[] = [];
    const view = renderHook(() => {
      const chat = useThreadChat();
      renders.push({ id: chat.threadId, isNew: chat.isNewThread });
      return chat;
    });
    expect(renders.length).toBeGreaterThan(0);
    expect(
      renders.every((value) => value.id === "persisted-thread" && !value.isNew),
    ).toBe(true);
    expect(view.result.current.isMock).toBe(path.startsWith("/showcase/"));
    expect(mint).not.toHaveBeenCalled();
  },
);

it("keeps the prepared owner during native adoption and restores it after leaving", () => {
  const view = renderHook(() => useThreadChat());
  const id = view.result.current.threadId;
  expect(id).toBe("draft-1");
  act(() => {
    navigate(`/workspace/chats/${id}`, "new");
    view.result.current.setThreadId(id);
    view.result.current.setIsNewThread(false);
  });
  view.rerender();
  expect(view.result.current.threadId).toBe(id);
  expect(view.result.current.isNewThread).toBe(false);
  view.unmount();
  // A fresh mounted consumer is essential: same-mount adoption already worked.
  const returned = renderHook(() => useThreadChat());
  expect(returned.result.current.threadId).toBe(id);
  expect(returned.result.current.isNewThread).toBe(false);
  expect(mint).toHaveBeenCalledTimes(1);
});

it("retains direct deep links and follows a different persisted pathname", () => {
  navigate("/workspace/chats/thread-a", "thread-a");
  const view = renderHook(() => useThreadChat());
  expect(view.result.current.threadId).toBe("thread-a");
  navigate("/workspace/chats/thread-b", "thread-a");
  view.rerender();
  expect(view.result.current.threadId).toBe("thread-b");
  expect(view.result.current.isNewThread).toBe(false);
  expect(mint).not.toHaveBeenCalled();
});

it("still creates a fresh draft when the new-chat project scope changes", () => {
  navigate("/workspace/chats/new", "new", "project=alpha");
  const view = renderHook(() => useThreadChat());
  const before = view.result.current.threadId;
  navigate("/workspace/chats/new", "new", "project=beta");
  view.rerender();
  expect(view.result.current.threadId).not.toBe(before);
  expect(view.result.current.isNewThread).toBe(true);
});

it("keeps one new owner when the reactive pathname precedes the browser URL commit", () => {
  navigate("/workspace/chats/thread-a", "thread-a");
  route.pathname = "/workspace/chats/new";
  route.paramsId = "new";
  const owners: string[] = [];
  const view = renderHook(() => {
    const chat = useThreadChat();
    owners.push(chat.threadId);
    return chat;
  });
  expect(owners.every((id) => id === "draft-1")).toBe(true);
  navigate("/workspace/chats/new", "new");
  view.rerender();
  expect(view.result.current.threadId).toBe("draft-1");
  expect(view.result.current.isNewThread).toBe(true);
  expect(mint).toHaveBeenCalledTimes(1);
});

it.each([
  "/workspace/chats/persisted-thread",
  "/workspace/agents/writer/chats/persisted-thread",
  "/showcase/persisted-thread",
])(
  "does not let the leaving new URL override the arriving owner: %s",
  (path) => {
    route.pathname = path;
    route.paramsId = "persisted-thread";
    const owners: { id: string; isNew: boolean; isMock: boolean }[] = [];
    renderHook(() => {
      const chat = useThreadChat();
      owners.push({
        id: chat.threadId,
        isNew: chat.isNewThread,
        isMock: chat.isMock,
      });
      return chat;
    });
    expect(
      owners.every((owner) => owner.id === "persisted-thread" && !owner.isNew),
    ).toBe(true);
    expect(
      owners.every((owner) => owner.isMock === path.startsWith("/showcase/")),
    ).toBe(true);
    expect(mint).not.toHaveBeenCalled();
  },
);

it("retains an accepted local run before the reactive pathname catches up", () => {
  const view = renderHook(() => useThreadChat());
  const id = view.result.current.threadId;
  act(() => {
    window.history.replaceState(null, "", `/workspace/chats/${id}`);
    view.result.current.setThreadId(id);
    view.result.current.setIsNewThread(false);
  });
  expect(route.pathname).toBe("/workspace/chats/new");
  expect(view.result.current.threadId).toBe(id);
  expect(view.result.current.isNewThread).toBe(false);
  expect(mint).toHaveBeenCalledTimes(1);
});

it("captures the initial new project even before the browser commits its URL", () => {
  navigate("/workspace/chats/thread-a", "thread-a");
  route.pathname = "/workspace/chats/new";
  route.paramsId = "new";
  route.search = "project=alpha";
  const view = renderHook(() => useThreadChat());
  const first = view.result.current.threadId;
  window.history.replaceState(null, "", "/workspace/chats/new?project=alpha");
  navigate("/workspace/chats/new", "new", "project=beta");
  view.rerender();
  expect(view.result.current.threadId).not.toBe(first);
  expect(view.result.current.isNewThread).toBe(true);
});

it("does not treat a departing non-chat new path as another chat draft", () => {
  navigate("/workspace/chats/thread-a", "thread-a");
  const view = renderHook(() => useThreadChat());
  navigate("/workspace/agents/new", "thread-a");
  view.rerender();
  expect(view.result.current.threadId).toBe("thread-a");
  expect(view.result.current.isNewThread).toBe(false);
  expect(mint).not.toHaveBeenCalled();
});
