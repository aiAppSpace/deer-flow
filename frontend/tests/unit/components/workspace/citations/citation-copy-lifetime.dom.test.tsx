import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";

import { CitationSourcesPanel } from "@/components/workspace/citations/citation-sources-panel";
import type { CitationSource } from "@/core/citations/sources";
import { I18nContext } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";

const controls = rs.hoisted(() => ({
  write: rs.fn(),
  success: rs.fn(),
  error: rs.fn(),
}));
rs.mock("@/core/clipboard", () => ({ writeTextToClipboard: controls.write }));
rs.mock("sonner", () => ({
  toast: { success: controls.success, error: controls.error },
}));
const source: CitationSource = {
  id: "first",
  title: "Paper A",
  url: "https://example.com/a",
  domain: "example.com",
  count: 1,
  occurrences: [{ index: 1, title: "Paper A" }],
};
function panel(sources = [source]) {
  return (
    <StrictMode>
      <I18nContext.Provider
        value={{ locale: "en-US", setLocale: () => undefined, t: enUS }}
      >
        <CitationSourcesPanel sources={sources} />
      </I18nContext.Provider>
    </StrictMode>
  );
}
beforeEach(() => {
  document.cookie = "locale=en-US; path=/";
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  controls.write.mockReset();
  controls.success.mockReset();
  controls.error.mockReset();
});
afterEach(() => {
  cleanup();
  rs.useRealTimers();
});

for (const outcome of ["success", "denied", "rejected"] as const) {
  it(`retires the old source's late ${outcome} clipboard result`, async () => {
    let resolve!: (copied: boolean) => void;
    let reject!: (reason: Error) => void;
    controls.write.mockImplementationOnce(
      () =>
        new Promise<boolean>((done, fail) => {
          resolve = done;
          reject = fail;
        }),
    );
    const previous = render(panel());
    fireEvent.click(
      screen.getByRole("button", {
        name: enUS.citations.copyReference("Paper A"),
        hidden: true,
      }),
    );
    previous.unmount();
    render(panel([{ ...source, id: "second", title: "Paper B" }]));
    await act(async () => {
      if (outcome === "rejected") reject(new Error("Late denial"));
      else resolve(outcome === "success");
      await Promise.resolve();
    });
    expect(controls.success).not.toHaveBeenCalled();
    expect(controls.error).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", {
        name: enUS.citations.copyReference("Paper B"),
        hidden: true,
      }),
    ).toBeDefined();
    expect(rs.getTimerCount()).toBe(0);
  });
}

it("keeps live copy feedback, repeats its deadline and clears it on unmount", async () => {
  controls.write.mockResolvedValue(true);
  const view = render(panel());
  const button = screen.getByRole("button", {
    name: enUS.citations.copyReference("Paper A"),
    hidden: true,
  });
  await act(async () => {
    fireEvent.click(button);
  });
  expect(button.getAttribute("aria-label")).toBe(
    enUS.citations.copiedReference("Paper A"),
  );
  await act(async () => {
    await rs.advanceTimersByTimeAsync(1500);
    fireEvent.click(button);
  });
  await act(async () => {
    await rs.advanceTimersByTimeAsync(500);
  });
  expect(button.getAttribute("aria-label")).toBe(
    enUS.citations.copiedReference("Paper A"),
  );
  await act(async () => {
    await rs.advanceTimersByTimeAsync(1500);
  });
  expect(button.getAttribute("aria-label")).toBe(
    enUS.citations.copyReference("Paper A"),
  );
  expect(controls.success).toHaveBeenCalledTimes(2);
  await act(async () => {
    fireEvent.click(button);
  });
  expect(rs.getTimerCount()).toBe(1);
  view.unmount();
  expect(rs.getTimerCount()).toBe(0);
});
