/*
  【文件职责】     DeerFlow wire 事件 → 内核归约动作（08 §事件与完整状态归约）。
  【架构位置】     L3
  【主要导出】     DeerFlowThreadState · DEERFLOW_CHANNEL_REDUCERS
                   createDeerFlowEventReducer
  【依赖关系】     @deerflow/agent-core · ./event-map · ./message-adapt · ../threads/types
  【边界与注意】   08 把这一层最容易做错的两条写死了，两条都在下面有对应代码：

                   1. **`values` 是全量 snapshot，归一化后「替换」durable state。**
                      不是 patch。golden trace 里有一个当场证伪浅合并的帧：
                      第 4 个 `values` 里，原来 id 为 `X` 的 human 消息变成了
                      id 为 `X__user` 的 human，而 `X` 被一条 system-reminder
                      **顶替**了。浅合并会让 `X` 那条旧 human 永远留在列表里，
                      用户看到自己发的消息出现两次。

                   2. **`updates` 是 node/channel 增量写，必须调用通道 reducer，
                      不能与 `values` 共用浅 merge。** `messages` 通道的语义是
                      LangGraph 的 `add_messages`（按 id 归并、按 `remove` 删除），
                      不是「用这一批替换整段」。把它当整段替换，任何只写单个通道的
                      节点更新都会把消息列表清空。

                   一次归约返回**多个** action 是 08 的明确要求，不是方便：
                   一帧 `values` 要同时改完整 state、消息集合与顺序，拆成几次
                   dispatch 就会出现「state 换了、消息还是旧的」的中间快照，
                   而组件恰好可能在那一帧渲染。

                   `error` / `end` / `gap` 这三个控制事件的**流走向**由
                   `event-map.ts` 的 `classifyDeerFlowEvent` 判、由 run session
                   落成会话状态；本文件只负责它们对 durable state 的影响——
                   前两者没有，`gap` 的处置在 `gap-recovery.ts`。两处都做等于
                   把同一条协议知识写两遍，早晚对不上。
*/

import type {
  AgentMessage,
  AgentSnapshot,
  EventReducer,
  ReduceAction,
  SseEvent,
} from "@deerflow/agent-core";
import { AgentStreamError } from "@deerflow/agent-core";

import type { Todo } from "../todos/types";
import type { GoalState } from "../threads/types";

import { parseWireEventName } from "./event-map";
import type { WireMessageLike } from "./message-adapt";
import { accumulateStreamedMessage, toAgentMessage } from "./message-adapt";

/**
 * durable thread state **去掉 `messages`**。
 *
 * 消息由快照的 `messages` / `messageIds` 持有（08 §AgentSnapshot）。在 state 里
 * 再存一份会立刻分叉：`updates` 只写 `messages` 通道时两份的更新时机就不同了。
 * 已知通道列在这里只是为了有类型可用，index signature 保证后端新加的通道
 * （`thread_data`、`uploaded_files`、`viewed_images`、`delegations` …）不会被丢掉。
 */
export interface DeerFlowThreadState extends Record<string, unknown> {
  title?: string;
  artifacts?: string[];
  todos?: Todo[];
  goal?: GoalState | null;
}

export const EMPTY_DEERFLOW_THREAD_STATE: DeerFlowThreadState = {};

type Actions = ReduceAction<DeerFlowThreadState>[];

export interface DeerFlowReducerOptions {
  /**
   * 未知事件的去向。08 §352：不能静默当成功。
   *
   * 默认是 no-op 而不是 `console.warn`：L3 不知道自己跑在开发还是生产环境
   * （读 runtime config 是 plugin 的事），在这里判等于把环境知识埋进纯函数。
   * Nuxt plugin 构造 reducer 时注入。
   */
  onUnknownEvent?: (name: string, event: SseEvent) => void;
}

// ---------------------------------------------------------------------------
// 通道 reducer
// ---------------------------------------------------------------------------

/**
 * 非 `messages` 通道一律「最后写入者胜」——LangGraph 里这些是 `LastValue` 通道。
 * `messages` 走 `add_messages`，它不在这张表里，因为它的产物是消息动作
 * 而不是 state 补丁。
 */
export const DEERFLOW_CHANNEL_REDUCERS = {
  lastValue: <T>(_previous: T | undefined, next: T): T => next,
} as const;

const MESSAGES_CHANNEL = "messages";

