import { expect, test } from "vitest";

import {
  appendHtmlPreviewBaseHref,
  appendHtmlPreviewScrollRestoration,
  buildWriteFileDraftContent,
  collectHtmlPreviewResourceUrls,
  createHtmlPreviewScrollKey,
  getArtifactViewState,
  hasMalformedCompletedHtmlDocument,
  resolveHtmlPreviewResourceReference,
  rewriteHtmlPreviewResourceUrls,
} from "@/core/artifacts/preview";

test("gives script-created relative URLs the artifact base without replacing a real base tag", () => {
  const url = "/api/threads/thread-1/artifacts/mnt/user-data/outputs/page.html";
  const html =
    '<html><head></head><body><script>fetch("data.json")</script></body></html>';
  expect(
    appendHtmlPreviewBaseHref(html, url, "https://deer.example/workspace"),
  ).toContain(
    '<head><base href="https://deer.example/api/threads/thread-1/artifacts/mnt/user-data/outputs/">',
  );
  const withBase =
    '<html><head><base href="https://example.com/"></head></html>';
  expect(appendHtmlPreviewBaseHref(withBase, url)).toBe(withBase);
  expect(
    appendHtmlPreviewBaseHref(
      '<!-- <base href="fake"> --><header>Hi</header>',
      url,
    ),
  ).toMatch(/^<base href=/);
});

const ARTIFACT_PATH = "/artifact-fixtures/report.html";
const UNSUPPORTED_ARTIFACT_PATH = "/artifact-fixtures/data.csv";

test("allows in-progress write artifacts to render a throttled preview", () => {
  expect(
    getArtifactViewState({
      filepath: `write-file:${ARTIFACT_PATH}?message_id=ai-1&tool_call_id=call-1`,
      isSupportPreview: true,
    }),
  ).toEqual({
    canPreview: true,
    initialViewMode: "preview",
  });
});

test("allows preview for a write artifact once the tool call has a result", () => {
  expect(
    getArtifactViewState({
      filepath: `write-file:${ARTIFACT_PATH}?message_id=ai-1&tool_call_id=call-1`,
      isSupportPreview: true,
      toolResult: "OK",
    }),
  ).toEqual({
    canPreview: true,
    initialViewMode: "preview",
  });
});

test("keeps failed write artifacts in code view", () => {
  expect(
    getArtifactViewState({
      filepath: `write-file:${ARTIFACT_PATH}?message_id=ai-1&tool_call_id=call-1`,
      isSupportPreview: true,
      toolResult: "Error: Failed to write file",
    }),
  ).toEqual({
    canPreview: false,
    initialViewMode: "code",
  });
});

test("keeps malformed completed HTML write artifacts in code view", () => {
  expect(
    getArtifactViewState({
      filepath: `write-file:${ARTIFACT_PATH}?message_id=ai-1&tool_call_id=call-1`,
      isSupportPreview: true,
      toolResult: "OK",
      content:
        "/* TIMELINE */\n.timeline{color:red}</style></head><body><h1>Broken</h1></body></html>",
    }),
  ).toEqual({
    canPreview: false,
    initialViewMode: "code",
  });
});

test("detects malformed completed HTML but allows incomplete prefix chunks", () => {
  expect(
    hasMalformedCompletedHtmlDocument(
      "/* TIMELINE */\n.timeline{color:red}</style></head><body><h1>Broken</h1></body></html>",
    ),
  ).toBe(true);
  expect(
    hasMalformedCompletedHtmlDocument(
      "<!doctype html><html><head><style>.hero{color:red}",
    ),
  ).toBe(false);
  expect(
    hasMalformedCompletedHtmlDocument(
      "<!doctype html><html><head><style>.hero{color:red}</style></head><body><h1>OK</h1></body></html>",
    ),
  ).toBe(false);
  expect(
    hasMalformedCompletedHtmlDocument(
      "<!doctype html><html><body><h1>OK</h1></body></html>",
    ),
  ).toBe(false);
});

test("keeps completed artifacts on their existing preview defaults", () => {
  expect(
    getArtifactViewState({
      filepath: ARTIFACT_PATH,
      isSupportPreview: true,
    }),
  ).toEqual({
    canPreview: true,
    initialViewMode: "preview",
  });
});

test("keeps unsupported artifacts in code view", () => {
  expect(
    getArtifactViewState({
      filepath: UNSUPPORTED_ARTIFACT_PATH,
      isSupportPreview: false,
    }),
  ).toEqual({
    canPreview: false,
    initialViewMode: "code",
  });
});

