import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { createStandaloneWorkspace } from "../../../scripts/lib/standalone-workspace.mjs";

describe("isolated standalone workspace", () => {
  it.each(["", "frontend-vue", "backend"])(
    "excludes every private dotenv variant from owner %s while retaining public examples",
    (owner) => {
      const source = mkdtempSync(join(tmpdir(), "standalone-source-"));
      const directory = join(source, owner);
      mkdirSync(directory, { recursive: true });
      const privateNames = [
        ".env",
        ".env.local",
        ".env.production",
        ".env.development",
        ".env.test",
        ".env.production.local",
        ".env.staging",
      ];
      const publicNames = [".env.example", "config.example.yaml"];
      for (const name of [...privateNames, ...publicNames])
        writeFileSync(join(directory, name), "synthetic configuration");
      const isolated = createStandaloneWorkspace(source);
      try {
        for (const name of privateNames)
          expect(existsSync(join(isolated.root, owner, name)), name).toBe(
            false,
          );
        for (const name of publicNames)
          expect(readFileSync(join(isolated.root, owner, name), "utf8")).toBe(
            "synthetic configuration",
          );
        for (const name of [...privateNames, ...publicNames])
          expect(readFileSync(join(directory, name), "utf8")).toBe(
            "synthetic configuration",
          );
      } finally {
        isolated.dispose();
        rmSync(source, { recursive: true, force: true });
      }
    },
  );

  it("uses the physical root when the system temp directory is a symlink", () => {
    const source = mkdtempSync(join(tmpdir(), "standalone-source-"));
    const physicalTemp = mkdtempSync(join(tmpdir(), "standalone-physical-"));
    const alias = `${physicalTemp}-alias`;
    symlinkSync(physicalTemp, alias, "junction");
    writeFileSync(join(source, "current.txt"), "current source");
    try {
      const moduleUrl = new URL(
        "../../../scripts/lib/standalone-workspace.mjs",
        import.meta.url,
      ).href;
      const output = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { createStandaloneWorkspace } from ${JSON.stringify(moduleUrl)};
           import { realpathSync } from 'node:fs';
           const workspace = createStandaloneWorkspace(${JSON.stringify(source)});
           try { console.log(JSON.stringify({ root: workspace.root, physical: realpathSync(workspace.root) })); }
           finally { workspace.dispose(); }`,
        ],
        {
          encoding: "utf8",
          env: { ...process.env, TMPDIR: alias, TMP: alias, TEMP: alias },
        },
      );
      const result = JSON.parse(output) as { root: string; physical: string };
      expect(result.root).toBe(result.physical);
      expect(result.root.startsWith(realpathSync(physicalTemp))).toBe(true);
    } finally {
      rmSync(alias, { force: true });
      rmSync(physicalTemp, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("copies current uncommitted sources without moving React or copying private runtime state", () => {
    const source = mkdtempSync(join(tmpdir(), "standalone-source-"));
    for (const directory of [
      "frontend",
      "frontend-vue/app",
      "frontend-vue/patches",
      "frontend-vue/node_modules",
      "frontend-vue/.cache",
      "docker/.cache",
      ".deer-flow",
      "contracts",
    ])
      mkdirSync(join(source, directory), { recursive: true });
    for (const file of [
      "frontend/current.txt",
      "frontend-vue/app/new.vue",
      "frontend-vue/patches/happy-dom@21.0.4.patch",
      "frontend-vue/node_modules/dependency.js",
      "frontend-vue/.cache/failure.log",
      "docker/.cache/session.db",
      "config.yaml",
      ".env",
      ".deer-flow/state.db",
      join("contracts", "current.json"),
    ])
      writeFileSync(join(source, file), file);
    const isolated = createStandaloneWorkspace(source);
    try {
      expect(readFileSync(join(source, "frontend/current.txt"), "utf8")).toBe(
        "frontend/current.txt",
      );
      expect(
        readFileSync(join(isolated.root, "frontend-vue/app/new.vue"), "utf8"),
      ).toBe("frontend-vue/app/new.vue");
      expect(
        readFileSync(
          join(isolated.root, "frontend-vue/patches/happy-dom@21.0.4.patch"),
          "utf8",
        ),
      ).toBe("frontend-vue/patches/happy-dom@21.0.4.patch");
      expect(
        existsSync(join(isolated.root, join("contracts", "current.json"))),
      ).toBe(true);
      for (const path of [
        "frontend",
        "frontend-vue/node_modules",
        "frontend-vue/.cache",
        "docker/.cache",
        "config.yaml",
        ".env",
        ".deer-flow",
      ])
        expect(existsSync(join(isolated.root, path)), path).toBe(false);
      isolated.dispose();
      expect(existsSync(isolated.root)).toBe(false);
      expect(existsSync(join(source, "frontend/current.txt"))).toBe(true);
    } finally {
      isolated.dispose();
      rmSync(source, { recursive: true, force: true });
    }
  });
});
