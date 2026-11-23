import { afterEach, describe, expect, it, rs } from "@rstest/core";

import type { LocalSettings } from "@/core/settings";
import { buildRunContext } from "@/core/threads/hooks";

const settings = {
  mode: "pro",
  model_name: "gemma4",
  reasoning_effort: undefined,
} as unknown as LocalSettings["context"];

describe("buildRunContext", () => {
  it("sends attached references as a plain string[] under context.conversation_references", () => {
    const context = buildRunContext({
      settings,
      extraContext: { agent_name: "writer" },
      conversationReferences: ["source-a", "source-b"],
    });
    expect(context.conversation_references).toEqual(["source-a", "source-b"]);
    expect(context.agent_name).toBe("writer");
    expect(context).not.toHaveProperty("thread_id");
    expect(context.is_plan_mode).toBe(true);
  });

  it("omits the key when nothing is attached, including on the replay path", () => {
    expect("conversation_references" in buildRunContext({ settings })).toBe(
      false,
    );
    expect(
      "conversation_references" in
        buildRunContext({
          settings,
          conversationReferences: [],
        }),
    ).toBe(false);
  });

  it("never forwards a stray conversation_references key from local settings", () => {
    const stale = {
      ...settings,
      conversation_references: ["stale-source"],
    } as unknown as LocalSettings["context"];
    expect(
      "conversation_references" in buildRunContext({ settings: stale }),
    ).toBe(false);
    expect(
      buildRunContext({
        settings: stale,
        conversationReferences: ["source-a"],
      }).conversation_references,
    ).toEqual(["source-a"]);
  });

  it("copies the list so later mutation of the caller's array cannot change the request", () => {
    const references = ["source-a"];
    const context = buildRunContext({
      settings,
      conversationReferences: references,
    });
    references.push("source-b");
    expect(context.conversation_references).toEqual(["source-a"]);
  });
});

describe("buildRunContext client_timezone", () => {
  afterEach(() => {
    rs.restoreAllMocks();
  });

  function mockResolvedTimeZone(timeZone: string | (() => never)) {
    const RealDateTimeFormat = Intl.DateTimeFormat;
    rs.spyOn(Intl, "DateTimeFormat").mockImplementation(((
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) => {
      const real = new RealDateTimeFormat(...args);
      return {
        ...real,
        resolvedOptions: () => {
          if (typeof timeZone === "function") {
            return timeZone();
          }
          return { ...real.resolvedOptions(), timeZone };
        },
      };
    }) as unknown as typeof Intl.DateTimeFormat);
  }

  it("sends the browser's zone for the scheduled-task default", () => {
    mockResolvedTimeZone("Asia/Shanghai");
    expect(buildRunContext({ settings }).client_timezone).toBe("Asia/Shanghai");
  });

  it("omits the key when the browser cannot tell", () => {
    mockResolvedTimeZone(() => {
      throw new RangeError("unsupported");
    });
    expect("client_timezone" in buildRunContext({ settings })).toBe(false);
  });

  it("omits the key for an empty zone", () => {
    mockResolvedTimeZone("");
    expect("client_timezone" in buildRunContext({ settings })).toBe(false);
  });
});

it("does not send server-owned thread identity from persisted or extra context", () => {
  const stale = {
    ...settings,
    thread_id: "stale-thread",
  } as unknown as LocalSettings["context"];
  const extraContext = Object.freeze({
    thread_id: "wrong-thread",
    agent_name: "writer",
  });
  const result = buildRunContext({
    settings: Object.freeze(stale),
    extraContext,
  });
  expect(result).not.toHaveProperty("thread_id");
  expect(result.agent_name).toBe("writer");
  expect(stale).toHaveProperty("thread_id", "stale-thread");
  expect(extraContext.thread_id).toBe("wrong-thread");
});
