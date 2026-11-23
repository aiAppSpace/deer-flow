import { cpSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

const generated = new Set([
  ".git",
  ".cache",
  "node_modules",
  ".nuxt",
  ".output",
  ".next",
  ".venv",
  ".deer-flow",
  "__pycache__",
  ".pytest_cache",
  ".ruff_cache",
  "test-results",
  "playwright-report",
  "coverage",
  "logs",
]);
const privateFiles = new Set(["config.yaml", "extensions_config.json"]);

const isPrivateRuntimeFile = (name) =>
  privateFiles.has(name) ||
  name === ".env" ||
  (name.startsWith(".env.") && name !== ".env.example");

/** Copy WIP sources; no original checkout paths are renamed or linked. */
export function createStandaloneWorkspace(source) {
  // Test reporters resolve symlinks. Use the same physical root so a temp-dir
  // alias (macOS /var -> /private/var, for example) cannot hide collected files.
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), "deerflow-standalone-")),
  );
  try {
    cpSync(source, root, {
      recursive: true,
      dereference: false,
      filter(path) {
        const rel = relative(source, path);
        if (!rel) return true;
        const parts = rel.split(/[\\/]/);
        if (parts[0] === "frontend" || generated.has(basename(path)))
          return false;
        if (parts.length === 1 && isPrivateRuntimeFile(parts[0])) return false;
        if (
          parts.length === 2 &&
          ["frontend-vue", "backend"].includes(parts[0]) &&
          isPrivateRuntimeFile(parts[1])
        )
          return false;
        return true;
      },
    });
    return {
      root,
      dispose: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
