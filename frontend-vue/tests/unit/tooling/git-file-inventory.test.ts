import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { gitFileInventory } from "../../../scripts/lib/git-file-inventory.mjs";

const observed = vi.hoisted(() => ({ statPaths: [] as string[] }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: (path: Parameters<typeof actual.existsSync>[0]) => {
      observed.statPaths.push(String(path));
      return actual.existsSync(path);
    },
  };
});

const roots: string[] = [];

function checkout() {
  const root = mkdtempSync(join(tmpdir(), "deerflow-git-inventory-"));
  roots.push(root);
  execFileSync("git", ["init", "--quiet", root]);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
  observed.statPaths.length = 0;
});

describe("Git checkout inventory", () => {
  it("uses Git's existing untracked entries without statting every new evidence file again", async () => {
    const root = checkout();
    writeFileSync(join(root, "tracked.ts"), "export {};\n");
    execFileSync("git", ["add", "tracked.ts"], { cwd: root });
    writeFileSync(join(root, "new-evidence.json"), "{}\n");
    writeFileSync(join(root, "new-report.md"), "report\n");
    expect(new Set(await gitFileInventory(root))).toEqual(
      new Set(["tracked.ts", "new-evidence.json", "new-report.md"]),
    );
    expect(observed.statPaths).toEqual([join(root, "tracked.ts")]);
  });

  it("takes a fresh snapshot on each call after files are added or deleted", async () => {
    const root = checkout();
    writeFileSync(join(root, "tracked.ts"), "export {};\n");
    execFileSync("git", ["add", "tracked.ts"], { cwd: root });
    expect(await gitFileInventory(root)).toEqual(["tracked.ts"]);
    rmSync(join(root, "tracked.ts"));
    writeFileSync(join(root, "later.ts"), "export {};\n");
    expect(await gitFileInventory(root)).toEqual(["later.ts"]);
  });

  it("includes tracked and untracked files while honoring actual ignore rules", async () => {
    const root = checkout();
    writeFileSync(join(root, "tracked.ts"), "export {};\n");
    writeFileSync(join(root, ".gitignore"), "ignored.ts\n");
    execFileSync("git", ["add", "tracked.ts", ".gitignore"], { cwd: root });
    writeFileSync(join(root, "untracked.ts"), "export {};\n");
    writeFileSync(join(root, "ignored.ts"), "export {};\n");
    expect(new Set(await gitFileInventory(root))).toEqual(
      new Set([".gitignore", "tracked.ts", "untracked.ts"]),
    );
  });

  it("preserves Unicode, whitespace and newline filenames as complete paths", async () => {
    const root = checkout();
    const names = ["空 格.ts", "first\nsecond.ts", 'quote"back\\slash.ts'];
    for (const name of names) writeFileSync(join(root, name), "export {};\n");
    execFileSync("git", ["add", "--", names[0]!], { cwd: root });
    expect(new Set(await gitFileInventory(root))).toEqual(new Set(names));
  });

  it("does not treat a deleted tracked file as present in the current checkout", async () => {
    const root = checkout();
    writeFileSync(join(root, "deleted-tracked.ts"), "export {};\n");
    execFileSync("git", ["add", "deleted-tracked.ts"], { cwd: root });
    rmSync(join(root, "deleted-tracked.ts"));
    writeFileSync(join(root, "present.ts"), "export {};\n");
    expect(await gitFileInventory(root)).toEqual(["present.ts"]);
  });

  it("reads every file when the actual Git inventory exceeds the synchronous buffer", async () => {
    const root = checkout();
    const names = Array.from(
      { length: 5000 },
      (_, index) =>
        `${index.toString().padStart(5, "0")}-${"x".repeat(220)}.ts`,
    );
    for (const name of names) writeFileSync(join(root, name), "");
    let synchronousFailure: unknown;
    try {
      execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
        cwd: root,
        encoding: "utf8",
      });
    } catch (error) {
      synchronousFailure = error;
    }
    expect(synchronousFailure).toMatchObject({ code: "ENOBUFS" });
    expect(new Set(await gitFileInventory(root))).toEqual(new Set(names));
  });

  it("rejects a failed Git command instead of treating it as an empty checkout", async () => {
    const root = checkout();
    rmSync(join(root, ".git"), { recursive: true });
    await expect(gitFileInventory(root)).rejects.toThrow();
  });
});
