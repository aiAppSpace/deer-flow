import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

/*
  Nothing may depend on an animation for its own visibility.

  Both instances this rule was written for shipped the same way: an animation
  whose first keyframe is `opacity: 0`, declared `forwards`. `forwards` only
  keeps the *last* frame, so nothing paints the first one during the
  `animation-delay` a staggered entrance needs — and the caller compensates by
  making the element itself transparent (`opacity-0`, or an inline
  `style={{ opacity: 0 }}`). From then on the element's resting state is
  invisible, and anything that withholds the animation — a reduced-motion
  branch, print, a browser that skips animations — hides the content for good.

    2026-09-08  ai-elements/suggestion.tsx        welcome suggestion chips
    2026-09-08  workspace/messages/skeleton.tsx   the whole history skeleton

  `both` fixes it at the source: `backwards` paints the first frame through the
  delay, so the caller never has to hide anything and the resting state stays
  visible. The rule is checked on the declaration rather than on the call sites
  because that is where the choice is made — and because a call-site scan has to
  correlate a `className` with a `style` prop several lines away, which is
  exactly the correlation this file's author missed when scanning by hand.
*/
const srcDir = path.join(__dirname, "../../../src");
const css = readFileSync(path.join(srcDir, "styles/globals.css"), "utf8");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(tsx?|css)$/.test(entry)) found.push(full);
  }
  return found;
}

/**
 * 剥掉注释再扫。The Vue side's twin caught this the hard way: a source comment explaining this
 * very rule mentioned `animate-fade-in-up + opacity-0 + forwards`, and the
 * unstripped scan reported the explanation as a violation.
 */
function stripComments(text: string): string {
  return text
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, "$1");
}

type Animation = { name: string; declaration: string; startsHidden: boolean };

function animations(): Animation[] {
  const found: Animation[] = [];
  for (const match of css.matchAll(/--animate-([\w-]+):\s*([^;]+);/g)) {
    const name = match[1] ?? "";
    const frames = new RegExp(
      `@keyframes ${name.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}\\s*\\{`,
    ).exec(css);
    let body = "";
    if (frames) {
      let depth = 0;
      for (let i = frames.index + frames[0].length - 1; i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        else if (css[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            body = css.slice(frames.index, i);
            break;
          }
        }
      }
    }
    const first = /(?:0%|from)\s*\{([^}]*)\}/s.exec(body);
    found.push({
      name,
      declaration: (match[2] ?? "").trim(),
      startsHidden: Boolean(first && /opacity:\s*0\b/.test(first[1] ?? "")),
    });
  }
  return found;
}

describe("animation-driven visibility", () => {
  it("finds the animations it is supposed to check", () => {
    // A moved file or a broken regex has to fail here, not silently pass below.
    const names = animations().map((a) => a.name);
    expect(names).toContain("fade-in-up");
    expect(names).toContain("skeleton-entrance");
    expect(names.length).toBeGreaterThanOrEqual(4);
  });

  it("an animation that starts transparent is never `forwards`", () => {
    const offenders = animations()
      .filter((a) => a.startsHidden && !/\b(both|backwards)\b/.test(a.declaration))
      .map((a) => `${a.name}: ${a.declaration}`);
    expect(offenders).toEqual([]);
  });

  it("no element hides itself next to an animation utility", () => {
    // The other half: even with `both`, a leftover `opacity-0` on the same
    // class string puts the resting state back to invisible.
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of sourceFiles(srcDir)) {
      scanned += 1;
      const text = stripComments(readFileSync(file, "utf8"));
      for (const line of text.split("\n")) {
        if (!/\banimate-[\w-]/.test(line)) continue;
        if (/\bopacity-0\b|\binvisible\b/.test(line)) {
          offenders.push(`${path.relative(srcDir, file)}: ${line.trim()}`);
        }
      }
    }
    // Scan surface proves itself: a moved directory has to fail here.
    expect(scanned).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });
});
