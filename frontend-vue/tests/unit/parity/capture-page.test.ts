import { EventEmitter } from "node:events";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import {
  createCapturePage,
  claimCapturePage,
} from "../../e2e-parity/support/capture-page";
import { PARITY_CONTEXT_OPTIONS } from "../../e2e-parity/support/context-options";

function fixture() {
  const page = new EventEmitter() as EventEmitter & Page;
  const context = new EventEmitter() as EventEmitter & BrowserContext;
  const close = vi.fn(async () => {});
  Object.assign(context, {
    close,
    newPage: vi.fn(async () => {
      context.emit("page", page);
      return page;
    }),
  });
  const newContext = vi.fn(async () => context);
  return {
    page,
    context,
    close,
    newContext,
    browser: { newContext } as unknown as Browser,
  };
}

describe("factory-owned fresh Page provenance", () => {
  it("creates the actual isolated context and consumes proof only once", async () => {
    const f = fixture();
    const owned = await createCapturePage(f.browser);
    expect(f.newContext).toHaveBeenCalledExactlyOnceWith(
      PARITY_CONTEXT_OPTIONS,
    );
    expect(owned.page).toBe(f.page);
    expect(owned.context).toBe(f.context);
    const proof = claimCapturePage(owned.page);
    proof.activate();
    expect(proof.snapshot()).toEqual({
      kind: "owned-fresh-page",
      ready: true,
      errors: [],
    });
    const second = claimCapturePage(owned.page);
    second.activate();
    expect(second.snapshot().errors).toContain(
      "fresh page proof was already consumed",
    );
    expect(proof.snapshot().errors).toContain(
      "fresh page proof was already consumed",
    );
    proof.dispose();
    await owned.close();
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(f.context.listenerCount("request")).toBe(0);
    expect(f.context.listenerCount("page")).toBe(0);
    expect(f.page.listenerCount("framenavigated")).toBe(0);
  });
  it("does not grant proof to an arbitrary existing Page", () => {
    const f = fixture();
    const proof = claimCapturePage(f.page);
    proof.activate();
    proof.dispose();
    expect(proof.snapshot()).toEqual({
      kind: "unproven",
      ready: false,
      errors: [],
    });
  });
  it.each(["before-claim", "during-install"])(
    "retains request/navigation violations %s",
    async (phase) => {
      const f = fixture();
      const owned = await createCapturePage(f.browser);
      let proof =
        phase === "during-install" ? claimCapturePage(owned.page) : undefined;
      f.context.emit("request", {});
      f.page.emit("framenavigated", {});
      proof ??= claimCapturePage(owned.page);
      proof.activate();
      expect(proof.snapshot().errors).toEqual([
        "request before capture observation was ready",
        "navigation before capture observation was ready",
      ]);
      proof.dispose();
      await owned.close();
    },
  );
  it("guards activity during newPage itself and never clears it at claim", async () => {
    const f = fixture();
    vi.mocked(f.context.newPage).mockImplementationOnce(async () => {
      f.context.emit("page", f.page);
      f.context.emit("request", {});
      return f.page;
    });
    const owned = await createCapturePage(f.browser);
    const proof = claimCapturePage(owned.page);
    proof.activate();
    expect(proof.snapshot().errors).toContain(
      "request before capture observation was ready",
    );
    await owned.close();
  });
  it("leaves active traffic to the existing census but rejects additional pages", async () => {
    const f = fixture();
    const owned = await createCapturePage(f.browser);
    const proof = claimCapturePage(owned.page);
    proof.activate();
    f.context.emit("request", {});
    f.page.emit("framenavigated", {});
    expect(proof.snapshot().errors).toEqual([]);
    const other = new EventEmitter();
    f.context.emit("page", other);
    expect(proof.snapshot().errors).toEqual([
      "fresh capture context acquired an additional page",
    ]);
    await owned.close();
    expect(other.listenerCount("framenavigated")).toBe(0);
  });
  it("closes the context when newPage fails and preserves both cleanup and original failures", async () => {
    const f = fixture();
    const original = new Error("newPage failed");
    const cleanup = new Error("close failed");
    vi.mocked(f.context.newPage).mockRejectedValueOnce(original);
    f.close.mockRejectedValueOnce(cleanup);
    const result = await createCapturePage(f.browser).catch((error) => error);
    expect(result).toBeInstanceOf(AggregateError);
    expect(result.errors).toEqual([original, cleanup]);
    expect(result.cause).toBe(original);
    expect(f.context.listenerCount("request")).toBe(0);
    expect(f.context.listenerCount("page")).toBe(0);
  });
  it("retires an unused factory proof when its owner closes", async () => {
    const f = fixture();
    const owned = await createCapturePage(f.browser);
    await owned.close();
    const proof = claimCapturePage(owned.page);
    proof.activate();
    expect(proof.snapshot().ready).toBe(false);
    expect(proof.snapshot().errors).toContain(
      "fresh page proof was closed before capture",
    );
  });
});
