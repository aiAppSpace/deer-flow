/*
  【文件职责】     固定artifact 显式文件策略、文本加载/保存和 skill 行为边界。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/artifacts/policy.ts
  【边界与注意】   未知扩展名和无扩展名必须 fail closed；扩展名不得伪造 Gateway 权限。
*/

import { describe, expect, it } from "vitest";

import {
  canInstallSkillArtifact,
  canLoadArtifactText,
  canSaveArtifactText,
  classifyArtifact,
} from "@/core/artifacts/policy";

describe("classifyArtifact", () => {
  it.each([
    ["report.txt", "text", "text"],
    ["report.md", "text", "markdown"],
    ["page.html", "text", "html"],
    ["component.vue", "text", "vue"],
    ["data.json", "text", "json"],
    ["vector.svg", "download-only", null],
    ["photo.png", "browser-media", "image"],
    ["speech.mp3", "browser-media", "audio"],
    ["movie.mp4", "browser-media", "video"],
    ["report.pdf", "safe-document", "pdf"],
    ["report.doc", "download-only", null],
    ["report.docx", "download-only", null],
    ["sheet.xls", "download-only", null],
    ["sheet.xlsx", "download-only", null],
    ["slides.ppt", "download-only", null],
    ["slides.pptx", "download-only", null],
    ["bundle.zip", "download-only", null],
    ["bundle.tar.gz", "download-only", null],
    ["blob.bin", "download-only", null],
    ["mystery.custom", "download-only", null],
    ["README", "download-only", null],
    /*
      `.skill` 按 **markdown** 分类，不是"不能预览的归档"：它是一个目录，里面有一份
      SKILL.md，loader 会把 URL 补上那一段。React 的 isSkillFile 分支同样直接返回
      markdown（frontend/src/components/workspace/artifacts/artifact-file-detail.tsx）。
      它仍然不能编辑，靠的是 source 而不是 kind。
    */
    ["tool.skill", "text", "markdown"],
  ])("classifies %s as %s", (name, kind, detail) => {
    const policy = classifyArtifact(`/mnt/user-data/outputs/${name}`);
    expect(policy.kind).toBe(kind);
    expect(policy.kind === "text" ? policy.language : policy.previewKind).toBe(
      detail,
    );
  });

  it("never promotes unknown or extensionless files from untrusted MIME metadata", () => {
    for (const path of ["payload.unknown", "README"]) {
      const policy = classifyArtifact(`/mnt/user-data/outputs/${path}`, {
        contentType: "text/plain",
      });
      expect(policy.kind).toBe("download-only");
      expect(canLoadArtifactText(policy)).toBe(false);
    }
  });

  it.each([
    ["settings.conf", "text"],
    ["component.mts", "typescript"],
    ["entry.cts", "typescript"],
    ["theme.less", "less"],
    ["page.astro", "astro"],
    ["types.pyi", "python"],
    ["app.kt", "kotlin"],
    ["entry.cxx", "cpp"],
    ["app.cs", "csharp"],
    ["shell.zsh", "zsh"],
    ["data.json5", "json5"],
    [".env", "dotenv"],
    ["guide.mdx", "mdx"],
    ["main.swift", "swift"],
    ["module.clj", "clojure"],
    ["Dockerfile", "dockerfile"],
    ["Makefile", "makefile"],
    [".gitignore", "git-commit"],
    ["schema.graphql", "graphql"],
    ["module.wasm", "wasm"],
  ])("recognizes React's current text language for %s", (name, language) => {
    expect(classifyArtifact(`/mnt/user-data/outputs/${name}`)).toMatchObject({
      kind: "text",
      language,
    });
  });

  it("shows unknown write-file content as a transient text draft without promoting the stored file", () => {
    expect(
      classifyArtifact(
        "write-file:/mnt/user-data/outputs/README?tool_call_id=call-1",
      ),
    ).toMatchObject({
      kind: "text",
      language: "text",
      source: "write-file-draft",
    });
    expect(classifyArtifact("/mnt/user-data/outputs/README")).toMatchObject({
      kind: "download-only",
    });
  });

  it("keeps streaming drafts, formal artifacts, skills, and mock artifacts on separate capabilities", () => {
    const formal = classifyArtifact("/mnt/user-data/outputs/report.md");
    const draft = classifyArtifact(
      "write-file:/mnt/user-data/outputs/report.md?tool_call_id=call-1",
    );
    const skill = classifyArtifact("/mnt/user-data/outputs/tool.skill");
    const mock = classifyArtifact("/mnt/user-data/outputs/report.md", {
      isMock: true,
    });
    const upload = classifyArtifact("/mnt/user-data/uploads/report.md");

    expect(formal.source).toBe("formal");
    expect(draft.source).toBe("write-file-draft");
    expect(skill.source).toBe("skill-archive");
    expect(canSaveArtifactText(skill, { hasRevision: true })).toBe(false);
    expect(canSaveArtifactText(formal, { hasRevision: true })).toBe(true);
    expect(canSaveArtifactText(draft, { hasRevision: true })).toBe(false);
    expect(canSaveArtifactText(mock, { hasRevision: true })).toBe(false);
    expect(canSaveArtifactText(upload, { hasRevision: true })).toBe(false);
    expect(canInstallSkillArtifact(skill, { isAdmin: true })).toBe(true);
    expect(canInstallSkillArtifact(skill, { isAdmin: false })).toBe(false);
  });

  it("only edits complete, revisioned text in formal outputs", () => {
    const path = "/mnt/user-data/outputs/report.md";
    for (const [target, metadata, state, allowed] of [
      [path, {}, { hasRevision: true, fullContentLoaded: true }, true],
      [path, {}, { hasRevision: false, fullContentLoaded: true }, false],
      [path, {}, { hasRevision: true, fullContentLoaded: false }, false],
      [
        path,
        { isMock: true },
        { hasRevision: true, fullContentLoaded: true },
        false,
      ],
      [
        "/mnt/user-data/workspace/report.md",
        {},
        { hasRevision: true, fullContentLoaded: true },
        false,
      ],
      [
        "write-file:/mnt/user-data/outputs/report.md",
        {},
        { hasRevision: true, fullContentLoaded: true },
        false,
      ],
      [
        "/mnt/user-data/outputs/report.png",
        {},
        { hasRevision: true, fullContentLoaded: true },
        false,
      ],
    ] as const) {
      expect(
        canSaveArtifactText(classifyArtifact(target, metadata), state),
      ).toBe(allowed);
    }
  });
});
