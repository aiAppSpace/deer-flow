import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

/*
  A `fetch` to somebody else's host must carry a timeout.

  `try/catch` catches an *error*. It does not catch "never answers" — and the
  one call this rule was written for lives inside an async Server Component, so
  a slow api.github.com stalls the whole `/` response rather than just the star
  badge it feeds. Unauthenticated GitHub allows 60 requests an hour per IP,
  which an e2e suite reaches in an afternoon; on 2026-09-08 `landing.spec.ts`
  had been timing out at 30s under load for several sessions.

  The scan has to be call-shaped, not line-shaped. The first hand-written
  version of it grepped for a line containing both `fetch(` and `https://` and
  reported **zero** hits — because the URL sits on the next line. So this walks
  from each `fetch(` to its balanced closing paren and looks at the whole call.
*/
const srcDir = path.join(__dirname, "../../../src");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

/** Strip comments so a sentence *about* this rule is not read as code. */
function stripComments(text: string): string {
  return text
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, "$1");
}

type Call = { file: string; text: string };

/** Every `fetch(...)` call in `src/`, from the paren to its balanced close. */
function fetchCalls(): Call[] {
  const found: Call[] = [];
  for (const file of sourceFiles(srcDir)) {
    const text = stripComments(readFileSync(file, "utf8"));
    for (const match of text.matchAll(/\bfetch\s*\(/g)) {
      let depth = 0;
      let end = match.index;
      for (let i = match.index + match[0].length - 1; i < text.length; i += 1) {
        if (text[i] === "(") depth += 1;
        else if (text[i] === ")") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      found.push({
        file: path.relative(srcDir, file),
        text: text.slice(match.index, end + 1),
      });
    }
  }
  return found;
}

const EXTERNAL = /["'`]https?:\/\/(?!localhost|127\.0\.0\.1)/;

describe("external fetch", () => {
  it("the scan is call-shaped, not line-shaped", () => {
    const calls = fetchCalls();
    // The known external call spans several lines; a line-based scan misses it.
    const external = calls.filter((call) => EXTERNAL.test(call.text));
    expect(external.map((call) => call.file)).toContain(
      path.join("components", "landing", "header.tsx"),
    );
    expect(calls.length).toBeGreaterThan(3);
  });

  it("every external fetch carries a timeout", () => {
    const offenders = fetchCalls()
      .filter((call) => EXTERNAL.test(call.text))
      .filter((call) => !/\bsignal\s*:/.test(call.text))
      .map((call) => call.file);
    expect(offenders).toEqual([]);
  });
});
