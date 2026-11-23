/*
  【文件职责】     守住签入的 golden 夹具，它的出处标签与上游实际装的版本一致。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/fixtures/react-markdown-dom.json · ../frontend/node_modules/streamdown
  【边界与注意】   `react-markdown-dom.json` 是 **markdown 对齐的全部依据**——本仓渲染出来
                   的 DOM 与它比。它的 `recordedFrom` 写着「streamdown 2.5.0」，
                   **而在 wave 49 之前没有任何东西验过这句话**。

                   两个失效模式，都不会有任何门禁变红：

                   1. **上游升级、夹具没重录** → 本仓继续对着旧版本的 DOM 对齐，
                      而对照台账看不到（markdown 那一屏的差异被夹具吸收掉了）。
                   2. **重录了，但出处是假的** → 录制脚本原来把版本号**写死**在
                      字面量里（`record-react-markdown.mjs`），升级后重录会盖上一个
                      与内容不符的标签。已改成从
                      `frontend/node_modules/streamdown/package.json` 读。

                   判据只钉**版本号一致**，不钉夹具内容——内容对不对是
                   `record-react-markdown.mjs --check` 的事（它重录一遍逐字节比）。
                   这里钉的是「那份 --check 到底在跟哪个版本比」。

                   `../frontend` 缺席时整组跳过：夹具是签入的，本仓的
                   install/build/test 都不依赖兄弟应用。已声明进 `standalone-check.mjs`。

                   **第二组是 SSE golden trace 的出处**，同一个失效模式换了个地方：
                   `tests/fixtures/streams/README.md` 写着「录自哪次录制、用的什么请求」，
                   而在此之前只有**内容**被钉住（`doc-facts.test.ts` 比帧数与各事件条数），
                   **怎么录的那半边一个字都没人验**。改了录制器的 stream_mode、
                   或者把套件的 --queue-maxsize 调了，README 照样全绿——
                   下一个照着它重录的人会拿到一份形状不同的夹具。
                   所以这里钉的是**标签 == 录制器/套件配置真的在做的事**。

                   录制时的仓库 commit 那一行**有意不钉**：唯一的验法是拿它去 git 里
                   解析，而浅克隆（CI 常见的 fetch-depth 1）解析不出历史里的老 commit，
                   会变成一条与产品无关的红。它是纯历史标签，如实说明它没有门禁。
*/

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../..");
const manifest = join(root, "../frontend/node_modules/streamdown/package.json");
const fixturePath = join(root, "tests/fixtures/react-markdown-dom.json");
const present = existsSync(manifest);

