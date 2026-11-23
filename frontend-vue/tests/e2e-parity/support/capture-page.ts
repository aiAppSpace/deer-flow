import type { Browser, BrowserContext, Page } from "@playwright/test";
import { PARITY_CONTEXT_OPTIONS } from "./context-options";

export type FreshPageSnapshot = {
  kind: "owned-fresh-page" | "unproven";
  ready: boolean;
  errors: string[];
};
type Proof = {
  activate(): void;
  snapshot(): FreshPageSnapshot;
  dispose(): void;
};
type Record = Proof & { claim(): Proof };
const proofs = new WeakMap<Page, Record>();

/** This constructor, never a caller's boolean or current URL, supplies the
 * fresh-page fact. It owns only the context that it actually creates. */
export async function createCapturePage(browser: Browser) {
  const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
  let phase: "pre" | "active" | "closed" = "pre";
  let claimed = false;
  let ready = false;
  const errors: string[] = [];
  const pages = new Set<Page>();
  const fail = (reason: string) => {
    if (!errors.includes(reason)) errors.push(reason);
  };
  const onRequest = () => {
    if (phase === "pre") fail("request before capture observation was ready");
  };
  const onNavigation = () => {
    if (phase === "pre")
      fail("navigation before capture observation was ready");
  };
  const onPage = (page: Page) => {
    if (pages.has(page)) return;
    if (pages.size) {
      fail("fresh capture context acquired an additional page");
      return;
    }
    pages.add(page);
    page.on("framenavigated", onNavigation);
  };
  // Guard the newPage await as well as the later identity-install await. No
  // request data or body is read here; active traffic belongs to the census.
  context.on("request", onRequest);
  context.on("page", onPage);
  const record: Record = {
    claim() {
      if (claimed) fail("fresh page proof was already consumed");
      if (phase === "closed")
        fail("fresh page proof was closed before capture");
      claimed = true;
      return record;
    },
    activate() {
      if (!claimed || phase !== "pre") return;
      phase = "active";
      ready = true;
    },
    snapshot() {
      return { kind: "owned-fresh-page", ready, errors: [...errors] };
    },
    dispose() {
      if (phase === "closed") return;
      phase = "closed";
      const failures: unknown[] = [];
      const remove = (work: () => void) => {
        try {
          work();
        } catch (error) {
          failures.push(error);
        }
      };
      remove(() => {
        context.off("request", onRequest);
      });
      remove(() => {
        context.off("page", onPage);
      });
      for (const page of pages)
        remove(() => {
          page.off("framenavigated", onNavigation);
        });
      pages.clear();
      if (failures.length) {
        fail("fresh page guard cleanup failed");
        throw new AggregateError(failures, "Fresh page guard cleanup failed", {
          cause: failures[0],
        });
      }
    },
  };
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    const failures: unknown[] = [];
    try {
      record.dispose();
    } catch (error) {
      failures.push(error);
    }
    try {
      await context.close();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length)
      throw new AggregateError(failures, "Owned capture cleanup failed", {
        cause: failures[0],
      });
  };
  try {
    const page = await context.newPage();
    if (!pages.has(page))
      throw new Error("Fresh page creation had no context page event");
    proofs.set(page, record);
    return { context, page, close } satisfies {
      context: BrowserContext;
      page: Page;
      close(): Promise<void>;
    };
  } catch (error) {
    const failures: unknown[] = [error];
    try {
      await close();
    } catch (cleanup) {
      failures.push(cleanup);
    }
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        "Fresh page construction and cleanup failed",
        { cause: error },
      );
    throw error;
  }
}

/** Ordinary callers can still capture raw evidence, but do not acquire fresh
 * provenance. A factory proof is one-use even if installation later fails. */
export function claimCapturePage(page: Page): Proof {
  return (
    proofs.get(page)?.claim() ?? {
      activate() {},
      snapshot: () => ({ kind: "unproven", ready: false, errors: [] }),
      dispose() {},
    }
  );
}
