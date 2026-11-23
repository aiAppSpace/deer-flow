import { expect, test } from "./support/test";
import { mockLangGraphAPI } from "../e2e/utils/mock-api";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";

type SpeechHarnessWindow = typeof window & {
  speechSession: {
    count: () => number;
    result: (text: string) => void;
    end: () => void;
    stopCalls: () => number;
  };
};

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${app}: voice session keeps its Stop control through automatic restart and final transcript`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      await context.addInitScript(() => {
        localStorage.setItem("locale", "en-US");
        const instances: Recognition[] = [];
        class Recognition {
          continuous = false;
          interimResults = false;
          maxAlternatives = 1;
          lang = "";
          onend: (() => void) | null = null;
          onerror: ((event: { error: string }) => void) | null = null;
          onresult:
            | ((event: {
                results: Array<{
                  0: { transcript: string };
                  length: number;
                  isFinal: boolean;
                }>;
              }) => void)
            | null = null;
          stops = 0;
          constructor() {
            instances.push(this);
          }
          start() {}
          stop() {
            this.stops++;
          }
          abort() {
            this.onend?.();
          }
        }
        Object.defineProperty(window, "SpeechRecognition", {
          configurable: true,
          value: Recognition,
        });
        (window as SpeechHarnessWindow).speechSession = {
          count: () => instances.length,
          result: (text) =>
            instances.at(-1)!.onresult?.({
              results: [{ 0: { transcript: text }, length: 1, isFinal: true }],
            }),
          end: () => instances.at(-1)!.onend?.(),
          stopCalls: () => instances.at(-1)!.stops,
        };
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      mockLangGraphAPI(page);
      await page.goto(`${base}/workspace/chats/new`);
      const voice = page.getByTestId("voice-input-button");
      const input = page.getByRole("textbox", {
        name: /how can i assist you/i,
      });
      await expect(voice).toBeEnabled();
      await input.fill("Draft");
      await voice.click();
      await expect(voice).toHaveAttribute("aria-pressed", "true");
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      await page.evaluate(() =>
        (window as SpeechHarnessWindow).speechSession.end(),
      );
      await expect(voice).toHaveAttribute("aria-pressed", "true");
      await voice.click();
      await page.clock.runFor(200);
      expect(
        await page.evaluate(() =>
          (window as SpeechHarnessWindow).speechSession.count(),
        ),
      ).toBe(1);
      await expect(voice).toHaveAttribute("aria-pressed", "false");

      await voice.click();
      await page.evaluate(() => {
        (window as SpeechHarnessWindow).speechSession.result("first");
        (window as SpeechHarnessWindow).speechSession.end();
      });
      await page.clock.runFor(150);
      expect(
        await page.evaluate(() =>
          (window as SpeechHarnessWindow).speechSession.count(),
        ),
      ).toBe(3);
      await page.evaluate(() =>
        (window as SpeechHarnessWindow).speechSession.result("second"),
      );
      await expect(input).toHaveValue("Draft first second");
      await voice.click();
      await expect(voice).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(() =>
          (window as SpeechHarnessWindow).speechSession.stopCalls(),
        ),
      ).toBe(1);
      await page.evaluate(() => {
        (window as SpeechHarnessWindow).speechSession.result("second final");
        (window as SpeechHarnessWindow).speechSession.end();
      });
      await expect(input).toHaveValue("Draft first second final");
      await expect(voice).toHaveAttribute("aria-pressed", "false");
      await page.clock.runFor(200);
      expect(
        await page.evaluate(() =>
          (window as SpeechHarnessWindow).speechSession.count(),
        ),
      ).toBe(3);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