describe.skipIf(!present)("golden 夹具的出处", () => {
  const installed = present
    ? (JSON.parse(readFileSync(manifest, "utf8")) as { version?: string })
        .version
    : undefined;
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    $comment?: string;
    recordedFrom?: string;
  };

  it("读到了两边的版本（任一边空掉时不能假绿）", () => {
    expect(installed, "上游 streamdown 的 package.json 里没有 version").toMatch(
      /^\d+\.\d+\.\d+/,
    );
    expect(fixture.recordedFrom).toContain("streamdown ");
  });

  it("夹具标注的 streamdown 版本 == 上游实际装的版本", () => {
    const stamped = /streamdown (\d+\.\d+\.\d+[^\s·]*)/.exec(
      fixture.recordedFrom ?? "",
    )?.[1];
    expect(
      stamped,
      `夹具录自 streamdown ${stamped}，上游现在装的是 ${installed}。` +
        "重录：`node scripts/record-react-markdown.mjs`（它会把新版本号一起写进出处）。",
    ).toBe(installed);
  });

  it("$comment 里的版本号与 recordedFrom 一致（两处不许各说各的）", () => {
    const inComment = /streamdown@(\d+\.\d+\.\d+[^\s`]*)/.exec(
      fixture.$comment ?? "",
    )?.[1];
    const stamped = /streamdown (\d+\.\d+\.\d+[^\s·]*)/.exec(
      fixture.recordedFrom ?? "",
    )?.[1];
    expect(inComment).toBe(stamped);
  });

  it("records the actual KaTeX renderer version, shared by both applications", () => {
    const reactMath = JSON.parse(
      readFileSync(
        join(root, "../frontend/node_modules/katex/package.json"),
        "utf8",
      ),
    ) as { version: string };
    const vueMath = JSON.parse(
      readFileSync(join(root, "node_modules/katex/package.json"), "utf8"),
    ) as { version: string };
    const stamped = /katex (\d+\.\d+\.\d+[^\s·]*)/.exec(
      fixture.recordedFrom ?? "",
    )?.[1];
    expect(stamped).toBe(reactMath.version);
    expect(vueMath.version).toBe(reactMath.version);
    expect(fixture.$comment).toContain(`katex@${reactMath.version}`);
  });

  it("resolves Mermaid, DOMPurify, nested KaTeX and styles identically on both sides", () => {
    const reactRequire = createRequire(join(root, "../frontend/package.json"));
    const vueRequire = createRequire(join(root, "package.json"));
    const reactMermaid = createRequire(
      realpathSync(
        join(root, "../frontend/node_modules/@streamdown/mermaid/package.json"),
      ),
    );
    const packageVersion = (resolver: NodeJS.Require, name: string) => {
      let dir = dirname(resolver.resolve(name));
      while (dir !== dirname(dir)) {
        const file = join(dir, "package.json");
        if (existsSync(file)) {
          const pkg = JSON.parse(readFileSync(file, "utf8")) as {
            name: string;
            version: string;
          };
          if (pkg.name === name) return pkg.version;
        }
        dir = dirname(dir);
      }
      throw new Error(`Cannot locate ${name} package manifest`);
    };
    expect(packageVersion(reactMermaid, "mermaid")).toBe(
      packageVersion(vueRequire, "mermaid"),
    );
    const reactDiagram = createRequire(reactMermaid.resolve("mermaid"));
    const vueDiagram = createRequire(vueRequire.resolve("mermaid"));
    expect(packageVersion(reactDiagram, "dompurify")).toBe(
      packageVersion(vueDiagram, "dompurify"),
    );
    expect(packageVersion(reactDiagram, "katex")).toBe(
      packageVersion(vueRequire, "katex"),
    );
    expect(
      packageVersion(
        createRequire(reactRequire.resolve("rehype-katex")),
        "katex",
      ),
    ).toBe(packageVersion(vueRequire, "katex"));
    expect(
      packageVersion(
        createRequire(vueRequire.resolve("rehype-katex")),
        "katex",
      ),
    ).toBe(packageVersion(vueRequire, "katex"));
    expect(
      readFileSync(reactRequire.resolve("katex/dist/katex.min.css"), "utf8"),
    ).toBe(
      readFileSync(vueRequire.resolve("katex/dist/katex.min.css"), "utf8"),
    );
  });
});

describe("Vue renderer/compiler runtime identity", () => {
  it("shares the exact Vue runtime with the server renderer and compiler", () => {
    const require = createRequire(join(root, "package.json"));
    const vue = require("vue") as { version: string };
    const compiler = require("vue/compiler-sfc") as { version: string };
    const own = createRequire(require.resolve("vue/package.json"));
    const renderer = own.resolve("@vue/server-renderer");
    const rendererVersion = (
      JSON.parse(
        readFileSync(own.resolve("@vue/server-renderer/package.json"), "utf8"),
      ) as { version: string }
    ).version;
    expect(compiler.version).toBe(vue.version);
    expect(rendererVersion).toBe(vue.version);
    expect(createRequire(renderer).resolve("vue")).toBe(require.resolve("vue"));
  });
});

/*
  第二组：SSE golden trace 的出处。这一组不碰 `../frontend`，所以不跟着上面那个
  skipIf 走；只有「那份 replay fixture 真的在」这一条要 `../backend`。
*/
const streamsDoc = readFileSync(
  join(root, "tests/fixtures/streams/README.md"),
  "utf8",
);
const recorder = readFileSync(
  join(root, "tests/e2e-protocol/run-protocol.spec.ts"),
  "utf8",
);
const protocolConfig = readFileSync(
  join(root, "playwright.protocol.config.ts"),
  "utf8",
);

describe("SSE golden trace 的出处", () => {
  it("README 写的 stream_mode == 录制器真的请求的那几种", () => {
    const block = /stream_mode: \[([^\]]+)\]/.exec(recorder)?.[1];
    expect(block, "录制器里找不到 stream_mode 数组").toBeTruthy();
    const requested = [...(block ?? "").matchAll(/"([^"]+)"/g)].map(
      (m) => m[1],
    );
    const row = /请求的 stream_mode\s*\|([^|]*)\|/.exec(streamsDoc)?.[1];
    expect(row, "README 的元数据表里找不到 stream_mode 那一行").toBeTruthy();
    const documented = [...(row ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    // 两边都空掉时 toEqual 会假绿——先钉住「真的解析出东西了」。
    expect(requested.length).toBeGreaterThan(3);
    expect(
      documented,
      "录制器改了请求模式，README 还在写旧的那几种；照着它重录会得到形状不同的夹具",
    ).toEqual(requested);
  });

  it("README 写的 --queue-maxsize == 套件真的传给 Gateway 的值", () => {
    const configured = /"--queue-maxsize",\s*"(\d+)"/.exec(protocolConfig)?.[1];
    expect(configured, "套件配置里找不到 --queue-maxsize").toMatch(/^\d+$/);
    const documented = /run_m0_gateway\.py --queue-maxsize (\d+)/.exec(
      streamsDoc,
    )?.[1];
    expect(
      documented,
      "这个窗口要落在实时爆发量与总事件数之间；README 写错了，重录出来的 create 流会自己被 gap",
    ).toBe(configured);
  });

  it("README 写的录制场景 == 录制器真的读的那份 replay fixture", () => {
    const used = /"(\.\.\/backend\/[^"]+\.json)"/.exec(recorder)?.[1];
    expect(used, "录制器里找不到它读的 replay fixture").toBeTruthy();
    const documented = /`(backend\/[^`]+\.json)`/.exec(streamsDoc)?.[1];
    expect(documented, "README 的元数据表里找不到录制场景").toBeTruthy();
    expect(`../${documented}`).toBe(used);
  });

  it.skipIf(!existsSync(join(root, "../backend")))(
    "那份 replay fixture 在 checkout 里真的存在",
    () => {
      const used = /"(\.\.\/backend\/[^"]+\.json)"/.exec(recorder)?.[1] ?? "";
      expect(used).not.toBe("");
      expect({ used, exists: existsSync(join(root, used)) }).toEqual({
        used,
        exists: true,
      });
    },
  );
});
