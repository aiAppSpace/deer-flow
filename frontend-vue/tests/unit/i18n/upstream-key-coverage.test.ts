/*
  【文件职责】     守住「上游词典里的每一条，本仓都答得上」。
  【架构位置】     测试（对照工具，坐标系是上游词典）
  【主要导出】     无
  【依赖关系】     两个 en-US 词典（上游缺席则整组 skipIf）
  【边界与注意】   **这个方向此前完全没有门禁。** `vue-only-keys.test.ts` 守的是反方向
                   （本仓独有的块里不许有死条目）；`i18n-check` 守的是本仓自己的 key 集合
                   与基线一致。三者都看不见「上游新增了一条 key，本仓没有」。

                   wave 39 实测：上游有 **3** 条本仓没有的 key，而且是这么溜进来的——
                   wave 28 两边同改那颗浏览器关闭键时，给上游加了 `common.closeBrowser`，
                   本仓复用了既有的 `browser.close`。三条**渲染出来的字完全相同**，
                   所以没有用户可见差异；但没有守卫的话，下一次上游加的要是一条**新话**，
                   本仓就会静默地少一句。

                   所以判据不是「两边 key 集合相等」（那会逼着本仓照抄上游的分块，
                   而 primitives / browser / messages 这些本仓独有的块是有意的），
                   而是：**上游的每一条，要么本仓也有同名路径，要么在下面这张别名表里
                   写明本仓用哪一条顶它——且两条渲染出来的字必须一模一样。**
                   同字才叫别名；不同字就是少了一句话。

                   读上游词典是这条守卫的坐标系，所以它在 `standalone-check` 里登记成
                   DECLARED（与 `vue-only-keys.test.ts`、`scenario-coverage.test.ts` 同形）。
*/

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * 上游 key → 本仓顶它的那一条。
 *
 * 每加一行都是一次决定：先确认两边渲染的是同一句话，再写进来。
 * 不同字的话不要往这里加——那是本仓少了一句，该去补 UI。
 */
const ALIASES: Record<string, string> = {
  // wave 28 两边同改浏览器关闭键：上游新加了 common.closeBrowser，
  // 本仓复用既有的 browser.close（`browser` 是本仓独有的块）。
  "common.closeBrowser": "browser.close",
  // 本仓把会话列表的删除失败与重试放在 navigation.* 下（ThreadSidebar 用的就是它）。
  "chats.deleteChatFailed": "navigation.deleteConversationFailed",
  "chats.tryAgain": "navigation.tryAgain",
  // wave 169 两边同改历史加载占位：上游此前只有骨架、没有播报，本仓此前只有一行文字、
  // 没有骨架。两边都补齐之后上游新增了 conversation.loadingConversation，
  // 而本仓这句话早就在 messages.* 下（MessageList 一直在用）。
  "conversation.loadingConversation": "messages.loadingConversation",
};

const upstreamDictionary = fileURLToPath(
  new URL(
    "../../../../frontend/src/core/i18n/locales/en-US.ts",
    import.meta.url,
  ),
);
const vueDictionary = fileURLToPath(
  new URL("../../../app/core/i18n/locales/en-US.ts", import.meta.url),
);

/**
 * 抽出叶子 key → 字面量值。
 *
 * 只认字符串字面量：函数型词条（`(count) => …`）拿不到可比的值，
 * 它们仍然进 key 集合，只是不参与「两边同字」那一条。
 */
function readDictionary(path: string) {
  const keys = new Set<string>();
  const values = new Map<string, string>();
  const stack: string[] = [];
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    const open = /^([A-Za-z_$][\w$]*): \{$/.exec(line);
    if (open) {
      stack.push(open[1]!);
      continue;
    }
    if (line === "}," || line === "}") {
      stack.pop();
      continue;
    }
    const leaf = /^([A-Za-z_$][\w$]*):/.exec(line);
    if (!leaf || stack.length === 0) continue;
    const key = [...stack, leaf[1]!].join(".");
    keys.add(key);
    const literal = /^[A-Za-z_$][\w$]*: "((?:\\.|[^"\\])*)",?$/.exec(line);
    if (literal) values.set(key, literal[1]!);
  }
  return { keys, values };
}

/**
 * **`describe.skipIf` 跳过的是用例，不是收集。** 工厂函数照样执行一次，所以
 * 上游缺席时在这里裸调 `readDictionary(upstreamDictionary)` 会 ENOENT——
 * 报出来是「Failed Suite / 0 test」，`make verify` 当场红。
 *
 * wave 83 把 `../frontend` 真的移走跑了一遍才撞出来：文件头写着「整组 skipIf」、
 * `standalone-check` 也照抄了这句话，而那句话此前从来没有机器验过。
 * 同表里另外两个 `describe.skipIf` 的写法是对的（`upstream-zero-claims` 的
 * `present ? walk(...) : []`），照它来。
 */
const upstreamPresent = existsSync(upstreamDictionary);

describe.skipIf(!upstreamPresent)("上游词典的覆盖", () => {
  const upstream = upstreamPresent
    ? readDictionary(upstreamDictionary)
    : { keys: new Set<string>(), values: new Map<string, string>() };
  const vue = readDictionary(vueDictionary);
  const missing = [...upstream.keys].filter((key) => !vue.keys.has(key)).sort();

  it("上游的每一条，本仓要么同名有、要么在别名表里写明", () => {
    expect(
      missing,
      "上游新增了本仓没有的 key：本仓补一条同名的，或者确认已有哪一条顶它、" +
        "写进 ALIASES（两边必须是同一句话）。",
    ).toEqual(Object.keys(ALIASES).sort());
  });

  it("每条别名两边渲染的是同一句话", () => {
    const mismatched: string[] = [];
    for (const [upstreamKey, vueKey] of Object.entries(ALIASES)) {
      expect(vue.keys.has(vueKey), `别名目标 ${vueKey} 不存在`).toBe(true);
      const a = upstream.values.get(upstreamKey);
      const b = vue.values.get(vueKey);
      // 两边都是函数型词条时跳过：拿不到可比的值。
      if (a === undefined && b === undefined) continue;
      if (a !== b) mismatched.push(`${upstreamKey}="${a}" ≠ ${vueKey}="${b}"`);
    }
    expect(
      mismatched,
      "别名两边的字不一样——那不是别名，是本仓少了一句话。",
    ).toEqual([]);
  });
});