test("builds a draft write-file artifact from successful writes plus the selected in-progress append", () => {
  const filepath = `write-file:${ARTIFACT_PATH}?message_id=ai-2&tool_call_id=call-2`;

  expect(
    buildWriteFileDraftContent({
      filepath,
      messages: [
        {
          type: "ai",
          id: "ai-1",
          tool_calls: [
            {
              id: "call-1",
              name: "write_file",
              args: {
                path: ARTIFACT_PATH,
                content: "<!doctype html><html><body>",
              },
            },
          ],
        },
        {
          type: "tool",
          id: "tool-1",
          name: "write_file",
          tool_call_id: "call-1",
          content: "OK",
        },
        {
          type: "ai",
          id: "ai-2",
          tool_calls: [
            {
              id: "call-2",
              name: "write_file",
              args: {
                append: true,
                path: ARTIFACT_PATH,
                content: "<p>追加内容</p>",
              },
            },
          ],
        },
      ],
    }),
  ).toBe("<!doctype html><html><body><p>追加内容</p>");
});

test("does not include failed writes in a draft artifact", () => {
  const filepath = `write-file:${ARTIFACT_PATH}?message_id=ai-3&tool_call_id=call-3`;

  expect(
    buildWriteFileDraftContent({
      filepath,
      messages: [
        {
          type: "ai",
          id: "ai-1",
          tool_calls: [
            {
              id: "call-1",
              name: "write_file",
              args: {
                path: ARTIFACT_PATH,
                content: "<html>",
              },
            },
          ],
        },
        {
          type: "tool",
          id: "tool-1",
          name: "write_file",
          tool_call_id: "call-1",
          content: "OK",
        },
        {
          type: "ai",
          id: "ai-2",
          tool_calls: [
            {
              id: "call-2",
              name: "write_file",
              args: {
                append: true,
                path: ARTIFACT_PATH,
                content: "<p>失败内容</p>",
              },
            },
          ],
        },
        {
          type: "tool",
          id: "tool-2",
          name: "write_file",
          tool_call_id: "call-2",
          content: "Error: write failed",
        },
        {
          type: "ai",
          id: "ai-3",
          tool_calls: [
            {
              id: "call-3",
              name: "write_file",
              args: {
                append: true,
                path: ARTIFACT_PATH,
                content: "</html>",
              },
            },
          ],
        },
      ],
    }),
  ).toBe("<html></html>");
});

test("returns undefined when the selected append failed so the caller can fall back", () => {
  const filepath = `write-file:${ARTIFACT_PATH}?message_id=ai-2&tool_call_id=call-2`;

  expect(
    buildWriteFileDraftContent({
      filepath,
      messages: [
        {
          type: "ai",
          id: "ai-1",
          tool_calls: [
            {
              id: "call-1",
              name: "write_file",
              args: {
                path: ARTIFACT_PATH,
                content: "<html>",
              },
            },
          ],
        },
        {
          type: "tool",
          id: "tool-1",
          name: "write_file",
          tool_call_id: "call-1",
          content: "OK",
        },
        {
          type: "ai",
          id: "ai-2",
          tool_calls: [
            {
              id: "call-2",
              name: "write_file",
              args: {
                append: true,
                path: ARTIFACT_PATH,
                content: "<p>失败的追加内容</p>",
              },
            },
          ],
        },
        {
          type: "tool",
          id: "tool-2",
          name: "write_file",
          tool_call_id: "call-2",
          content: "Error: write failed",
        },
      ],
    }),
  ).toBeUndefined();
});

test("injects scroll restoration at the start of the HTML head", () => {
  const html =
    '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'none\'"></head><body><main>content</main></body></html>';

  expect(appendHtmlPreviewScrollRestoration(html, ARTIFACT_PATH)).toContain(
    "<script data-deerflow-artifact-scroll-restoration>",
  );
  expect(appendHtmlPreviewScrollRestoration(html, ARTIFACT_PATH)).toContain(
    "<head><script data-deerflow-artifact-scroll-restoration>",
  );
});

test("preserves existing head elements when injecting scroll restoration", () => {
  const html =
    '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'none\'"></head><body><main>content</main></body></html>';
  const result = appendHtmlPreviewScrollRestoration(html, ARTIFACT_PATH);

  expect(result).toContain('<meta http-equiv="Content-Security-Policy"');
  expect(
    result.indexOf("data-deerflow-artifact-scroll-restoration"),
  ).toBeLessThan(result.indexOf('<meta http-equiv="Content-Security-Policy"'));
});

