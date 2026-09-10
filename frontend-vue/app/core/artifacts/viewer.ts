/*
  【文件职责】     独立产物视窗的路由地址、目标解析与标题。
  【架构位置】     L3 纯函数（不依赖 Vue）
  【主要导出】     ARTIFACT_VIEWER_ROUTE · ArtifactViewerTarget · resolveArtifactOpenURL ·
                   buildArtifactViewerURL · parseArtifactViewerParams ·
                   parseArtifactViewerQuery · artifactViewerTitle ·
                   requiresAuthenticatedViewer · resolveStoredArtifactLanguage
  【依赖关系】     ./policy(classifyArtifact, getTabularDelimiter) · ./display · ./utils
  【边界与注意】   **判「用哪种方式打开」走本仓的 `classifyArtifact`**，不引入上游那两个
                   散装函数（`checkCodeFile` / 自带的语言表）：本仓已经有一份统一的产物
                   分类策略，再并一套会出现两处对同一个扩展名给出不同答案。

                   **只有 markdown 与表格进应用内视窗**，其余保持 Gateway 原始 URL——
                   尤其是 HTML/SVG：Gateway 是**故意**把它们作为下载返回的，
                   让浏览器直接打开等于把活动内容放进应用自身的源里执行。

                   `buildArtifactViewerURL` 与 `resolveArtifactOpenURL` 的差别是有意的：
                   前者永远返回视窗路由，因为**视窗自己**（登录后重建回跳地址）需要它。
*/

import { resolveStaticDemoArtifact } from "#shared/showcase";

import { ARTIFACT_VIEWER_ROUTE } from "./viewer-route";

import { artifactFileName } from "./display";
import { classifyArtifact, getTabularDelimiter } from "./policy";
import { urlOfArtifact } from "./utils";

export { ARTIFACT_VIEWER_ROUTE } from "./viewer-route";

export interface ArtifactViewerTarget {
  filepath: string;
  threadId: string;
  isMock: boolean;
}

/** 产物面板用哪种「语言」渲染一件已存储的产物。 */
export function resolveStoredArtifactLanguage(filepath: string): string | null {
  const policy = classifyArtifact(filepath);
  return policy.kind === "text" ? policy.language : null;
}

/**
 * 产物面板「在新窗口打开」指向哪里。
 *
 * markdown 与表格走应用内视窗，用与面板相同的组件渲染；其余交回 Gateway 原始 URL。
 */
export function resolveArtifactOpenURL({
  filepath,
  threadId,
  isMock = false,
}: {
  filepath: string;
  threadId: string;
  isMock?: boolean;
}): string {
  const language = resolveStoredArtifactLanguage(filepath);
  if (language !== "markdown" && getTabularDelimiter(language) === null) {
    return urlOfArtifact({ filepath, threadId, isMock });
  }
  return buildArtifactViewerURL({ filepath, threadId, isMock });
}

/** 视窗路由的地址。与 `resolveArtifactOpenURL` 不同，它永远不回落到 Gateway URL。 */
export function buildArtifactViewerURL({
  filepath,
  threadId,
  isMock,
}: ArtifactViewerTarget): string {
  const params = new URLSearchParams({ path: filepath, thread_id: threadId });
  if (isMock) {
    params.set("mock", "true");
  }
  return `${ARTIFACT_VIEWER_ROUTE}?${params.toString()}`;
}

/** 从查询串里读回视窗目标；缺 path 或 thread_id 就是无效链接。 */
export function parseArtifactViewerParams(
  params: URLSearchParams,
): ArtifactViewerTarget | null {
  const filepath = params.get("path")?.trim();
  const threadId = params.get("thread_id")?.trim();
  if (!filepath || !threadId) {
    return null;
  }
  return { filepath, threadId, isMock: params.get("mock") === "true" };
}

/**
 * 把路由查询对象解析成视窗目标。
 *
 * **重复的查询参数取第一个**：一条被人在末尾又追加了 `?path=` 的分享链接，
 * 不该由后追加的那个决定窗口加载什么。
 */
/**
 * 把路由 query 收敛成一个目标。
 *
 * 值收 `null` 不是为了迁就类型：vue-router 把不带 `=` 的 `?filepath` 解析成
 * `null`，而那正是**手拼地址**最容易出现的形状——这里必须当「没给」处理，
 * 不能变成字符串 "null" 一路传下去。
 */
export function parseArtifactViewerQuery(
  query:
    | Record<
        string,
        string | string[] | null | undefined | readonly (string | null)[]
      >
    | undefined,
): ArtifactViewerTarget | null {
  if (!query) {
    return null;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") {
      params.set(key, first);
    }
  }
  return parseArtifactViewerParams(params);
}

/** 视窗的浏览器标签标题。 */
export function artifactViewerTitle(filepath: string | undefined): string {
  return filepath ? `${artifactFileName(filepath)} - DeerFlow` : "DeerFlow";
}

/**
 * 这个视窗要不要先登录。
 *
 * 只有**静态演示**产物例外：它由 Nitro 的 mock 路由直接吐出固定内容，压根不碰
 * Gateway，也就没有任何属于某个用户的东西可泄漏。除此之外一律要登录——
 * 包括「声称自己是 mock、但指向的不是演示集里那几件」的地址，那种参数是
 * 谁都能拼出来的。
 */
export function requiresAuthenticatedViewer(
  target: ArtifactViewerTarget,
): boolean {
  if (!target.isMock) return true;
  const segments = target.filepath
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment));
  return resolveStaticDemoArtifact(target.threadId, segments) === null;
}
