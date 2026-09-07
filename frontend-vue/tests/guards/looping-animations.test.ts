/*
  【文件职责】     凡是会无限循环的动画，都必须在 baseline/looping-animations.json 里
                   有名有姓、写清减动偏好下停不停以及为什么。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     baseline/looping-animations.json · app/**
  【边界与注意】   **这条门禁不证明「门控了」，它保证「表过态」。** 「门控了」由行为用例
                   去证（tests/e2e/reduced-motion.spec.ts 读的是浏览器算出来的
                   `animationName`）。这里挡的是**下一条**——今天没人拦着谁再写一条
                   无限动画而不理会 `prefers-reduced-motion`；wave 160~162 修掉的四条
                   正是这样长出来的。

                   **为什么判据不是「无限即必须 motion-safe」**：那条需要豁免表。
                   `animate-spin` / `animate-pulse` 是**状态指示**——转圈本身就是
                   「还在等」的全部信息，冻住之后用户看到的是「卡住了」，那是把界面变成
                   撒谎，比不理会偏好更糟。需要豁免表就说明判据错了（坑 180）。
                   换成「必须表态」之后零豁免：新加一条不登记就红。

                   扫描面自证：下面第一条用例先要求扫得到几处已知的动画，
                   目录挪走 / 正则写坏都会让它先红，而不是让后面那条静默全绿。

                   **扫之前先剥注释**（坑 202）：这份文件自己的头注释里就写着
                   `infinite` 这个词，不剥的话它会把注释当成源码扫进来。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app/", import.meta.url));
const baseline = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../baseline/looping-animations.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  animations: { id: string; where: string; decision: string; why: string }[];
};

/** Tailwind 自带、默认就是 infinite 的工具类。 */
const INFINITE_UTILITIES = [
  "animate-spin",
  "animate-pulse",
  "animate-bounce",
  "animate-ping",
];

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = `${dir}${entry}`;
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(`${full}/`));
    } else if (/\.(vue|css|ts)$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

/** 去掉块注释、行注释与 HTML 注释，免得把说明文字当源码扫。 */
function stripComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1");
}

/** 从源码里扫出所有会无限循环的动画名。 */
function discover(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const note = (id: string, file: string) => {
    const at = found.get(id) ?? [];
    if (!at.includes(file)) at.push(file);
    found.set(id, at);
  };

  for (const file of sourceFiles(appDir)) {
    const relative = file.slice(appDir.length);
    const text = stripComments(readFileSync(file, "utf8"));

    // ① 手写的 `animation: <name> … infinite …`
    for (const match of text.matchAll(
      /animation:\s*([^;{}]*\binfinite\b[^;{}]*);/g,
    )) {
      const shorthand = match[1] ?? "";
      const name = shorthand
        .split(/\s+/)
        .find(
          (token) =>
            /^[A-Za-z][\w-]*$/.test(token) &&
            ![
              "infinite",
              "linear",
              "ease",
              "alternate",
              "both",
              "forwards",
              "normal",
              "reverse",
              "ease-in",
              "ease-out",
              "ease-in-out",
              "running",
              "paused",
            ].includes(token),
        );
      if (name) note(name, relative);
    }

    // ② 拆开写的 `animation-name` + `animation-iteration-count: infinite`
    if (/animation-iteration-count:\s*infinite/.test(text)) {
      const named = text.match(/animation-name:\s*([\w-]+)/);
      if (named?.[1]) note(named[1], relative);
    }

    // ③ Tailwind 自带的无限工具类（`motion-safe:` 前缀也算同一条）
    for (const utility of INFINITE_UTILITIES) {
      if (new RegExp(`(^|["'\\s:])${utility}(["'\\s]|$)`).test(text)) {
        note(utility, relative);
      }
    }
  }
  return found;
}

describe("会无限循环的动画", () => {
  it("扫描面自证：已知的几条都扫得到", () => {
    const found = discover();
    // 目录挪走、正则写坏、剥注释剥过头，都会让这一条先红。
    expect([...found.keys()].sort()).toEqual(
      expect.arrayContaining(["ambilight", "animate-spin", "shimmer"]),
    );
    expect(found.size).toBeGreaterThanOrEqual(5);
  });

  it("扫出来的全集与声明表逐字相等（两个方向）", () => {
    const found = new Set(discover().keys());
    const declared = new Set(baseline.animations.map((a) => a.id));
    const undeclared = [...found].filter((id) => !declared.has(id)).sort();
    const stale = [...declared].filter((id) => !found.has(id)).sort();
    expect({ undeclared, stale }).toEqual({ undeclared: [], stale: [] });
  });

  it("每一条都写清了停不停、在哪、为什么", () => {
    for (const animation of baseline.animations) {
      expect(["gated", "always"]).toContain(animation.decision);
      expect(animation.where.length).toBeGreaterThan(0);
      // 「因为要动」这种四个字的理由挡不住下一个人，要求写够。
      expect(animation.why.length).toBeGreaterThanOrEqual(40);
    }
  });

  it("声明为 gated 的，源码里确实有减动分支", () => {
    const missing: string[] = [];
    for (const animation of baseline.animations) {
      if (animation.decision !== "gated") continue;
      if (
        !animation.where.endsWith(".vue") &&
        !animation.where.endsWith(".css")
      )
        continue;
      const text = stripComments(
        readFileSync(
          fileURLToPath(new URL(`../../${animation.where}`, import.meta.url)),
          "utf8",
        ),
      );
      if (!/prefers-reduced-motion/.test(text)) missing.push(animation.id);
    }
    // 只是「有没有那条分支」的粗筛；停在哪、真停没停，由 e2e 的计算样式去核。
    expect(missing).toEqual([]);
  });
});
