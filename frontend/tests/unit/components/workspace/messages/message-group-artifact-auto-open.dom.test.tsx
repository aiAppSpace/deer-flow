import type { Message } from "@langchain/langgraph-sdk";
import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { act, cleanup, render } from "@testing-library/react";

import { MessageGroup } from "@/components/workspace/messages/message-group";
import { I18nContext } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";

const artifacts = rs.hoisted(() => ({
  select: rs.fn(),
  setOpen: rs.fn(),
  autoOpen: true,
  autoSelect: true,
  selectedArtifact: null as string | null,
}));
rs.mock("@/components/workspace/artifacts", () => ({
  useArtifacts: () => ({
    artifacts: [],
    selectedArtifact: artifacts.selectedArtifact,
    autoOpen: artifacts.autoOpen,
    autoSelect: artifacts.autoSelect,
    select: artifacts.select,
    setOpen: artifacts.setOpen,
  }),
}));

const write: Message = {
  id: "write-message",
  type: "ai",
  content: "",
  tool_calls: [
    {
      id: "write-call",
      name: "write_file",
      args: { path: "/mnt/user-data/outputs/report.md", content: "Report" },
    },
  ],
};
const result: Message = {
  id: "write-result",
  type: "tool",
  tool_call_id: "write-call",
  name: "write_file",
  content: "OK",
};
function view(messages: Message[], isLoading = true) {
  return (
    <I18nContext.Provider
      value={{ locale: "en-US", setLocale: () => undefined, t: enUS }}
    >
      <MessageGroup messages={messages} isLoading={isLoading} />
    </I18nContext.Provider>
  );
}
async function advance(ms: number) {
  await act(async () => {
    await rs.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  artifacts.select.mockClear();
  artifacts.setOpen.mockClear();
  artifacts.autoOpen = true;
  artifacts.autoSelect = true;
  artifacts.selectedArtifact = null;
});
afterEach(() => {
  cleanup();
  rs.useRealTimers();
});

describe("actual mounted artifact auto-open effect", () => {
  it("cancels a short pending write when its result arrives before 100ms", async () => {
    const mounted = render(view([write]));
    await advance(50);
    mounted.rerender(view([write, result]));
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
    expect(artifacts.setOpen).not.toHaveBeenCalled();
  });

  it("opens a still-last pending write only after the full 100ms", async () => {
    render(view([write]));
    await advance(99);
    expect(artifacts.select).not.toHaveBeenCalled();
    await advance(1);
    expect(artifacts.select).toHaveBeenCalledTimes(1);
    expect(artifacts.select).toHaveBeenCalledWith(
      expect.stringContaining("write-file:"),
      true,
    );
    expect(artifacts.setOpen).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("cancels when a different last tool takes over", async () => {
    const mounted = render(view([write]));
    await advance(50);
    mounted.rerender(
      view([
        write,
        {
          id: "read-message",
          type: "ai",
          content: "",
          tool_calls: [
            {
              id: "read-call",
              name: "read_file",
              args: { path: "/mnt/user-data/outputs/report.md" },
            },
          ],
        },
      ]),
    );
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
    expect(artifacts.setOpen).not.toHaveBeenCalled();
  });

  it("does not auto-open a completed ordinary historical write", async () => {
    render(view([write, result], false));
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
    expect(artifacts.setOpen).not.toHaveBeenCalled();
  });

  it("opens a successful finalize result independently of streaming", async () => {
    const finalize: Message = {
      id: "finalize-message",
      type: "ai",
      content: "",
      tool_calls: [
        {
          id: "finalize-call",
          name: "finalize_artifact_write",
          args: { path: "/mnt/user-data/outputs/report.md" },
        },
      ],
    };
    const finalized: Message = {
      id: "finalized",
      type: "tool",
      tool_call_id: "finalize-call",
      name: "finalize_artifact_write",
      content: "OK: artifact written",
    };
    render(view([finalize, finalized], false));
    await advance(100);
    expect(artifacts.select).toHaveBeenCalledExactlyOnceWith(
      "/mnt/user-data/outputs/report.md",
      true,
    );
    expect(artifacts.setOpen).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("cancels the pending selection when the mounted owner retires", async () => {
    const mounted = render(view([write]));
    await advance(50);
    mounted.unmount();
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
    expect(artifacts.setOpen).not.toHaveBeenCalled();
  });

  it("cancels when the run ends before the pending delay expires", async () => {
    const mounted = render(view([write]));
    await advance(50);
    mounted.rerender(view([write], false));
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
  });

  it("cancels when automatic selection is disabled", async () => {
    const mounted = render(view([write]));
    await advance(50);
    artifacts.autoSelect = false;
    mounted.rerender(view([write]));
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
  });

  it("does not select an already selected artifact again", async () => {
    artifacts.selectedArtifact =
      "write-file:/mnt/user-data/outputs/report.md?message_id=write-message&tool_call_id=write-call";
    render(view([write]));
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
  });

  it("does not treat a received empty result as a pending tool", async () => {
    render(view([write, { ...result, content: "" }]));
    await advance(200);
    expect(artifacts.select).not.toHaveBeenCalled();
  });

  it.each(["Permission denied", '{"ok":true}', ""])(
    "does not auto-open an unsuccessful finalize result: %s",
    async (content) => {
      render(
        view(
          [
            {
              id: "finalize-message",
              type: "ai",
              content: "",
              tool_calls: [
                {
                  id: "finalize-call",
                  name: "finalize_artifact_write",
                  args: { path: "/mnt/user-data/outputs/report.md" },
                },
              ],
            },
            {
              id: "finalized",
              type: "tool",
              tool_call_id: "finalize-call",
              content,
            },
          ],
          false,
        ),
      );
      await advance(200);
      expect(artifacts.select).not.toHaveBeenCalled();
    },
  );
});
