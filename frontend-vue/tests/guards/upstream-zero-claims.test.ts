/*
  【文件职责】     把「上游这东西没人用」这类**散文断言**变成门禁。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     ../frontend/src（缺席则整组跳过）
  【边界与注意】   **这一类断言一旦过期，挡住的是一次真的对齐。** wave 34 的
                   `settings.memory.*` 就是活例子：交接把六条 key 记成「上游自己
                   也零消费」，实际上其中五条上游全在 `toast.success` 里，
                   本仓一条都没有——那句话把一次真缺口挡了**十轮**。

                   wave 47 把源码注释里 38 处「上游没有 X」逐条撞了一遍，**全部成立**。
                   但「今天成立」不等于「明天还成立」，而这类断言**没有任何门禁看着**：
                   上游哪天开始用它，本仓不会有任何东西变红。这里挑的是那几条
                   **一旦过期就会改变某个已决定的取舍**的，逐条钉住。

                   判据是「零消费」而不是「不存在」：上游把定义留着不用是常态
                   （它是被搬过来的组件库），**有人开始用它才是信号**。

                   `../frontend` 缺席时整组跳过——与 scenario-coverage / product-surface
                   同一条规矩，已声明进 `standalone-check.mjs` 的 CROSS_APP_BY_DESIGN。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const upstreamSrc = join(here, "../../../frontend/src");
const present = existsSync(upstreamSrc);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * 每条 = 一个「上游零消费」的断言 + 它过期时本仓要重新做的那个决定。
 * `definedIn` 是定义处（允许命中），其余任何文件命中都算「有人开始用了」。
 */
const ZERO_CONSUMER_CLAIMS = [
  {
    symbol: "onFollowupsVisibilityChange",
    definedIn: ["components/workspace/input-box.tsx"],
    why: "本仓 ChatComposer 有意不照抄这个 prop（它在上游是死接口）。上游一旦真用起来，本仓要重新看这个信号该不该往外传。",
  },
  {
    symbol: "PromptInputCommand",
    definedIn: ["components/ai-elements/prompt-input.tsx"],
    why: "wave 39 的 cmdk 空 label 缺陷两边同改时，这是上游第三个 `<Command>` 调用点、当时没有消费者。它一旦被用起来，那处修法要跟着扩到这里。",
  },
] as const;

describe.skipIf(!present)("上游「零消费」断言", () => {
  const files = present ? walk(upstreamSrc) : [];

  it("扫到了上游文件（清单空掉时不能假绿）", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(ZERO_CONSUMER_CLAIMS)(
    "$symbol 在上游仍然只出现在定义处",
    ({ symbol, definedIn, why }) => {
      const consumers = files.filter((file) => {
        const rel = file.slice(upstreamSrc.length + 1);
        if (definedIn.some((allowed) => rel === allowed)) return false;
        return readFileSync(file, "utf8").includes(symbol);
      });
      expect(
        consumers.map((file) => file.slice(upstreamSrc.length + 1)),
        `${symbol} 在上游有了消费者。${why}`,
      ).toEqual([]);
    },
  );

  it("定义处本身还在（符号改名时不能静默全绿）", () => {
    // 少了这条，上游把符号删掉或改名会让上面每一条都「零消费」通过。
    for (const { symbol, definedIn } of ZERO_CONSUMER_CLAIMS) {
      const found = definedIn.some((rel) =>
        readFileSync(join(upstreamSrc, rel), "utf8").includes(symbol),
      );
      expect(found, `${symbol} 在它的定义处找不到了`).toBe(true);
    }
  });
});
