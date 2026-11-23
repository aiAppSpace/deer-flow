import { describe, expect, it } from "@rstest/core";

import { threadIdFromRequest } from "../../e2e/utils/thread-request";

describe("mock thread request identity", () => {
  it.each(["state", "history", "runs", "messages/page"])(
    "selects the complete thread segment for %s instead of a shorter prefix",
    (tail) => {
      const ids = [
        "tool-details",
        "tool-details-precise",
        "skill-history",
        "skill-history-old",
      ];
      for (const id of ids) {
        const url = `http://localhost/api/langgraph/threads/${id}/${tail}?other=tool-details`;
        expect(ids.find((item) => item === threadIdFromRequest(url))).toBe(id);
      }
    },
  );
  it("decodes escaped identity characters without matching a query or adjacent segment", () => {
    expect(
      threadIdFromRequest(
        "http://localhost/api/threads/agent%2Fthread%20one/messages/page?thread_id=other",
      ),
    ).toBe("agent/thread one");
    expect(
      threadIdFromRequest("http://localhost/api/models?thread_id=tool-details"),
    ).toBeUndefined();
  });
});
