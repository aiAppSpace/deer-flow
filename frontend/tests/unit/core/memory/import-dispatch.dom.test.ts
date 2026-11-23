import { beforeEach, afterEach, it, expect, rs } from "@rstest/core";

rs.mock("@/core/config", () => ({ getBackendBaseURL: rs.fn() }));
rs.mock("@/core/static-mode", () => ({ isStaticWebsiteOnly: rs.fn() }));
rs.mock("@/core/api/static-response", () => ({ staticApiResponse: rs.fn() }));
import { fetch as authenticatedFetch } from "@/core/api/fetcher";
import { staticApiResponse } from "@/core/api/static-response";
import { getBackendBaseURL } from "@/core/config";
import { importMemory } from "@/core/memory/api";
import { normalizeMemoryPayload } from "@/core/memory/import-memory";
import { isStaticWebsiteOnly } from "@/core/static-mode";
const documentPayload = () =>
  normalizeMemoryPayload({
    version: "1.0",
    lastUpdated: "",
    user: {},
    history: {},
    facts: [{ id: "literal", content: "private", confidence: 0.8 }],
  })!;
const nativeFetch = rs.fn<typeof globalThis.fetch>();
beforeEach(() => {
  rs.mocked(getBackendBaseURL).mockReturnValue("http://gateway");
  nativeFetch
    .mockReset()
    .mockImplementation(async () => Response.json(documentPayload()));
  rs.spyOn(globalThis, "fetch").mockImplementation(nativeFetch);
  document.cookie = "csrf_token=proof%2Ftoken; path=/";
  rs.mocked(isStaticWebsiteOnly).mockReturnValue(false);
  rs.mocked(staticApiResponse).mockReset();
});
afterEach(() => {
  document.cookie = "csrf_token=; Max-Age=0; path=/";
  rs.restoreAllMocks();
});
function send(
  memory: ReturnType<typeof documentPayload>,
  observer?: (
    memory: ReturnType<typeof documentPayload>,
    preAborted: boolean,
  ) => void,
  signal?: AbortSignal,
) {
  void signal;
  return importMemory(memory, observer);
}
it("observes only after the real authenticated fetcher prepares the unchanged native call", async () => {
  const memory = documentPayload();
  const order: string[] = [];
  const observer = rs.fn((actual, preAborted) => {
    expect(actual).toBe(memory);
    expect(preAborted).toBe(false);
    order.push("observe");
  });
  nativeFetch.mockImplementation(async () => {
    order.push("fetch");
    return Response.json(memory);
  });
  await send(memory, observer);
  expect(order).toEqual(["observe", "fetch"]);
  expect(observer).toHaveBeenCalledTimes(1);
  expect(nativeFetch).toHaveBeenCalledTimes(1);
  const [url, init] = nativeFetch.mock.calls[0]!;
  expect(url).toBe("http://gateway/api/memory/import");
  expect(init?.body).toBe(JSON.stringify(memory));
  expect(init?.method).toBe("POST");
  expect(init?.credentials).toBe("include");
  const headers = new Headers(init?.headers);
  expect([...headers]).toHaveLength(2);
  expect(headers.get("content-type")).toBe("application/json");
  expect(headers.get("x-csrf-token")).toBe("proof/token");
});
it("disabled and throwing observers preserve bytes, response, and call count", async () => {
  const memory = documentPayload();
  const off = await send(memory);
  const on = await send(memory, () => {
    throw new Error("diagnostics");
  });
  expect(on).toEqual(off);
  expect(nativeFetch).toHaveBeenCalledTimes(2);
  expect(nativeFetch.mock.calls[1]).toEqual(nativeFetch.mock.calls[0]);
});
it("serialization failure produces neither a notification nor a native call", async () => {
  const failure = new Error("toJSON");
  const memory = documentPayload();
  Object.defineProperty(memory, "toJSON", {
    value() {
      throw failure;
    },
  });
  const observer = rs.fn();
  await expect(send(memory, observer)).rejects.toBe(failure);
  expect(observer).not.toHaveBeenCalled();
  expect(nativeFetch).not.toHaveBeenCalled();
});
it("CSRF decode failure produces neither a notification nor a native call", async () => {
  document.cookie = "csrf_token=%E0%A4%A; path=/";
  const observer = rs.fn();
  await expect(send(documentPayload(), observer)).rejects.toBeInstanceOf(
    URIError,
  );
  expect(observer).not.toHaveBeenCalled();
  expect(nativeFetch).not.toHaveBeenCalled();
});
it("serializes exactly once and retains URL-before-body evaluation", async () => {
  const order: string[] = [];
  const memory = documentPayload();
  const bytes = JSON.stringify(memory);
  Object.defineProperty(memory, "toJSON", {
    value() {
      order.push("serialize");
      return JSON.parse(bytes);
    },
  });
  rs.mocked(getBackendBaseURL).mockImplementation(() => {
    order.push("url");
    return "http://gateway";
  });
  await send(memory, () => order.push("observe"));
  expect(order).toEqual(["url", "serialize", "observe"]);
  expect(nativeFetch.mock.calls[0]?.[1]?.body).toBe(bytes);
});
it("does not replace a transport rejection with an observer exception", async () => {
  const failure = new Error("transport");
  nativeFetch.mockRejectedValue(failure);
  await expect(
    send(documentPayload(), () => {
      throw new Error("diagnostic");
    }),
  ).rejects.toBe(failure);
  expect(nativeFetch).toHaveBeenCalledTimes(1);
});
it("pre-aborted native attempts retain the original signal and rejection", async () => {
  const controller = new AbortController();
  controller.abort();
  const failure = new DOMException("aborted", "AbortError");
  nativeFetch.mockRejectedValue(failure);
  const observer = rs.fn();
  await expect(
    authenticatedFetch(
      "/api/memory/import",
      { method: "POST", signal: controller.signal },
      observer,
    ),
  ).rejects.toBe(failure);
  expect(observer).toHaveBeenCalledWith(true);
  expect(nativeFetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  expect(nativeFetch).toHaveBeenCalledTimes(1);
});
it("a later abort does not rewrite the sampled state or prevent the native call", async () => {
  const controller = new AbortController();
  const observer = rs.fn((preAborted: boolean) => {
    expect(preAborted).toBe(false);
    controller.abort();
  });
  await authenticatedFetch(
    "/api/memory/import",
    { method: "POST", signal: controller.signal },
    observer,
  );
  expect(observer).toHaveBeenCalledTimes(1);
  expect(nativeFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});
it("disabled observation does not read signal.aborted, and an enabled getter exception cannot suppress fetch", async () => {
  const signal = new AbortController().signal;
  const read = rs.spyOn(signal, "aborted", "get").mockImplementation(() => {
    throw new Error("diagnostic getter");
  });
  await authenticatedFetch("/api/memory/import", { method: "POST", signal });
  expect(read).not.toHaveBeenCalled();
  const observer = rs.fn();
  await authenticatedFetch(
    "/api/memory/import",
    { method: "POST", signal },
    observer,
  );
  expect(read).toHaveBeenCalledTimes(1);
  expect(observer).not.toHaveBeenCalled();
  expect(nativeFetch).toHaveBeenCalledTimes(2);
});

it("a handled static response has no native attempt, and a static fallthrough does", async () => {
  rs.mocked(isStaticWebsiteOnly).mockReturnValue(true);
  rs.mocked(staticApiResponse)
    .mockResolvedValueOnce(Response.json(documentPayload()))
    .mockResolvedValueOnce(null);
  const observer = rs.fn();
  await send(documentPayload(), observer);
  expect(observer).not.toHaveBeenCalled();
  expect(nativeFetch).not.toHaveBeenCalled();
  await send(documentPayload(), observer);
  expect(observer).toHaveBeenCalledTimes(1);
  expect(nativeFetch).toHaveBeenCalledTimes(1);
});
