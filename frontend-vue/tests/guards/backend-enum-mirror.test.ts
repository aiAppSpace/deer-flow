/*
  【文件职责】     钉住本仓抄下来的**后端枚举**——头里写着「全集」的那几张表，
                   必须与 `../backend` 里的枚举逐个相等。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     scripts/lib/backend-source.mjs · app/core/agent-deerflow/run-protocol.ts
  【边界与注意】   与 `gen-contract-constants` 分工：那边管**签入在 contracts/ 里的
                   契约**（后端明确对外承诺的部分），这边管「后端源码里有、契约里
                   没有、而本仓照抄了一份并声称是全集」的枚举。

                   **为什么值得钉**：`DEERFLOW_DURABLE_STATUS` 的注释写着
                   「Gateway 的 durable run status 全集」。wave 106 实测它与
                   `RunStatus` 六个成员一致——**但没有任何机器在对**，后端加一个
                   状态不会有任何征兆。后果不是崩溃（`inspect` 把不认识的 status
                   当作「还没到终态」），而是**停止操作在那个状态上永远收敛不了**，
                   要靠有界轮询兜底。

                   **只钉成员集合，不钉映射。** status → outcome 是一条冻结决策
                   （08 §258，`pending`/`running` 不是终态所以没有 outcome），
                   后端加一个状态时该映射成什么只有人能决定；机器能替人做的是
                   **让他不能忘**。

                   **`DEERFLOW_WIRE_EVENTS` 现在也钉住了（wave 201）。**
                   wave 107 当时判的是「有意不钉」，理由是后端没有对应枚举、
                   wire 名字散在 `bridge.publish(run_id, <mode>)` 的调用点上、
                   照那个扫会漏。它同时留了**翻案判据**：「后端哪天给 stream mode
                   也定了枚举，这条就可以照着补」。

                   **wave 201 量到判据成立**：
                   `packages/harness/deerflow/runtime/stream_modes.py` 里已经有
                   `type RunStreamMode = Literal[...]` 七个成员。剩下四个不是
                   stream mode，而是各自有出处的字面量——它们**不是「另一半不检查」**，
                   是**换一种方式检查**（逐个断言它出现在点名的那份后端文件里）：

                     metadata → runs/worker.py 的 `bridge.publish(run_id, "metadata", …)`
                     error    → runs/worker.py 的 `bridge.publish(run_id, "error", …)`
                     end/gap  → app/gateway/services.py 的 `format_sse("end"/"gap", …)`

                   还有一处**改名**要钉：公开请求名是 `messages-tuple`，而真正发到
                   线上的事件名是 `messages`（`to_langgraph_stream_modes` 做的转换）。
                   改名本身也断言，否则后端改了转换、这张表却不会响。

                   后端不在 checkout 里时整组跳过；**后端在、而那份文件被挪走了会红**
                   （两件事分开，理由见 scripts/lib/backend-source.mjs 的头）。
*/

import { describe, expect, it } from "vitest";

import { readBackendSource } from "../../scripts/lib/backend-source.mjs";
import { DEERFLOW_WIRE_EVENTS } from "@/core/agent-deerflow/event-map";
import { DEERFLOW_DURABLE_STATUS } from "@/core/agent-deerflow/run-protocol";

const RUN_STATUS_SOURCE = "packages/harness/deerflow/runtime/runs/schemas.py";

const schemas = readBackendSource(RUN_STATUS_SOURCE);

