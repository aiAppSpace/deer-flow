import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, test } from "vitest";

import {
  DEMO_THREAD_IDS,
  isDemoThreadId,
  pathOfPublicDemoThread,
  resolveStaticDemoArtifact,
  STATIC_DEMO_ARTIFACTS,
} from "../../../shared/showcase";

const landingSource = readFileSync(
  new URL("../../../app/pages/index.vue", import.meta.url),
  "utf8",
);

const showcaseLayoutSource = readFileSync(
  new URL("../../../app/layouts/showcase.vue", import.meta.url),
  "utf8",
);

function listFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? listFiles(root, path)
      : [relative(root, path).replaceAll("\\", "/")];
  });
}

describe("public showcase contracts", () => {
  test("offers one localized primary action into the workspace", () => {
    expect(landingSource).toContain('data-testid="landing-workspace-cta"');
    expect(landingSource).toContain('to="/workspace"');
    expect(landingSource).toContain("marketing.enterWorkspace");
    expect(landingSource).toContain("buttonVariants({ size: 'lg' })");
  });

  test("keeps the public demo allowlist and route stable", () => {
    expect(DEMO_THREAD_IDS.length).toBeGreaterThan(0);
    expect(isDemoThreadId(DEMO_THREAD_IDS[0]!)).toBe(true);
    expect(isDemoThreadId("unknown-thread")).toBe(false);
    expect(pathOfPublicDemoThread(DEMO_THREAD_IDS[0]!)).toBe(
      `/showcase/${DEMO_THREAD_IDS[0]}`,
    );
  });

  test("resolves only allowlisted artifact paths", () => {
    const threadId = "21cfea46-34bd-4aa6-9e1f-3009452fbeb9";
    expect(
      resolveStaticDemoArtifact(threadId, [
        "mnt",
        "user-data",
        "outputs",
        "doraemon-moe-comic.jpg",
      ]),
    ).toBe(
      `/demo/threads/${threadId}/user-data/outputs/doraemon-moe-comic.jpg`,
    );
    expect(
      resolveStaticDemoArtifact(threadId, ["mnt", "..", "secret"]),
    ).toBeNull();
    expect(
      resolveStaticDemoArtifact(threadId, ["mnt", "unknown.jpg"]),
    ).toBeNull();
  });

  test("keeps the Vue allowlist in sync with its packaged fixtures", () => {
    const threadsRoot = join(
      import.meta.dirname,
      "../../../public/demo/threads",
    );
    const fixtureThreadIds = readdirSync(threadsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect([...DEMO_THREAD_IDS].sort()).toEqual(fixtureThreadIds);
    expect(Object.keys(STATIC_DEMO_ARTIFACTS).sort()).toEqual(fixtureThreadIds);

    for (const fixtureThreadId of fixtureThreadIds) {
      const fixtureFiles = listFiles(join(threadsRoot, fixtureThreadId))
        .filter((path) => path !== "thread.json")
        .sort();
      expect(
        [...(STATIC_DEMO_ARTIFACTS[fixtureThreadId] ?? [])].sort(),
      ).toEqual(fixtureFiles);
    }
  });

  /*
    案例页外壳要挂 toast owner。上游
    `frontend/src/app/showcase/[thread_id]/layout.tsx` 里有一个
    `<Toaster position="top-center" />`，可访问性树上是一条
    `region "Notifications alt+T"`。

    这不只是少一行播报区：`useWorkspaceToast()` 在没有 owner 时**直接抛错**，
    所以任何用它的头部控件（ExportTrigger）都挂不上去——本仓此前正是靠把这些
    控件从案例页删掉来绕开，头部因此比上游少一颗按钮。

    对照台账看不到这一屏：showcase 没有同名的 React spec 文件（线索 107）。
  */
  test("mounts the toast viewport on the public showcase shell", () => {
    expect(showcaseLayoutSource).toContain("provideWorkspaceToast()");
    expect(showcaseLayoutSource).toContain("<WorkspaceToaster />");
    // viewport 是 main 的兄弟，与上游同构（那边挂在 SidebarInset 外面）。
    expect(showcaseLayoutSource).toMatch(/<\/main>\s*<WorkspaceToaster \/>/);
    // 卸载时清干净，与 workspace layout 同一条纪律。
    expect(showcaseLayoutSource).toContain("onUnmounted(() => toast.clear())");
  });
});

test("matches the current React case registry and every original fixture byte", async () => {
  const reactRoot = join(import.meta.dirname, "../../../../frontend");
  if (!existsSync(reactRoot)) {
    console.info(
      "UNRUN: current React sibling absent; standalone fixture checks do not prove parity.",
    );
    return;
  }
  const source = ts.createSourceFile(
    "static-demo.ts",
    readFileSync(join(reactRoot, "src/core/threads/static-demo.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function literal(node: ts.Expression): unknown {
    if (ts.isAsExpression(node)) return literal(node.expression);
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isArrayLiteralExpression(node))
      return node.elements.map((item) => literal(item as ts.Expression));
    if (ts.isObjectLiteralExpression(node))
      return Object.fromEntries(
        node.properties.map((property) => {
          if (
            !ts.isPropertyAssignment(property) ||
            !ts.isStringLiteral(property.name)
          )
            throw new Error("Unexpected showcase registry entry");
          return [property.name.text, literal(property.initializer)];
        }),
      );
    throw new Error("Unexpected showcase registry expression");
  }
  const upstream: Record<string, unknown> = {};
  source.forEachChild((statement) => {
    if (!ts.isVariableStatement(statement)) return;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        ["DEMO_THREAD_IDS", "STATIC_DEMO_ARTIFACTS"].includes(
          declaration.name.text,
        ) &&
        declaration.initializer
      )
        upstream[declaration.name.text] = literal(declaration.initializer);
    }
  });
  expect(DEMO_THREAD_IDS).toEqual(upstream.DEMO_THREAD_IDS);
  expect(STATIC_DEMO_ARTIFACTS).toEqual(upstream.STATIC_DEMO_ARTIFACTS);
  const vueFiles = join(import.meta.dirname, "../../../public/demo/threads");
  const reactFiles = join(reactRoot, "public/demo/threads");
  expect(listFiles(vueFiles).sort()).toEqual(listFiles(reactFiles).sort());
  for (const file of listFiles(reactFiles)) {
    expect(
      readFileSync(join(vueFiles, file)).equals(
        readFileSync(join(reactFiles, file)),
      ),
      file,
    ).toBe(true);
  }
});