/**
 * `values` 快照里**没有 id** 的消息在存储里的位置键前缀。
 *
 * 存储按 id 归并，所以这样的消息必须有一个键，否则它在快照之间无法对齐。
 * 位置键是唯一可用的坐标——但它**只是存储键，不是服务端 id**，
 * 而这条区别在下游看不出来：`AgentMessage.id` 上放的就是它。
 *
 * 2026-09-12 量到的后果：`chat-thread-init-ordering` 那一屏上，用户刚发出的
 * 那条 human 消息在 `values` 里回来时没有 id（mock 原样回显 POST 体，
 * 而两个应用发出去的消息本来就不带 id——实测两边的 POST 逐字相同），
 * 于是本仓给它编了 `values-0`，`getLatestEditableTurn` 因此认为这一轮可编辑、
 * 画出了「编辑并重新运行」。**那颗键点下去会把 `values-0` 交给
 * `POST /runs/edit-regenerate/prepare`，服务端解析不了。**
 * 上游没有这个分支，因为它的 `stream_mode` 里根本没有 `values`
 * （实测：上游 `["messages-tuple","updates","custom"]`）。
 *
 * **wave 216 起本仓的生产路径也不再订 `values`**，根因跟着拔掉了：
 * `THREAD_STREAM_MODES` 只剩那三个，状态由 `updates` 累积
 * （`reduceUpdates` 的 `patch-state` 本来就在做这件事），
 * 所以真后端不会再发 `values` 事件，也就不会再有位置键进到 `AgentMessage.id` 上。
 *
 * **下面这一套仍然留着，它不再是补丁而是协议实现的完整性**：
 * `stream_mode` 整个字段缺失时 Gateway 会退回 `values`-only，
 * 而 e2e 夹具里也直接回放 `event: values`（见 `chat-dataflow.spec.ts`）。
 * 收到 `values` 就得正确处理，处理就必须给无 id 的消息一个存储键。
 * 导出前缀与判据，是为了让「编了一个假 id」这件事**在一处定义、在别处认得出来**
 * ——调用点用 `isSyntheticValuesMessageId` 把这类 id 挡在需要真 id 的动作之外。
 */
export const SYNTHETIC_VALUES_ID_PREFIX = "values-";

/**
 * 这个 id 是不是上面那种位置键。
 *
 * **判据故意收紧到「前缀 + 纯数字」**：真服务端 id 里出现 `values-` 开头并非不可能，
 * 但再跟一串纯数字到结尾就不是了。松一格（只判前缀）会把真消息误挡成不可编辑，
 * 而那是一个静默的功能缺失。
 */
export function isSyntheticValuesMessageId(id: string | undefined): boolean {
  if (!id?.startsWith(SYNTHETIC_VALUES_ID_PREFIX)) return false;
  return /^\d+$/.test(id.slice(SYNTHETIC_VALUES_ID_PREFIX.length));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wireMessagesOf(value: unknown): WireMessageLike[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord) as unknown as WireMessageLike[];
}

// ---------------------------------------------------------------------------
// values：全量替换
// ---------------------------------------------------------------------------

function reduceValues(
  payload: Record<string, unknown>,
  snapshot: Readonly<AgentSnapshot<DeerFlowThreadState>>,
): Actions {
  const nextState: DeerFlowThreadState = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key !== MESSAGES_CHANNEL) nextState[key] = value;
  }

  const actions: Actions = [{ type: "replace-state", state: nextState }];

  const incoming = wireMessagesOf(payload[MESSAGES_CHANNEL]);
  if (incoming === undefined) return actions;

  const nextIds = incoming.map(
    (message, index) =>
      (typeof message.id === "string" && message.id) ||
      `${SYNTHETIC_VALUES_ID_PREFIX}${index}`,
  );
  const nextIdSet = new Set(nextIds);

  // 不在新快照里的消息**必须删掉**。`values` 是全量的，留着它们就是
  // 「浅合并」那条错法的另一种形态。
  const dropped = snapshot.messageIds.filter((id) => !nextIdSet.has(id));

  // 已知 id 的相对顺序被改了：`upsert-message` 表达不了重排（它只在
  // 消息不存在时才插入位置）。此时整段重建——代价是丢掉 contentChunks，
  // 但顺序错了比 delta 历史缺一段严重得多。LangGraph 的 messages 通道
  // 是追加式的，实测录制里没触发过这条。
  const kept = snapshot.messageIds.filter((id) => nextIdSet.has(id));
  const keptInNextOrder = nextIds.filter((id) => kept.includes(id));
  /*
    分隔符写成转义 `\0` 而不是字面的 NUL 字节：两者运行时完全一样，
    但字面的那两个字节让 git 把整份文件当成 binary
    （`Bin 12141 -> 14083 bytes`）——**改这份文件看不到任何文本 diff**，
    review 时也没有行级上下文。2026-09-12 改掉。
  */
  const reordered = kept.join("\0") !== keptInNextOrder.join("\0");

  for (const id of reordered ? snapshot.messageIds : dropped) {
    actions.push({ type: "remove-message", messageId: id });
  }

  let afterId: string | undefined;
  for (const [index, message] of incoming.entries()) {
    const id = nextIds[index] as string;
    actions.push({
      type: "upsert-message",
      message: { ...toAgentMessage(message, id), id },
      ...(afterId === undefined ? {} : { afterId }),
    });
    afterId = id;
  }
  return actions;
}

// ---------------------------------------------------------------------------
// updates：按通道增量写
// ---------------------------------------------------------------------------

