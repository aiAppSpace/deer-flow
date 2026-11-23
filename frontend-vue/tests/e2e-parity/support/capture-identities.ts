import { randomUUID } from "node:crypto";
import type { Page, Frame, Request, Response } from "@playwright/test";
import { installIdentityDocument } from "./identity-document";
import {
  createIdentityLedger,
  FIELDS,
  PRODUCERS,
  MAX_ROWS,
  MAX_DOCUMENTS,
  type DocumentSeed,
  MAX_TEXT,
  type IdentityReceipt,
  type IdentitySnapshot,
  type Seed,
} from "./identity-receipts";

// Harness resource ownership only. No framework imports, product setters,
// storage, fetch/UUID wrappers, response-body readers or route interception.
const CAPABILITY = "__deerflow_parity_capture_v1__";
const CONTROL = "__deerflow_parity_transport_v1__";
const BINDING = "__deerflow_parity_receipt_v1__";
const EVENT = "deerflow:parity-identity:v1";
type Resource = { dispose(): Promise<void> };
type DocumentResult = {
  rows: IdentityReceipt[];
  errors: string[];
  document: string;
  closed: boolean;
};
const activePages = new WeakSet<Page>();
async function finite<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("identity control deadline")),
          3000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** One capture owns one page. Install before the scenario's existing first goto. */
