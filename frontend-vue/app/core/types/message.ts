/*
  【文件职责】     替代 `@langchain/langgraph-sdk` 的消息/线程 wire 类型，供产品消息、会话和工具模块引用。
                   （Message / AIMessage / Thread / ThreadsClient / BaseStream / ToolCall …）
  【架构位置】     L3 类型（DeerFlow 协议形状）；独立会话协议位于 packages/agent-core/src/session/protocol.ts
  【主要导出】     AgentMessageContent / AgentContentPart / Message / AIMessage / Thread / ToolCall
  【依赖关系】     零运行时依赖，纯 type-only；被 core/messages、core/threads、core/tasks、
                   core/tools、core/sidecar、core/artifacts 引用
  【边界与注意】   **富内容必须无损。** 06 §M1 1b 与 08「消息契约」都点名同一个失效方式：
                   把 `content` 塌成 `string`。塌了之后代码照样编得过、单测也可能全绿，
                   但 B1（带 tool_calls 的可见文本）与 B11（citation 从完整 children 树推导）
                   会静默走形。所以 `AgentMessageContent` 是联合类型，且
                   tests/guards/message-content-contract.test.ts 用真实 thread fixture
                   两个方向都往返一遍——不是只断言「能编译」。

                   与 SDK 的一处**有意不同**：SDK 的 `MessageContentComplex` 是
                   `text | image_url` 的闭合联合，而线上数据不止这两种。
                   上游 `messages/utils.ts` 自己就在防御这一点——它对数组元素写了
                   `typeof content === "string"` 分支，又用 `"thinking" in part` 取
                   reasoning，两者都不在 SDK 的闭合联合里。照抄闭合联合等于把线上
                   真实存在的 part 类型判成不可能，取 reasoning 时只能靠 as 强转。
                   因此这里按 08 采用开放形状（`type: string` + index signature）。
                   代价是窄化变弱：`part.text` 是 `string | undefined`，
                   落地时有一处（`extractURLFromImageURLContent` 的入参）要显式收敛，
                   见 `messages/utils.ts` 的文件头。
*/

// ---------------------------------------------------------------------------
// 消息内容（08 §消息契约）
// ---------------------------------------------------------------------------

export interface AgentImageUrl {
  url: string;
  detail?: string;
}

/**
 * 一段富内容。`type` 是开放的字符串而不是闭合联合，index signature 保证
 * 协议新增字段原样留在对象里而不是在类型层面被丢掉。
 */
export interface AgentContentPart {
  type: string;
  text?: string;
  image_url?: string | AgentImageUrl;
  [key: string]: unknown;
}

/** 联合类型本身就是护栏：任何一侧被去掉，消费方都会立刻编不过。 */
export type AgentMessageContent = string | AgentContentPart[];

/** SDK 兼容别名。上游按这个名字理解 `BaseMessage["content"]`。 */
export type MessageContent = AgentMessageContent;
export type MessageContentComplex = AgentContentPart;

// ---------------------------------------------------------------------------
// 工具调用
// ---------------------------------------------------------------------------

/**
 * 与 `@langchain/core/messages` 的 `ToolCall` 结构等价。
 * `args` 必须是 `Record<string, any>`：上游 `tools/utils.ts` 直接读
 * `toolCall.args.query` / `toolCall.args.description`，`unknown` 会让它编不过。
 * 08 的 `AgentToolCall.args?: unknown` 是 L1 的更严口径，两者不是同一个东西——
 * 这里描述的是 wire 形状，不是 L1 归约后的形状。
 */
export interface ToolCall {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wire 形状：args 由工具 schema 决定，此处无法收窄
  args: Record<string, any>;
  id?: string;
  type?: "tool_call";
}

export interface InvalidToolCall {
  name?: string;
  args?: string;
  id?: string;
  error?: string;
  type?: "invalid_tool_call";
}

export interface UsageMetadata {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_token_details?: {
    audio?: number;
    cache_read?: number;
    cache_creation?: number;
  };
  output_token_details?: {
    audio?: number;
    reasoning?: number;
  };
}

