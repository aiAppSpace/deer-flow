import { expect, test, type Page } from "@playwright/test";

/*
  Decorative motion that ignores `prefers-reduced-motion`. The Vue app carries a
  mirror of this file (`frontend-vue/tests/e2e/reduced-motion.spec.ts`), which
  also covers the Shimmer: over there it is scoped CSS and only a browser can
  resolve it, while here it is driven by `motion/react` and jsdom can watch it
  move — so this app pins the Shimmer half in
  `tests/unit/components/ui/reduced-motion.dom.test.tsx` instead.

  The subtask card's ambilight is a decorative glow that travels forever while a
  subagent runs — auto-playing, infinite, purely decorative (WCAG 2.2.2, level
  A). Both this app and the Vue one ignored `prefers-reduced-motion` on it until
  2026-09-08; the Vue side's stylesheet even carried a note saying so and naming
  the condition for changing it ("both apps, in one change").

  Asserted through the compiled stylesheet's computed effect rather than the
  source text: the whole mechanism is a media query, so reading the CSS file
  would prove nothing about what the browser resolves. The element is injected
  because reaching a real running subtask needs a live stream, and what is under
  test is the rule, not the card.
*/
const probe = async (
  page: Page,
  reducedMotion: "reduce" | "no-preference",
) => {
  // Set explicitly rather than through `test.use({ reducedMotion })`: the
  // describe-level option did not reach the page here (the probe read
  // `matchMedia(...).matches === false` under `reduce`), and a preference the
  // page cannot see would make both cases assert the same thing.
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  return page.evaluate(() => {
    const node = globalThis.document.createElement("div");
    node.className = "ambilight enabled";
    globalThis.document.body.append(node);
    const before = globalThis.getComputedStyle(node, "::before");
    const result = {
      reduce: globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationName: before.animationName,
      // The glow has to still be painted; withholding the travel must not
      // withhold the layer.
      backgroundImage: before.backgroundImage.slice(0, 16),
      position: before.backgroundPosition,
    };
    node.remove();
    return result;
  });
};

test.describe("with reduced motion", () => {
  test("the ambilight glow stays but stops travelling", async ({ page }) => {
    const seen = await probe(page, "reduce");
    expect(seen.reduce).toBe(true);
    expect(seen.animationName).toBe("none");
    expect(seen.backgroundImage).toContain("gradient");
    // Parked where the keyframes open and close, which is also the initial
    // value — so the two apps agree without either naming a position.
    expect(seen.position).toBe("0px 0px");
  });
});

test.describe("with no motion preference", () => {
  test("the ambilight glow travels", async ({ page }) => {
    const seen = await probe(page, "no-preference");
    expect(seen.reduce).toBe(false);
    // Shape assert: the "none" above has to mean withheld, not "no such rule".
    expect(seen.animationName).toBe("ambilight");
  });
});
