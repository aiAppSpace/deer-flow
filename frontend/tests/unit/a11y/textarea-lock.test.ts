import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

/*
  A textarea the caller types into must never be locked with `disabled`.

  Setting `disabled` on the element that currently has focus makes the browser
  blur it — `focusout` with a null `relatedTarget` — and clearing `disabled`
  does **not** put focus back. Measured on 2026-09-08 against the upstream chat
  composer: sending a message flipped the composer lock on for 12ms while the
  first history page loaded, and that was enough to drop a keyboard user onto
  `<body>`. The Vue app, whose lock never flipped on that path, kept focus in
  the textarea; that mismatch is how the parity ledger surfaced it.

  `readOnly` is the tool for this: it blocks editing, keeps focus, keeps the
  control in the tab order, and pairs with `aria-disabled` to still announce the
  control as unavailable. Because a read-only textarea *does* receive key
  events, every submit shortcut that used to rely on a disabled element
  swallowing them now checks the lock itself.

  Zero exemptions on purpose. Every dynamic `disabled` on a textarea in this
  app is the same defect, so a list of allowed ones would only record which
  keyboard users we decided not to fix.

  The scan strips comments first. Without that, this very file — and the
  explanations left at each call site — mention `disabled` often enough to make
  a mutated build look clean.
*/
const srcDir = path.join(__dirname, "../../../src");

/** Components that render a `<textarea>`, directly or through one wrapper. */
const TEXTAREA_TAGS = [
  "textarea",
  "Textarea",
  "InputGroupTextarea",
  "PromptInputTextarea",
];

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (entry.endsWith(".tsx")) found.push(full);
  }
  return found;
}

function stripComments(text: string): string {
  return text
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, "$1");
}

type Element = { file: string; tag: string; line: number; attrs: string };

/**
 * Read each opening tag up to the `>` that closes it, tracking `{}` so a JSX
 * expression containing `>` does not end the tag early.
 */
function openingTags(file: string, text: string): Element[] {
  const found: Element[] = [];
  for (const tag of TEXTAREA_TAGS) {
    const opener = new RegExp(`<${tag}(?=[\\s/>])`, "g");
    for (const match of text.matchAll(opener)) {
      let index = match.index + match[0].length;
      let depth = 0;
      while (index < text.length) {
        const char = text[index];
        if (char === "{") depth += 1;
        else if (char === "}") depth -= 1;
        else if (char === ">" && depth === 0) break;
        index += 1;
      }
      found.push({
        file: path.relative(srcDir, file),
        tag,
        line: text.slice(0, match.index).split("\n").length,
        attrs: text.slice(match.index + match[0].length, index),
      });
    }
  }
  return found;
}

const elements = sourceFiles(srcDir).flatMap((file) =>
  openingTags(file, stripComments(readFileSync(file, "utf8"))),
);

describe("a textarea is never locked with `disabled`", () => {
  it("scans a surface that actually contains textareas", () => {
    // Without this the whole file passes when the tags get renamed or the
    // scan root moves, and a green run would mean "found nothing to check".
    expect(elements.length).toBeGreaterThanOrEqual(8);
    expect(new Set(elements.map((element) => element.tag)).size).toBeGreaterThan(
      1,
    );
  });

  it("has no textarea whose disabled state is bound to an expression", () => {
    const locked = elements
      .filter((element) => /(^|\s)disabled=\{/.test(element.attrs))
      .map(
        (element) =>
          `${element.file}:${element.line} <${element.tag}> ${
            /(^|\s)disabled=\{([^}]*)\}/.exec(element.attrs)?.[2]?.trim() ?? ""
          }`,
      );
    expect(locked).toEqual([]);
  });

  it("still locks the composer, using readOnly", () => {
    // The rule above is satisfied by deleting the lock outright, which would
    // let a caller type into a composer that cannot send. Every composer
    // textarea has to carry a read-only lock instead.
    const composers = elements.filter(
      (element) => element.tag === "PromptInputTextarea",
    );
    expect(composers.length).toBeGreaterThanOrEqual(3);
    for (const composer of composers) {
      expect(
        /(^|\s)readOnly=\{/.test(composer.attrs),
        `${composer.file}:${composer.line} has no readOnly lock`,
      ).toBe(true);
      expect(
        /(^|\s)aria-disabled=\{/.test(composer.attrs),
        `${composer.file}:${composer.line} does not announce the lock`,
      ).toBe(true);
    }
  });
});
