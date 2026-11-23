/*
  【文件职责】     在类型层钉住 message.ts 的联合语义，塌陷时让 `make typecheck` 直接红。
  【架构位置】     L3 类型断言（纯 type-only，编译后不产出任何运行时代码）
  【主要导出】     只有类型别名，运行时为空模块
  【依赖关系】     app/core/types/message.ts
  【边界与注意】   类型断言放在 app 类型检查链中；tests 也由 typecheck-tests 独立检查。
                   两条命令都接入 verify，不能把测试目录描述为不参与类型检查。
*/

import type { AgentContentPart, AgentMessageContent, Message } from "./message";

/** `T` 不为 `true` 时报 TS2344，错误直接指到下面某一行。 */
type Assert<T extends true> = T;

type Extends<A, B> = [A] extends [B] ? true : false;

// --- 联合必须有两侧 --------------------------------------------------------

/** 塌成 `string` 时为 false → 报错。这是 06 §M1 1b 点名的那个失效方式。 */
export type _ContentIsNotOnlyString = Assert<
  Extends<AgentMessageContent, string> extends true ? false : true
>;

/** 反向：塌成 `AgentContentPart[]`（把字符串内容包成单元素数组）同样报错。 */
export type _ContentIsNotOnlyParts = Assert<
  Extends<AgentMessageContent, AgentContentPart[]> extends true ? false : true
>;

/** 两侧都必须真的在联合里，不能只是 `unknown` 蒙混过关。 */
export type _StringSideAccepted = Assert<Extends<string, AgentMessageContent>>;
export type _PartsSideAccepted = Assert<
  Extends<AgentContentPart[], AgentMessageContent>
>;

// --- part 的开放性 ---------------------------------------------------------

/** 未知 part 类型必须可表达（线上有 `thinking`，SDK 的闭合联合表达不了）。 */
export type _UnknownPartTypeAccepted = Assert<
  Extends<{ type: "thinking"; thinking: string }, AgentContentPart>
>;

/** `image_url` 的两种形状都要在类型内，否则消费方只能强转。 */
export type _ImageUrlStringAccepted = Assert<
  Extends<{ type: "image_url"; image_url: string }, AgentContentPart>
>;
export type _ImageUrlObjectAccepted = Assert<
  Extends<
    { type: "image_url"; image_url: { url: string; detail?: string } },
    AgentContentPart
  >
>;

// --- 消息本体 --------------------------------------------------------------

/** `Message["content"]` 必须就是这个联合本身，不能在消息层被收窄。 */
export type _MessageCarriesTheUnion = Assert<
  Extends<Message["content"], AgentMessageContent> extends true
    ? Extends<AgentMessageContent, Message["content"]>
    : false
>;