/** `class Foo(StrEnum):` 到下一个顶层声明之间的那一段。 */
function enumBlock(source: string, className: string): string {
  const start = new RegExp(`^class ${className}\\(StrEnum\\):`, "m").exec(
    source,
  );
  if (!start) return "";
  const rest = source.slice(start.index);
  const end = rest.slice(1).search(/^(class|def|@)/m);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

/** StrEnum 成员的字面量取值。 */
function enumValues(source: string, className: string): string[] {
  return [
    ...enumBlock(source, className).matchAll(/^\s{4}\w+\s*=\s*"([a-z_]+)"/gm),
  ].map((match) => match[1] as string);
}

const STREAM_MODES_SOURCE = "packages/harness/deerflow/runtime/stream_modes.py";
const WORKER_SOURCE = "packages/harness/deerflow/runtime/runs/worker.py";
const GATEWAY_SSE_SOURCE = "app/gateway/services.py";

const streamModes = readBackendSource(STREAM_MODES_SOURCE);
const worker = readBackendSource(WORKER_SOURCE);
const gatewaySse = readBackendSource(GATEWAY_SSE_SOURCE);

/** `type RunStreamMode = Literal[...]` 里的字面量。 */
function runStreamModes(source: string): string[] {
  const block = /type RunStreamMode = Literal\[([\s\S]*?)\]/.exec(source);
  if (!block) return [];
  return [...block[1]!.matchAll(/"([a-z-]+)"/g)].map((m) => m[1] as string);
}

/*
  **不是 stream mode 的那四个，逐个钉到它的出处。**

  这一半如果写成「其余的不检查」，这张表就又变成 wave 106 那种「切成两半、
  另一半没人管」的形状（挂账清单里那条判据）。所以这里给每一个都写上
  「谁发的、在哪发的」，并真的去那份文件里找那个字面量。
*/
const NON_STREAM_MODE_EVENTS = [
  { event: "metadata", source: WORKER_SOURCE, literal: '"metadata"' },
  { event: "error", source: WORKER_SOURCE, literal: '"error"' },
  { event: "end", source: GATEWAY_SSE_SOURCE, literal: 'format_sse("end"' },
  { event: "gap", source: GATEWAY_SSE_SOURCE, literal: '"gap"' },
] as const;

const backendSourcesForWire = [streamModes, worker, gatewaySse];

describe.skipIf(backendSourcesForWire.some((source) => source === null))(
  "DEERFLOW_WIRE_EVENTS 的每一个名字都在后端有出处",
  () => {
    const modes = runStreamModes(streamModes as string);

    it("找得到 RunStreamMode，而且不是空的（形状先断言再计算）", () => {
      expect(
        modes.length,
        `${STREAM_MODES_SOURCE} 里没解析出 RunStreamMode 的字面量——写法改了，先修解析`,
      ).toBeGreaterThan(3);
    });

    it("公开请求名 messages-tuple 到线上事件名 messages 的改名还在", () => {
      expect(
        streamModes as string,
        "后端不再把 messages-tuple 改名成 messages 了——下面那条对齐的前提没了",
      ).toContain('"messages" if mode == "messages-tuple" else mode');
    });

    it("业务事件 == 后端 stream mode（messages-tuple 按后端的改名折算）", () => {
      const expected = [
        "metadata",
        ...modes.map((mode) => (mode === "messages-tuple" ? "messages" : mode)),
      ].sort();
      const business = DEERFLOW_WIRE_EVENTS.filter(
        (event) => !NON_STREAM_MODE_EVENTS.some((row) => row.event === event),
      )
        .concat("metadata")
        .filter((event, index, all) => all.indexOf(event) === index)
        .sort();
      expect(
        business,
        "本仓这张表声称是「当前 Gateway 会发出的 wire 事件名全集」，与后端 stream mode 对不上了",
      ).toEqual(expected);
    });

    it.each(NON_STREAM_MODE_EVENTS)(
      "控制/元数据事件 $event 在 $source 里找得到出处",
      ({ event, source, literal }) => {
        expect(
          (DEERFLOW_WIRE_EVENTS as readonly string[]).includes(event),
          `${event} 不在本仓的 wire 事件表里`,
        ).toBe(true);
        const text = source === WORKER_SOURCE ? worker : gatewaySse;
        expect(
          text as string,
          `${source} 里找不到 ${literal}——这个事件名换地方了或者不发了`,
        ).toContain(literal);
      },
    );
  },
);

describe.skipIf(schemas === null)("后端枚举的镜像", () => {
  it("找得到 RunStatus，而且不是空的（形状先断言再计算）", () => {
    const values = enumValues(schemas as string, "RunStatus");
    expect(
      values.length,
      `${RUN_STATUS_SOURCE} 里没解析出 RunStatus 成员——枚举改写法了，先修解析`,
    ).toBeGreaterThan(3);
  });

  it("DEERFLOW_DURABLE_STATUS 的键就是后端 RunStatus 的成员", () => {
    const backend = enumValues(schemas as string, "RunStatus").sort();
    const mirrored = Object.keys(DEERFLOW_DURABLE_STATUS).sort();
    expect(
      mirrored,
      "后端的 run status 变了：往 DEERFLOW_DURABLE_STATUS 里补上它，" +
        "并决定它映射到 completed / cancelled / failed 还是 null（不是终态）",
    ).toEqual(backend);
  });

  it("只有非终态映射成 null，且它们确实是后端的非终态", () => {
    /*
      这一条不从后端算，只钉「本仓这张表内部自洽」：映射成 null 的必须恰好是
      pending / running（08 §258 的冻结决策），其余必须落在内核的三个终态里。
      后端加状态时上一条会先红，人做完决定之后这一条保证他没把 null 用成兜底。
    */
    const nonTerminal = Object.entries(DEERFLOW_DURABLE_STATUS)
      .filter(([, outcome]) => outcome === null)
      .map(([status]) => status)
      .sort();
    expect(nonTerminal).toEqual(["pending", "running"]);

    const outcomes = Object.values(DEERFLOW_DURABLE_STATUS).filter(
      (outcome) => outcome !== null,
    );
    expect(outcomes.length).toBeGreaterThan(2);
    for (const outcome of outcomes) {
      expect(["completed", "cancelled", "failed"]).toContain(outcome);
    }
  });
});