// ---------------------------------------------------------------------------
// 消息
// ---------------------------------------------------------------------------

export type MessageAdditionalKwargs = Record<string, unknown>;

/**
 * 这一族**必须写成 `type` 交叉而不是 `interface` 继承**，SDK 那边也是这么写的。
 * 不是风格问题：TS 只给类型别名隐式 index signature，不给 interface。
 * 上游 `messages/usage.ts` 有一句 `message as Record<string, unknown>`
 * （读 SDK 没有声明的 `usage_metadata`），interface 版本会直接报 TS2352
 * 「两个类型没有足够重叠」。第一版写成 interface，就是被这一句抓出来的。
 */
export type BaseMessage = {
  id?: string;
  name?: string;
  content: AgentMessageContent;
  additional_kwargs?: MessageAdditionalKwargs;
  response_metadata?: Record<string, unknown>;
};

export type HumanMessage = BaseMessage & {
  type: "human";
  example?: boolean;
};

export type AIMessage = BaseMessage & {
  type: "ai";
  example?: boolean;
  tool_calls?: ToolCall[];
  invalid_tool_calls?: InvalidToolCall[];
  usage_metadata?: UsageMetadata;
};

export type ToolMessage = BaseMessage & {
  type: "tool";
  status?: "error" | "success";
  tool_call_id: string;
  /** 工具产物，可能与 content 不同；L1 不解释。 */
  artifact?: unknown;
};

export type SystemMessage = BaseMessage & {
  type: "system";
};

export type FunctionMessage = BaseMessage & {
  type: "function";
};

export type RemoveMessage = BaseMessage & {
  type: "remove";
};

export type Message =
  | HumanMessage
  | AIMessage
  | ToolMessage
  | SystemMessage
  | FunctionMessage
  | RemoveMessage;

export type MessageType = Message["type"];

// ---------------------------------------------------------------------------
// 线程
// ---------------------------------------------------------------------------

export type ThreadStatus = "idle" | "busy" | "interrupted" | "error";

export type ThreadSortBy = "thread_id" | "status" | "created_at" | "updated_at";

export type SortOrder = "asc" | "desc";

export type ThreadSelectField =
  | "thread_id"
  | "created_at"
  | "updated_at"
  | "metadata"
  | "config"
  | "context"
  | "status"
  | "values"
  | "interrupts";

export interface Interrupt<TValue = unknown> {
  id?: string;
  value?: TValue;
  when?: string;
  resumable?: boolean;
  ns?: string[];
}

export interface Thread<TValues = Record<string, unknown>> {
  thread_id: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  status: ThreadStatus;
  values: TValues;
  interrupts: Record<string, Interrupt[]>;
  config?: Record<string, unknown>;
  error?: string | Record<string, unknown> | null;
}

export interface ThreadSearchQuery<TValues = Record<string, unknown>> {
  metadata?: Record<string, unknown>;
  ids?: string[];
  limit?: number;
  offset?: number;
  status?: ThreadStatus;
  sortBy?: ThreadSortBy;
  sortOrder?: SortOrder;
  select?: ThreadSelectField[];
  values?: Partial<TValues>;
  signal?: AbortSignal;
}

/**
 * 只描述 core 实际用到的那一个方法。上游 `thread-search-query.ts` 通过
 * `ThreadsClient["search"]` 和 `Parameters<…>[0]` 反推参数类型，所以签名形状
 * 必须保住，方法数量不必。
 */
export interface ThreadsClient<TStateType = Record<string, unknown>> {
  search<TValues = TStateType>(
    query?: ThreadSearchQuery<TValues>,
  ): Promise<Thread<TValues>[]>;
}

/**
 * SDK `useStream` 返回值里 core 唯一读到的字段（`artifacts/loader.ts` 读 `.messages`）。
 * 整个 stream handle 属于 M2 `packages/agent-core` 的范围，这里只留结构最小面。
 */
export interface BaseStream<TState = Record<string, unknown>> {
  messages: Message[];
  values?: TState;
}
