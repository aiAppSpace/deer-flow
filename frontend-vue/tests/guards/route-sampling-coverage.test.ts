/*
  【文件职责】     守住「哪些产品屏被取样面碰过」这个划分，零缺口。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/pages/** · tests/e2e-parity/support/scenarios.ts · baseline/parity-route-sampling.json
  【边界与注意】   **这是取样面的第二个坐标系，因为第一个会漏。**

                   `baseline/parity-scenario-coverage.json` 用上游 e2e spec 的文件名当坐标，
                   它自己也写明那是「React 认为哪些行为值得守住」的**代理**。
                   代理漏的是这一类：**上游没为某一屏写 spec，那一屏在那份棘轮里就不存在**。
                   wave 188 实测——那份棘轮 `pending: 0`、三桶恰好划分上游 28 份 spec、
                   一切正常，而本仓 14 条路由里**有 6 条从没出现在任何场景的 `path` 上**，
                   其中 `/login` 是每个用户看到的第一屏。
                   **「满覆盖」是真的，只是那句话说的不是「所有屏都比过」。**

                   所以这里换一个坐标系：路由。`sampled` **不存盘**——它从
                   `scenarios.ts` 的 `path` 反查出来，免得又多一份会烂的名单
                   （同 `parity-scenario-coverage.json` 的 covered）。
                   exempt 与 pending 两张表必须与「未取样」的集合**恰好相等**。

                   反查要处理动态段：场景里写的是
                   `/workspace/chats/00000000-…`，路由是 `/workspace/chats/[thread_id]`。
                   把路由编译成正则再匹配，比前缀判断准——前缀判断会让
                   `/workspace/chats/new` 同时算作 `[thread_id]` 被取样过。
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pagesDir = fileURLToPath(new URL("../../app/pages", import.meta.url));
/*
  **两份场景表都要扫。** 主对照套件（关掉鉴权）与开着鉴权那套各有一份；
  合并成一份会让棘轮把「只有 auth 套件跑得到的屏」也算成主套件覆盖了。
  分开放、这里一起读，才是「被任意一套取样过」。
*/
const scenarioFiles = [
  new URL("../e2e-parity/support/scenarios.ts", import.meta.url),
  new URL("../e2e-parity-auth/scenarios.ts", import.meta.url),
].map((url) => fileURLToPath(url));
const baseline = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../baseline/parity-route-sampling.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  exempt: { route: string; reason: string }[];
  pending: { route: string; reason: string }[];
};

/** Nuxt 的文件路由：`pages` 下每个 `.vue` 对应一条路由，`index.vue` 对应它所在目录本身。 */
function routesOf(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...routesOf(full, `${prefix}/${entry}`));
    } else if (entry.endsWith(".vue")) {
      const name = entry.slice(0, -".vue".length);
      found.push(name === "index" ? prefix || "/" : `${prefix}/${name}`);
    }
  }
  return found;
}

function stripComments(text: string): string {
  return text
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, "$1");
}

/**
 * 场景里出现过的 `path:`，去掉查询串。
 *
 * **模板字符串也要认。** 场景里一多半的路径长这样：
 * `` `/workspace/chats/${MOCK_THREAD_ID}` `` ——只扫双引号的话，这些屏一条都不算
 * 取样过，而门禁会照样绿（它们恰好也被别的字面量路径顺带匹配上了）。
 * `${…}` 整体替换成一个不含 `/` 的占位段，正好落进 routeMatcher 的 `[^/]+`。
 */
function sampledPaths(): string[] {
  return scenarioFiles.flatMap((file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    return [...source.matchAll(/path:\s*(?:"([^"]+)"|`([^`]+)`)/g)].map(
      (match) =>
        (match[1] ?? match[2]!).replaceAll(/\$\{[^}]*\}/g, "-").split("?")[0]!,
    );
  });
}

/** `/workspace/chats/[thread_id]` → 只匹配「恰好一段」的正则。 */
function routeMatcher(route: string): RegExp {
  const pattern = route
    .split("/")
    .map((segment) =>
      /^\[.*\]$/.test(segment)
        ? "[^/]+"
        : segment.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`),
    )
    .join("/");
  return new RegExp(`^${pattern}$`);
}

const routes = routesOf(pagesDir).sort();
const paths = sampledPaths();
const sampled = routes.filter((route) =>
  paths.some((path) => routeMatcher(route).test(path)),
);
const unsampled = routes.filter((route) => !sampled.includes(route));

describe("每一条产品路由要么被取样过，要么被表态过", () => {
  it("扫描面里确实有路由和取样点", () => {
    /*
      少了这一条，`app/pages` 改名或 `path:` 的写法一变，下面每条断言都会
      在空集上成立——而那个绿的意思是「一条都没找到」。
    */
    expect(routes.length).toBeGreaterThanOrEqual(10);
    expect(paths.length).toBeGreaterThanOrEqual(5);
    expect(sampled.length).toBeGreaterThanOrEqual(5);
  });

  it("exempt 与 pending 恰好划分「未取样」的全集", () => {
    const declared = [...baseline.exempt, ...baseline.pending].map(
      (entry) => entry.route,
    );
    expect(new Set(declared).size).toBe(declared.length);
    expect([...declared].sort()).toEqual([...unsampled].sort());
  });

  it("每一条表态都写得出理由", () => {
    for (const entry of [...baseline.exempt, ...baseline.pending]) {
      expect(entry.reason.length, entry.route).toBeGreaterThanOrEqual(20);
    }
  });
});
