import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import type { ControlsConfig } from "streamdown";

import { ClipboardSafeStreamdown } from "@/components/ai-elements/streamdown";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { I18nProvider } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import { toStreamdownComponents } from "@/core/streamdown/components";

const markdown = "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |";
const write = rs.fn(async (_items: ClipboardItem[]) => undefined);
let clipboardDescriptor: PropertyDescriptor | undefined;
beforeEach(() => {
  document.cookie = "locale=en-US; path=/";
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write, writeText: rs.fn() },
  });
  write.mockClear();
  rs.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
    () => undefined,
  );
});
afterEach(() => {
  cleanup();
  if (clipboardDescriptor)
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  rs.restoreAllMocks();
});

function content(
  props: Partial<ComponentProps<typeof ClipboardSafeStreamdown>> = {},
  locale: "en-US" | "zh-CN" = "en-US",
) {
  return (
    <I18nProvider initialLocale={locale}>
      <ClipboardSafeStreamdown mode="static" {...props}>
        {props.children ?? markdown}
      </ClipboardSafeStreamdown>
    </I18nProvider>
  );
}

for (const locale of ["en-US", "zh-CN"] as const) {
  it(`uses public Streamdown controls in a real fullscreen table for ${locale}`, async () => {
    document.cookie = `locale=${locale}; path=/`;
    const t = locale === "en-US" ? enUS : zhCN;
    render(content({}, locale));
    const trigger = screen.getByRole("button", {
      name: t.markdown.viewFullscreen,
    });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    const table = dialog.querySelector("table")!;
    expect(table.textContent).toContain("Shanghai");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.markdown.copyTable,
      }),
    );
    fireEvent.click(within(dialog).getByTitle(t.markdown.copyTableAsMarkdown));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const item = write.mock.calls[0]![0][0]!;
    expect(await (await item.getType("text/plain")).text()).toBe(markdown);
    expect(await (await item.getType("text/html")).text()).toBe(
      table.outerHTML,
    );
    act(() =>
      within(dialog)
        .getByRole("button", { name: t.markdown.copyTable })
        .focus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
}

it("keeps all controls disabled while the response is animating", () => {
  render(content({ mode: "streaming", isAnimating: true }));
  for (const name of [
    enUS.markdown.copyTable,
    enUS.markdown.downloadTable,
    enUS.markdown.viewFullscreen,
  ]) {
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name }).disabled,
    ).toBe(true);
  }
});

for (const [controls, names] of [
  [false, []],
  [{ table: false }, []],
  [{ table: { copy: false, download: false } }, [enUS.markdown.viewFullscreen]],
  [
    { table: { fullscreen: false } },
    [enUS.markdown.copyTable, enUS.markdown.downloadTable],
  ],
] as [ControlsConfig, string[]][]) {
  it(`preserves the public control configuration ${JSON.stringify(controls)}`, () => {
    render(content({ controls }));
    expect(
      screen.queryAllByRole("button").map((button) => button.title),
    ).toEqual(names);
    expect(screen.getByRole("table").textContent).toContain("Shanghai");
  });
}

it("preserves a caller's explicit table override", () => {
  const CustomTable = ({ children }: ComponentProps<"table">) => (
    <table data-testid="caller-table">{children}</table>
  );
  render(
    content({ components: toStreamdownComponents({ table: CustomTable }) }),
  );
  expect(screen.getByTestId("caller-table").textContent).toContain("Shanghai");
  expect(
    screen.queryByRole("button", { name: enUS.markdown.viewFullscreen }),
  ).toBeNull();
});

it("keeps the same open dialog while its real table content updates", async () => {
  const view = render(content());
  fireEvent.click(
    screen.getByRole("button", { name: enUS.markdown.viewFullscreen }),
  );
  const dialog = await screen.findByRole("dialog");
  const copy = within(dialog).getByRole("button", {
    name: enUS.markdown.copyTable,
  });
  act(() => copy.focus());
  view.rerender(content({ children: markdown.replace("Sunny", "Rainy") }));
  expect(screen.getByRole("dialog")).toBe(dialog);
  await waitFor(() => expect(dialog.textContent).toContain("Rainy"));
  expect(document.activeElement).toBe(copy);
});

it("closes only the inner table before its containing artifact Sheet", async () => {
  render(
    <I18nProvider initialLocale="en-US">
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Artifact</SheetTitle>
          <SheetDescription>Markdown report</SheetDescription>
          <ClipboardSafeStreamdown mode="static">
            {markdown}
          </ClipboardSafeStreamdown>
        </SheetContent>
      </Sheet>
    </I18nProvider>,
  );
  const sheet = await screen.findByRole("dialog", { name: "Artifact" });
  const trigger = within(sheet).getByRole("button", {
    name: enUS.markdown.viewFullscreen,
  });
  fireEvent.click(trigger);
  const table = await screen.findByRole("dialog", {
    name: enUS.markdown.viewFullscreen,
  });
  act(() =>
    within(table)
      .getByRole("button", { name: enUS.markdown.copyTable })
      .focus(),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: enUS.markdown.viewFullscreen }),
    ).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Artifact" })).toBe(sheet);
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