function reduceUpdates(
  payload: Record<string, unknown>,
  snapshot: Readonly<AgentSnapshot<DeerFlowThreadState>>,
): Actions {
  const actions: Actions = [];

  for (const nodeWrite of Object.values(payload)) {
    if (!isRecord(nodeWrite)) continue;

    const patch: Partial<DeerFlowThreadState> = {};
    let hasPatch = false;

    for (const [channel, value] of Object.entries(nodeWrite)) {
      if (channel !== MESSAGES_CHANNEL) {
        patch[channel] = DEERFLOW_CHANNEL_REDUCERS.lastValue(
          snapshot.state[channel],
          value,
        );
        hasPatch = true;
        continue;
      }
      actions.push(...addMessagesChannel(value, snapshot));
    }

    // patch-state 而不是 replace-state：节点只写了它负责的通道，
    // 其余通道的值必须原样留着。
    if (hasPatch) actions.push({ type: "patch-state", patch });
  }
  return actions;
}

/** LangGraph `add_messages`：按 id 归并、`remove` 类型删除、新 id 追加。 */
function addMessagesChannel(
  value: unknown,
  snapshot: Readonly<AgentSnapshot<DeerFlowThreadState>>,
): Actions {
  const incoming = wireMessagesOf(value);
  if (incoming === undefined) return [];

  const actions: Actions = [];
  for (const [index, message] of incoming.entries()) {
    const id =
      (typeof message.id === "string" && message.id) || `updates-${index}`;
    if (message.type === "remove") {
      actions.push({ type: "remove-message", messageId: id });
      continue;
    }
    const existing = snapshot.messages[id];
    actions.push({
      type: existing ? "merge-message" : "upsert-message",
      ...(existing ? { messageId: id } : {}),
      message: { ...toAgentMessage(message, id), id },
    } as ReduceAction<DeerFlowThreadState>);
  }
  return actions;
}

// ---------------------------------------------------------------------------
// messages（messages-tuple 的线上帧名）：流式分片
// ---------------------------------------------------------------------------

function reduceMessageChunk(
  payload: unknown,
  snapshot: Readonly<AgentSnapshot<DeerFlowThreadState>>,
  createId: () => string,
): Actions {
  // 线上载荷是 `[chunk, metadata]` 二元组。metadata 带 langgraph_node /
  // checkpoint namespace，是**运行现场**而不是消息内容，进 meta 由适配器带走。
  const tuple = Array.isArray(payload) ? payload : [payload];
  const chunk = tuple[0];
  if (!isRecord(chunk)) return [];

  const wire = chunk as unknown as WireMessageLike;
  const id = (typeof wire.id === "string" && wire.id) || createId();
  const previous: AgentMessage | undefined = snapshot.messages[id];
  const message = accumulateStreamedMessage(previous, wire, id);

  return [
    previous
      ? { type: "merge-message", messageId: id, message }
      : { type: "upsert-message", message },
  ];
}

// ---------------------------------------------------------------------------
// reducer
// ---------------------------------------------------------------------------

/** 已知但对 durable state 没有影响的事件。忽略是**明确策略**，不是漏网。 */
const KNOWN_IGNORED = new Set([
  // run/thread id 已经由 Content-Location 给过一次，再存一份只会分叉。
  "metadata",
  // 业务侧事件（artifact / todo / goal 推送）。M4a 接线时才有消费方；
  // 在这之前把它们写进 durable state 等于凭空发明一套 schema。
  "custom",
  "checkpoints",
  "tasks",
  "debug",
  // 控制事件：流走向由 classifyDeerFlowEvent 判，durable state 不受影响。
  "end",
  "gap",
]);

export function createDeerFlowEventReducer(
  options: DeerFlowReducerOptions = {},
): EventReducer<DeerFlowThreadState, SseEvent> {
  const { onUnknownEvent } = options;

  return (event, snapshot, context) => {
    const { mode } = parseWireEventName(event.event);

    if (mode === "error") {
      return [
        {
          type: "error",
          error: new AgentStreamError("backend_error", event.data),
        },
      ];
    }
    if (KNOWN_IGNORED.has(mode)) return [{ type: "ignore" }];

    if (mode !== "values" && mode !== "updates" && mode !== "messages") {
      onUnknownEvent?.(event.event, event);
      return [{ type: "ignore" }];
    }

    let payload: unknown;
    try {
      payload = JSON.parse(event.data);
    } catch (cause) {
      // 解析失败不能当忽略：一帧读不懂说明后端与我们对不上，
      // 静默跳过的表现是「少显示一块内容而没有任何报错」。
      return [
        {
          type: "error",
          error: new AgentStreamError(
            "parse_error",
            `Could not parse the payload of a "${event.event}" event.`,
            { cause },
          ),
        },
      ];
    }

    if (mode === "messages") {
      return reduceMessageChunk(payload, snapshot, context.createId);
    }
    if (!isRecord(payload)) return [{ type: "ignore" }];
    return mode === "values"
      ? reduceValues(payload, snapshot)
      : reduceUpdates(payload, snapshot);
  };
}