export async function installIdentityCapture(page: Page, base: string) {
  if (activePages.has(page))
    throw new Error("Overlapping identity capture on one page");
  const origin = new URL(base).origin;
  const capture = randomUUID();
  activePages.add(page);
  const actions = new Map<number, string | null>([[0, null]]);
  const ledger = createIdentityLedger(capture, origin, actions);
  const seed: Seed = {
    capture,
    origin,
    action: null,
    generation: 0,
    capability: CAPABILITY,
    control: CONTROL,
    binding: BINDING,
    event: EVENT,
    maxRows: MAX_ROWS,
    maxText: MAX_TEXT,
    fields: FIELDS,
    producers: PRODUCERS,
  };
  let init: Resource | undefined;
  let binding: Resource | undefined;
  let sealed = false;
  let disposed = false;
  let snapshot: IdentitySnapshot | undefined;
  const ownedInit = new Set<Resource>();
  const navigationDocuments = new Map<string, DocumentSeed>();
  const navigationResponses = new Set<Request>();
  const navigationReads = new Set<Promise<void>>();
  let censusOpen = true;
  let navigationCount = 0;
  let metadataFull = false;
  function capacityExceeded() {
    metadataFull = true;
    ledger.fail("identity harness metadata capacity exceeded");
  }
  const onNavigation = (frame: Frame) => {
    if (frame !== page.mainFrame()) return;
    if (!censusOpen) {
      ledger.fail("identity navigation crossed capture cutoff");
      return;
    }
    if (metadataFull) return;
    if (navigationCount >= MAX_ROWS) {
      capacityExceeded();
      return;
    }
    navigationCount += 1;
    // pushState/replaceState can emit several navigations in one document.
    // A public final main-document response marks a possible realm boundary;
    // the exact nonce/bootstrap census still proves which document was read.
    const revision = navigationResponses.size;
    const read = frame
      .evaluate(
        ({ name, token }) => {
          const control = Object.getOwnPropertyDescriptor(window, name)
            ?.value as
            | {
                capture?: string;
                describe(): {
                  capture: string;
                  document: string;
                  origin: string;
                  protocol: string;
                  closed: boolean;
                  bootstrapGeneration: number;
                  bootstrapAction: string | null;
                };
              }
            | undefined;
          return control?.capture === token ? control.describe() : null;
        },
        { name: CONTROL, token: capture },
      )
      .then(
        (value) => {
          if (revision !== navigationResponses.size)
            ledger.fail("identity document census crossed another navigation");
          if (
            !value ||
            value.capture !== capture ||
            typeof value.document !== "string" ||
            !/^[a-f0-9]{32}$/.test(value.document) ||
            value.origin !== origin ||
            !["http:", "https:"].includes(value.protocol) ||
            value.closed ||
            !actions.has(value.bootstrapGeneration) ||
            actions.get(value.bootstrapGeneration) !== value.bootstrapAction
          )
            ledger.fail(
              "identity navigation has no supported active document control",
            );
          else {
            const observed = {
              document: value.document,
              generation: value.bootstrapGeneration,
              action: value.bootstrapAction,
            };
            const prior = navigationDocuments.get(value.document);
            if (
              prior &&
              (prior.generation !== observed.generation ||
                prior.action !== observed.action)
            )
              ledger.fail(
                "identity document bootstrap changed during navigation census",
              );
            else if (!prior && navigationDocuments.size >= MAX_DOCUMENTS)
              capacityExceeded();
            else navigationDocuments.set(value.document, observed);
          }
        },
        () => {
          ledger.fail("identity navigation document could not be observed");
        },
      );
    navigationReads.add(read);
    void read.finally(() => navigationReads.delete(read));
  };
  const onResponse = (response: Response) => {
    if (metadataFull) return;
    try {
      const request = response.request();
      if (
        !request.isNavigationRequest() ||
        request.frame() !== page.mainFrame()
      )
        return;
      if (new URL(response.url()).origin !== origin)
        ledger.fail("identity document navigation left the expected origin");
      if (
        ![301, 302, 303, 307, 308, 204, 205].includes(response.status()) &&
        !navigationResponses.has(request)
      ) {
        if (navigationResponses.size >= MAX_DOCUMENTS) capacityExceeded();
        else navigationResponses.add(request);
      }
    } catch {
      ledger.fail("identity navigation response could not be observed");
    }
  };
  const detachNavigation = () => {
    page.off("framenavigated", onNavigation);
    page.off("response", onResponse);
  };
  function merge(result: DocumentResult | null) {
    if (!result) {
      ledger.fail("identity document control is missing");
      return;
    }
    for (const row of result.rows) ledger.receive(row);
    for (const error of result.errors) ledger.fail(error);
  }
  async function current(operation: "seal" | "dispose") {
    return page.evaluate(
      ({ name, token, operation }) => {
        const control = Object.getOwnPropertyDescriptor(window, name)?.value as
          | {
              capture?: string;
              seal(reason: "seal"): DocumentResult;
              dispose(): DocumentResult;
            }
          | undefined;
        if (control?.capture !== token) return null;
        return operation === "dispose"
          ? control.dispose()
          : control.seal("seal");
      },
      { name: CONTROL, token: capture, operation },
    );
  }
  try {
    page.on("framenavigated", onNavigation);
    page.on("response", onResponse);
    binding = await page.exposeBinding(BINDING, (source, row: unknown) => {
      if (
        source.page !== page ||
        source.context !== page.context() ||
        source.frame !== page.mainFrame()
      ) {
        ledger.fail("identity receipt came from a different page or frame");
        return null;
      }
      // Do not compare source.frame.url(): an old document's callback can arrive
      // after navigation. The document nonce/origin stay with its original row.
      ledger.receive(row);
      const receipt = row as IdentityReceipt;
      return `${receipt?.document}:${receipt?.sequence}`;
    });
    init = await page.addInitScript(installIdentityDocument, seed);
    ownedInit.add(init);
  } catch (error) {
    const results = await Promise.allSettled(
      [...ownedInit, ...(binding ? [binding] : [])].map((resource) =>
        resource.dispose(),
      ),
    );
    detachNavigation();
    activePages.delete(page);
    const cleanup = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason as unknown] : [],
    );
    if (cleanup.length)
      throw new AggregateError(
        [error, ...cleanup],
        "Identity installation and resource cleanup failed",
        { cause: error },
      );
    throw error;
  }
  return {
    capture,
    async beginAction(action: string) {
      if (sealed || disposed)
        throw new Error("Identity capture is already sealed");
      if (!action || action.length > 1024)
        throw new Error("Invalid semantic action");
      if (metadataFull || actions.size >= MAX_ROWS) {
        capacityExceeded();
        throw new Error("Identity harness metadata capacity exceeded");
      }
      try {
        seed.action = action;
        seed.generation += 1;
        actions.set(seed.generation, action);
        const next = await page.addInitScript(installIdentityDocument, {
          ...seed,
        });
        ownedInit.add(next);
        if (init) {
          await init.dispose();
          ownedInit.delete(init);
        }
        init = next;
        await page.evaluate(
          ({ name, token, action, generation, origin }) => {
            const control = Object.getOwnPropertyDescriptor(window, name)
              ?.value as
              | {
                  capture?: string;
                  action(action: string, generation: number): void;
                }
              | undefined;
            if (control?.capture === token) control.action(action, generation);
            else if (control)
              throw new Error("A different capture owns this document");
            else if (generation > 1 && location.origin === origin)
              throw new Error("The current document has no identity control");
          },
          {
            name: CONTROL,
            token: capture,
            action,
            generation: seed.generation,
            origin,
          },
        );
      } catch (error) {
        ledger.fail("identity action boundary could not be established");
        throw error;
      }
    },
    async seal(onDocumentSealed?: () => void) {
      if (snapshot) return snapshot;
      sealed = true;
      // Stop enrolling census work at the Node cutoff. A navigation during this
      // bounded drain is explicitly ambiguous; it cannot escape a copied list.
      censusOpen = false;
      let censusTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.allSettled([...navigationReads]),
          new Promise<never>((_, reject) => {
            censusTimer = setTimeout(
              () => reject(new Error("identity census deadline")),
              3000,
            );
          }),
        ]);
      } catch {
        ledger.fail("identity finite document census failed");
      } finally {
        clearTimeout(censusTimer);
      }
      try {
        merge(await finite(current("seal")));
      } catch {
        ledger.fail("identity document could not be sealed");
      } finally {
        // The browser has been asked to seal. The caller stops its separate
        // Node network observation here, before the finite receipt ACK drain.
        // These are explicit adjacent cutoffs, not a browser-wide atomic one.
        onDocumentSealed?.();
      }
      // This is a bounded wait for known finite binding calls, never network
      // idle, SSE completion, or a causal timing tolerance. A deadline is invalid.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const drained = await Promise.race([
          page.evaluate(
            async ({ name, token }) => {
              const control = Object.getOwnPropertyDescriptor(window, name)
                ?.value as
                | { capture?: string; drain(): Promise<DocumentResult> }
                | undefined;
              return control?.capture === token ? control.drain() : null;
            },
            { name: CONTROL, token: capture },
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("identity drain deadline")),
              3000,
            );
          }),
        ]);
        merge(drained);
      } catch {
        ledger.fail("identity finite receipt drain failed");
      } finally {
        clearTimeout(timer);
      }
      // Finite current-document receipt merge completes before freeze. Closed
      // older documents must already declare every sequence; otherwise invalid.
      // This is separate from recordNetwork's Node-observed cutoff.
      detachNavigation();
      ledger.expectDocuments([...navigationDocuments.values()]);
      // HTTP response count is only an extra necessary check. It cannot pair a
      // request to an owner, and never substitutes for the nonce census above.
      if (navigationResponses.size !== navigationDocuments.size)
        ledger.fail(
          "identity document census differs from observed navigations",
        );
      snapshot = ledger.freeze();
      return snapshot;
    },
    async dispose() {
      if (disposed) return [];
      disposed = true;
      detachNavigation();
      const errors: string[] = [];
      try {
        if (!page.isClosed()) merge(await finite(current("dispose")));
      } catch {
        errors.push("identity current-document cleanup failed");
      }
      const results = await Promise.allSettled(
        [...ownedInit, ...(binding ? [binding] : [])].map((resource) =>
          resource.dispose(),
        ),
      );
      for (const result of results)
        if (result.status === "rejected")
          errors.push("identity registered-resource cleanup failed");
      activePages.delete(page);
      return errors;
    },
  };
}
