/*
  【文件职责】     不许有任何元素把「自己看不看得见」挂在动画跑不跑上。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/**（CSS 与 SFC 的 scoped 样式）
  【边界与注意】   判据只有一条，而且是纯静态的：
                   **`0%`/`from` 帧把 `opacity` 设成 0 的动画，声明里必须有 `both` 或
                   `backwards`，不许只有 `forwards`。**

                   为什么这条就够：`forwards` 只保住**最后**一帧，错峰入场需要的
                   `animation-delay` 期间没有任何东西画第一帧——于是调用方只能自己把
                   元素设成透明（`opacity-0` 或内联 `opacity: 0`）。从那一刻起元素的
                   **静止态**就是不可见的，动画一旦被跳过（减动分支、打印、跳过动画的
                   浏览器）内容就永久消失。`both` 里的 `backwards` 负责延时那一帧，
                   调用方不必藏任何东西，静止态自然可见。

                   上游 2026-09-08 一天之内出现过两处同形缺陷（建议芯片、消息骨架屏），
                   都是这个写法。上游侧的同一条守卫在
                   `frontend/tests/unit/styles/animation-visibility.test.ts`。

                   **判据钉在声明上而不是调用点**：选择是在声明处做的；而且调用点扫描
                   要把 `class` 与几行之外的 `style` 关联起来——那正是人肉扫描漏掉第二处
                   的原因。第二条用例补上「同一串 class 里既有 animate- 又有 opacity-0」
                   这半边，两条合起来两个方向都堵住。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app/", import.meta.url));

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = `${dir}${entry}`;
    if (statSync(full).isDirectory()) found.push(...sourceFiles(`${full}/`));
    else if (/\.(vue|css)$/.test(entry)) found.push(full);
  }
  return found;
}

/**
 * 剥掉注释再扫。**这一条是被自己抓到的**：`WelcomeSuggestionList.vue` 的注释里就写着
 * 「`animate-fade-in-up + opacity-0 + forwards`」在解释这条规则本身，不剥的话守卫会把
 * 那句解释当成违规。本仓同一个坑这一天里撞了三次（looping-animations、两处脚本 flag）。
 */
function stripComments(text: string): string {
  return text
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, "$1");
}

type Animation = {
  where: string;
  name: string;
  declaration: string;
  startsHidden: boolean;
};

/** 收集每个文件里的 `animation:` 简写，并回查它的 keyframes 起点。 */
function animations(): Animation[] {
  const found: Animation[] = [];
  for (const file of sourceFiles(appDir)) {
    const relative = file.slice(appDir.length);
    const text = stripComments(readFileSync(file, "utf8"));
    for (const match of text.matchAll(/animation:\s*([^;{}]+);/g)) {
      const declaration = (match[1] ?? "").trim();
      if (declaration === "none") continue;
      const name = declaration
        .split(/\s+/)
        .find(
          (token) => /^[A-Za-z][\w-]*$/.test(token) && !KEYWORDS.has(token),
        );
      if (!name) continue;
      const frames = new RegExp(
        `@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`,
      ).exec(text);
      const first = /(?:0%|from)\s*\{([^}]*)\}/.exec(frames?.[1] ?? "");
      found.push({
        where: relative,
        name,
        declaration,
        startsHidden: Boolean(first && /opacity:\s*0\b/.test(first[1] ?? "")),
      });
    }
  }
  return found;
}

const KEYWORDS = new Set([
  "infinite",
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "alternate",
  "alternate-reverse",
  "reverse",
  "normal",
  "both",
  "forwards",
  "backwards",
  "none",
  "running",
  "paused",
]);

describe("动画与可见性", () => {
  it("扫描面自证：已知的几条动画都扫得到", () => {
    const names = animations().map((a) => a.name);
    // 目录挪走、正则写坏，都要让这一条先红，而不是让下面那条静默全绿。
    expect(names).toContain("fade-in-up");
    expect(names).toContain("ambilight");
    expect(names.length).toBeGreaterThanOrEqual(4);
  });

  it("起点透明的动画不许只写 forwards", () => {
    const offenders = animations()
      .filter(
        (a) => a.startsHidden && !/\b(both|backwards)\b/.test(a.declaration),
      )
      .map((a) => `${a.where}: ${a.name} — ${a.declaration}`);
    expect(offenders).toEqual([]);
  });

  it("同一串 class 里不许既有 animate- 又把自己藏起来", () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of sourceFiles(appDir)) {
      scanned += 1;
      for (const line of stripComments(readFileSync(file, "utf8")).split(
        "\n",
      )) {
        if (!/\banimate-[\w-]/.test(line)) continue;
        if (/\bopacity-0\b|\binvisible\b/.test(line)) {
          offenders.push(`${file.slice(appDir.length)}: ${line.trim()}`);
        }
      }
    }
    expect(scanned).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