test("rewrites relative HTML preview resources to artifact URLs", () => {
  const html =
    '<!doctype html><html><head><title>Preview</title><link rel="stylesheet" href="style.css"><style>.hero{background:url(texture.png)}</style></head><body><a href="page.html">link</a><img src="beautiful-woman.jpg" srcset="small.jpg 1x, large.jpg 2x"><video poster="/mnt/user-data/outputs/poster.jpg"></video><div style="background:url(card.png)"></div></body></html>';
  const result = rewriteHtmlPreviewResourceUrls(
    html,
    "/api/threads/thread-1/artifacts/mnt/user-data/outputs/index.html",
    "http://localhost/workspace/chats/thread-1",
  );

  expect(result).toContain(
    'src="http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/beautiful-woman.jpg"',
  );
  expect(result).toContain(
    'srcset="http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/small.jpg 1x, http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/large.jpg 2x"',
  );
  expect(result).toContain(
    'href="http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/style.css"',
  );
  expect(result).toContain(
    'poster="http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/poster.jpg"',
  );
  expect(result).toContain(
    "background:url(http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/texture.png)",
  );
  expect(result).toContain(
    'style="background:url(http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/card.png)"',
  );
  expect(result).toContain('<a href="page.html">link</a>');
});

test("can map resolved HTML preview resources to embedded URLs", () => {
  const html =
    '<html><body><img src="portrait.jpg"><div style="background:url(card.png)"></div></body></html>';
  const resourceUrlMap = new Map([
    [
      "http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/portrait.jpg",
      "data:image/jpeg;base64,image-data",
    ],
    [
      "http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/card.png",
      "data:image/png;base64,card-data",
    ],
  ]);

  expect(
    rewriteHtmlPreviewResourceUrls(
      html,
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/index.html",
      "http://localhost/workspace/chats/thread-1",
      resourceUrlMap,
    ),
  ).toContain('src="data:image/jpeg;base64,image-data"');
  expect(
    rewriteHtmlPreviewResourceUrls(
      html,
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/index.html",
      "http://localhost/workspace/chats/thread-1",
      resourceUrlMap,
    ),
  ).toContain("background:url(data:image/png;base64,card-data)");
});

test("collects HTML preview resource references before rewriting", () => {
  expect(
    collectHtmlPreviewResourceUrls(
      '<html><head><link rel="stylesheet" href="style.css"><style>.hero{background:url(texture.png)}</style></head><body><a href="page.html">link</a><img src="portrait.jpg" srcset="small.jpg 1x, large.jpg 2x"></body></html>',
    ),
  ).toEqual([
    "texture.png",
    "style.css",
    "portrait.jpg",
    "small.jpg",
    "large.jpg",
  ]);
});

test("resolves HTML preview resource references against the artifact file", () => {
  expect(
    resolveHtmlPreviewResourceReference(
      "portrait.jpg",
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/index.html",
      "http://localhost/workspace/chats/thread-1",
    ),
  ).toBe(
    "http://localhost/api/threads/thread-1/artifacts/mnt/user-data/outputs/portrait.jpg",
  );
});

test("leaves external and inline HTML preview resources alone", () => {
  const html =
    '<html><body><img src="https://example.com/a.jpg"><img src="data:image/png;base64,aaa"><source srcset="data:image/png;base64,aaa 1x"><div style="background:url(blob:http://localhost/x)"></div></body></html>';

  expect(
    rewriteHtmlPreviewResourceUrls(
      html,
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/index.html",
      "http://localhost/workspace/chats/thread-1",
    ),
  ).toBe(html);
});

test("does not duplicate HTML scroll restoration script", () => {
  const html = appendHtmlPreviewScrollRestoration(
    "<html><body>x</body></html>",
  );

  expect(
    appendHtmlPreviewScrollRestoration(html).match(
      /data-deerflow-artifact-scroll-restoration/g,
    ),
  ).toHaveLength(1);
});

test("scopes HTML scroll restoration without exposing the artifact path", () => {
  const artifactPath =
    '/artifact-fixtures/a</script><script>alert("x")</script>.html';
  const html = appendHtmlPreviewScrollRestoration(
    "<html><body>x</body></html>",
    artifactPath,
  );

  expect(html).toContain(createHtmlPreviewScrollKey(artifactPath));
  expect(html).toContain("window.parent.postMessage");
  expect(html).not.toContain("window.name");
  expect(html).not.toContain("/artifact-fixtures/a");
  expect(html).not.toContain("<script>alert");
});
