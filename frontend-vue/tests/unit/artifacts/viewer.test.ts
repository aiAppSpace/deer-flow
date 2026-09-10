/*
  【文件职责】     钉住独立产物视窗的「哪些进视窗、哪些交回 Gateway」与链接解析。
  【架构位置】     纯函数单测
  【主要导出】     无；Vitest cases
  【依赖关系】     core/artifacts/viewer
  【边界与注意】   **HTML/SVG 不许进视窗**这一条是安全边界，不是渲染偏好：
                   Gateway 是故意把它们作为下载返回的，进了应用内视窗等于让活动内容
                   在应用自身的源里执行。所以它单独有一条用例。
*/
import { describe, expect, it } from "vitest";

import {
  ARTIFACT_VIEWER_ROUTE,
  artifactViewerTitle,
  buildArtifactViewerURL,
  parseArtifactViewerParams,
  parseArtifactViewerQuery,
  resolveArtifactOpenURL,
  resolveStoredArtifactLanguage,
  requiresAuthenticatedViewer,
} from "@/core/artifacts/viewer";

const target = { filepath: "/mnt/user-data/outputs/a.md", threadId: "t-1" };

describe("哪些产物进应用内视窗", () => {
  it.each([
    ["markdown", "report.md"],
    ["csv", "data.csv"],
    ["tsv", "data.tsv"],
    [".skill 归档按 markdown", "pack.skill"],
  ])("%s 进视窗", (_label, name) => {
    const url = resolveArtifactOpenURL({
      filepath: `/o/${name}`,
      threadId: "t-1",
    });
    expect(url.startsWith(ARTIFACT_VIEWER_ROUTE)).toBe(true);
  });

  it.each([
    [
      "HTML——Gateway 故意作为下载返回，进视窗等于在应用源里执行活动内容",
      "page.html",
    ],
    ["SVG——同上", "icon.svg"],
    ["图片", "chart.png"],
    ["PDF", "doc.pdf"],
  ])("%s 交回 Gateway 原始 URL", (_label, name) => {
    const url = resolveArtifactOpenURL({
      filepath: `/o/${name}`,
      threadId: "t-1",
    });
    expect(url.startsWith(ARTIFACT_VIEWER_ROUTE)).toBe(false);
    expect(url).toContain("/api/");
  });
});

describe("视窗链接的构造与解析", () => {
  it("带上 path 与 thread_id，mock 才加 mock=true", () => {
    expect(buildArtifactViewerURL({ ...target, isMock: false })).not.toContain(
      "mock=",
    );
    expect(buildArtifactViewerURL({ ...target, isMock: true })).toContain(
      "mock=true",
    );
  });

  it("往返一致", () => {
    const url = buildArtifactViewerURL({ ...target, isMock: true });
    const parsed = parseArtifactViewerParams(
      new URLSearchParams(url.slice(url.indexOf("?"))),
    );
    expect(parsed).toEqual({ ...target, isMock: true });
  });

  it.each([
    ["缺 path", "?thread_id=t-1"],
    ["缺 thread_id", "?path=/o/a.md"],
    ["path 是空白", "?path=%20%20&thread_id=t-1"],
  ])("%s 视为无效链接", (_label, query) => {
    expect(parseArtifactViewerParams(new URLSearchParams(query))).toBeNull();
  });

  it("重复的查询参数取第一个——后追加的 ?path= 不该决定加载什么", () => {
    expect(
      parseArtifactViewerQuery({
        path: ["/o/first.md", "/o/second.md"],
        thread_id: "t-1",
      }),
    ).toMatchObject({ filepath: "/o/first.md" });
  });

  it("查询为空时返回 null", () => {
    expect(parseArtifactViewerQuery(undefined)).toBeNull();
  });

  it("不带 `=` 的参数（vue-router 给 null）当没给处理", () => {
    // `?path&thread_id=t-1` —— 手拼地址最容易出现的形状。
    expect(
      parseArtifactViewerQuery({ path: null, thread_id: "t-1" }),
    ).toBeNull();
    // 也不能变成字符串 "null" 一路传下去。
    expect(
      parseArtifactViewerQuery({ path: [null, "/o/a.md"], thread_id: "t-1" }),
    ).toBeNull();
  });
});

describe("其它", () => {
  it("标题用文件名，没有目标时退回产品名", () => {
    expect(artifactViewerTitle("/a/b/report.md")).toBe("report.md - DeerFlow");
    expect(artifactViewerTitle(undefined)).toBe("DeerFlow");
  });

  it("媒体类产物没有文本语言", () => {
    expect(resolveStoredArtifactLanguage("/o/chart.png")).toBeNull();
  });
});

/*
  演示产物是 Nitro mock 直接吐的固定内容，不碰 Gateway；除此之外的一切都要登录，
  包括「自称 mock 但指向别处」的地址——那种 query 谁都拼得出来。
*/
describe("requiresAuthenticatedViewer", () => {
  const DEMO_THREAD = "3823e443-4e2b-4679-b496-a9506eae462b";
  const DEMO_FILE = "/mnt/user-data/outputs/fei-fei-li-podcast-timeline.md";

  it("放行演示集里的那几件", () => {
    expect(
      requiresAuthenticatedViewer({
        filepath: DEMO_FILE,
        threadId: DEMO_THREAD,
        isMock: true,
      }),
    ).toBe(false);
  });

  it("真实产物一律要登录", () => {
    expect(
      requiresAuthenticatedViewer({
        filepath: DEMO_FILE,
        threadId: DEMO_THREAD,
        isMock: false,
      }),
    ).toBe(true);
  });

  it("自称 mock 但不在演示集里的，仍然要登录", () => {
    for (const target of [
      { filepath: "/mnt/user-data/outputs/secret.md", threadId: DEMO_THREAD },
      { filepath: DEMO_FILE, threadId: "not-a-demo-thread" },
      { filepath: "/etc/passwd", threadId: DEMO_THREAD },
      { filepath: "/mnt/../etc/passwd", threadId: DEMO_THREAD },
    ]) {
      expect(
        requiresAuthenticatedViewer({ ...target, isMock: true }),
        target.filepath + " @ " + target.threadId,
      ).toBe(true);
    }
  });
});
