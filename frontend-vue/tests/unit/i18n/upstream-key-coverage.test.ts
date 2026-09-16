/*
  【文件职责】     守住「上游词典里的每一条，本仓都答得上」。
  【架构位置】     测试（对照工具，坐标系是上游词典）
  【主要导出】     无
  【依赖关系】     两个 en-US 词典（上游缺席则整组 skipIf）· baseline/upstream-i18n-map.json
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

                   合并 2026-09 上游后加了第三个桶（`baseline/upstream-i18n-map.json`）：
                   那一次上游把 `settings.account.*` / `settings.skills.*` /
                   `settings.integrations.*` 拍平到了顶层，一口气冒出 343 条本仓没有的 key。
                   下面这张 ALIASES 是**手工判过**的表，一次判 343 条会把它变成垃圾场；
                   而全塞进 ALIASES 也会把「上游改了路径」和「本仓少了一句话」混成一件事。
                   所以拆成三桶：ALIASES（手工判过的少数）、`movedByUpstream`（纯路径搬家，
                   两边渲染同一句话，**机器可验**）、`pending`（本仓还没有这个功能，人的决定）。
                   `pending` 那桶另有一条自证：**里面不许藏搬家**——本仓若已存在
                   「以 `.<该 key>` 结尾且同字」的条目，门禁会把它揪出来要求移进 movedByUpstream。

                   读上游词典是这条守卫的坐标系，所以它在 `standalone-check` 里登记成
                   DECLARED（与 `vue-only-keys.test.ts`、`scenario-coverage.test.ts` 同形）。
*/

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import MAP from "../../../baseline/upstream-i18n-map.json";

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
const upstreamDictionaryZh = fileURLToPath(
  new URL(
    "../../../../frontend/src/core/i18n/locales/zh-CN.ts",
    import.meta.url,
  ),
);
const vueDictionaryZh = fileURLToPath(
  new URL("../../../app/core/i18n/locales/zh-CN.ts", import.meta.url),
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
  let inTemplate = false;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    // 转义字符先剥掉，`\`` 不该被当成模板的起止。
    const backticks = (rawLine.replaceAll(/\\./g, "").match(/`/g) ?? []).length;
    const togglesTemplate = backticks % 2 === 1;
    if (inTemplate) {
      if (togglesTemplate) inTemplate = false;
      continue;
    }
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
    if (leaf && stack.length > 0) {
      const key = [...stack, leaf[1]!].join(".");
      keys.add(key);
      const literal = /^[A-Za-z_$][\w$]*: "((?:\\.|[^"\\])*)",?$/.exec(line);
      if (literal) values.set(key, literal[1]!);
    }
    /*
      **开启模板的那一行本身要先当普通行解析完**：`addServerPlaceholder: \`{`
      既是一条 key，又是一段跨行模板的开头。先 continue 再置位的话，这条 key
      会凭空消失——而它消失得毫无声息，只表现为「上游少了一条 key」。
    */
    if (togglesTemplate) inTemplate = true;
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

  const moved = MAP.movedByUpstream as Record<string, string>;
  const pending = MAP.pending.keys as string[];

  it("上游的每一条，本仓要么同名有、要么落进三个桶之一", () => {
    expect(
      missing,
      "上游新增了本仓没有的 key：补一条同名的，或者写进 ALIASES（手工判过的别名）/ " +
        "movedByUpstream（上游改了路径、本仓渲染同一句话）/ pending（本仓还没有这个功能）。" +
        "三个桶之外无处可去——这是故意的。",
    ).toEqual(
      [...Object.keys(ALIASES), ...Object.keys(moved), ...pending].sort(),
    );
  });

  it("movedByUpstream 的每一条都指向真存在、且渲染同一句话的本仓 key", () => {
    const bad: string[] = [];
    for (const [upstreamKey, vueKey] of Object.entries(moved)) {
      if (!vue.keys.has(vueKey)) {
        bad.push(`${upstreamKey} → ${vueKey}（目标不存在）`);
        continue;
      }
      const a = upstream.values.get(upstreamKey);
      const b = vue.values.get(vueKey);
      if (a === undefined && b === undefined) continue;
      if (a !== b) bad.push(`${upstreamKey}="${a}" ≠ ${vueKey}="${b}"`);
    }
    expect(bad, "路径搬家的两边必须是同一句话；不是的话它就不是搬家。").toEqual(
      [],
    );
  });

  /*
    **pending 里不许藏搬家。** 没有这一条的话，一条本仓其实已经有的话
    （只是路径不同）可以被顺手写进 pending，从此没人再看——那正是这张表
    要防的事。判据：pending 里的 key，本仓不能存在「以 `.<该 key>` 结尾
    且渲染同一句话」的条目；存在就说明它该进 movedByUpstream。
  */
  it("pending 里没有其实已经搬过家的条目", () => {
    const vueKeys = [...vue.keys];
    const shouldBeMoved: string[] = [];
    for (const key of pending) {
      const hits = vueKeys.filter((candidate) => candidate.endsWith(`.${key}`));
      if (hits.length !== 1) continue;
      const a = upstream.values.get(key);
      const b = vue.values.get(hits[0]!);
      if (a === undefined && b === undefined) {
        shouldBeMoved.push(`${key} → ${hits[0]}`);
        continue;
      }
      if (a !== undefined && a === b) shouldBeMoved.push(`${key} → ${hits[0]}`);
    }
    expect(
      shouldBeMoved,
      "这些 key 本仓其实已经有同一句话，只是路径不同：移到 movedByUpstream。",
    ).toEqual([]);
  });

  it("pending 的每个顶层块都写了理由", () => {
    const blocks = [
      ...new Set(pending.map((key) => key.split(".")[0]!)),
    ].sort();
    const reasons = MAP.pending.$reasons as Record<string, string>;
    expect(Object.keys(reasons).sort(), "理由表与实际块要一一对应").toEqual(
      blocks,
    );
    const thin = Object.entries(reasons)
      .filter(([, text]) => !text.includes("什么时候重新问"))
      .map(([block]) => block);
    expect(
      thin,
      "每一条『不做』要带上什么时候重新问一次，否则它就是一条没人会回看的豁免。",
    ).toEqual([]);
  });

  /*
    **同名 key 必须在两个应用里念同一句话——两种语言都要。**

    上面那条别名检查只覆盖手工判过的 4 条，而两边**同名**的条目有几百条，
    此前没有任何机器在比它们的**值**：`i18n-check` 只管本仓自己的 key 集合与基线，
    `vue-only-keys` 只管本仓独有块里有没有死条目，这一条之前只管「上游的 key 本仓有没有」。
    于是「同一个控件在两个应用里念两句不同的话」可以一直存在——
    账 H 就是这一类（只是它的形状更糟：上游**根本没进词典**，把英文写死在组件里）。

    判据是全称的，**零豁免**：第二十五轮实测 en-US 共有 666 条、zh-CN 共有 709 条，
    两种语言各 **0 条**不一致。也就是说这条不变量今天就成立，加门禁只是让它以后
    也成立——**不是**先立一条需要一张豁免表的规矩（线索 180）。

    真有一条该不同的时候，正确做法是让它**不同名**（本仓独有的块，或者进 ALIASES
    并写明理由），而不是在这里开一张白名单。
  */
  it("两边同名的词条，两种语言都念同一句话", () => {
    const pairs = [
      ["en-US", upstream.values, vue.values],
      [
        "zh-CN",
        upstreamPresent
          ? readDictionary(upstreamDictionaryZh).values
          : new Map<string, string>(),
        readDictionary(vueDictionaryZh).values,
      ],
    ] as const;

    const mismatched: string[] = [];
    const compared: Record<string, number> = {};
    for (const [locale, up, mine] of pairs) {
      let n = 0;
      for (const [key, value] of up) {
        const ours = mine.get(key);
        if (ours === undefined) continue;
        n += 1;
        if (ours !== value)
          mismatched.push(`[${locale}] ${key}: 上游="${value}" 本仓="${ours}"`);
      }
      compared[locale] = n;
    }

    /* 形状先断言：抽取器写坏了会让上面的循环一次都不跑，而那样它照样全绿（坑 176）。 */
    expect(compared["en-US"]).toBeGreaterThan(600);
    expect(compared["zh-CN"]).toBeGreaterThan(600);
    expect(
      mismatched,
      "同名词条两边的字不一样——同一个控件在两个应用里念了两句话。" +
        "真要不同就让它不同名（本仓独有的块或 ALIASES 并写明理由），不要在这里开白名单。",
    ).toEqual([]);
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
