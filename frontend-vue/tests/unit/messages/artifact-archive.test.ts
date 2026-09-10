/*
  【文件职责】     固定归档下载键挂在哪一组。
  【架构位置】     测试
  【依赖关系】     app/core/messages/artifact-archive.ts
  【边界与注意】   守的是「一次运行只挂一颗，挂在最后一组」。压缩包按 run 打、
                   每次都是全量，每组各挂一颗的话用户会看到几颗内容完全相同的
                   下载键，还以为是几批不同的东西。
*/

import { describe, expect, it } from "vitest";

import { getArtifactArchiveCandidatesByGroupIndex } from "@/core/messages/artifact-archive";
import { getMessageGroups } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";

function presentFiles(id: string, runId: string, filepaths: string[]): Message {
  return {
    id,
    type: "ai",
    content: "",
    run_id: runId,
    tool_calls: [
      { id: `call-${id}`, name: "present_files", args: { filepaths } },
    ],
  } as unknown as Message;
}

describe("归档下载键的落点", () => {
  it("一次运行分几次呈递时，只挂在最后那一组", () => {
    const groups = getMessageGroups([
      presentFiles("first", "run-1", ["/mnt/user-data/outputs/a.txt"]),
      presentFiles("second", "run-1", [
        "/mnt/user-data/outputs/a.txt",
        "/mnt/user-data/outputs/b.txt",
      ]),
    ]);
    expect(getArtifactArchiveCandidatesByGroupIndex(groups)).toEqual([
      undefined,
      { runId: "run-1" },
    ]);
  });

  it("只呈递一次时，那一组就是最后一组", () => {
    const groups = getMessageGroups([
      presentFiles("only", "run-1", ["/mnt/user-data/outputs/a.txt"]),
    ]);
    expect(getArtifactArchiveCandidatesByGroupIndex(groups)).toEqual([
      { runId: "run-1" },
    ]);
  });

  it("不同运行各挂各的，交错出现也不串", () => {
    const groups = getMessageGroups([
      presentFiles("run-1-first", "run-1", ["/mnt/user-data/outputs/a.txt"]),
      presentFiles("run-2", "run-2", [
        "/mnt/user-data/outputs/c.txt",
        "/mnt/user-data/outputs/d.txt",
      ]),
      presentFiles("run-1-last", "run-1", ["/mnt/user-data/outputs/b.txt"]),
    ]);
    expect(getArtifactArchiveCandidatesByGroupIndex(groups)).toEqual([
      undefined,
      { runId: "run-2" },
      { runId: "run-1" },
    ]);
  });

  /*
    别的组也带 run_id（一条普通 AI 回复就有），但只有 present-files 组会渲染
    文件列表——挂到别处那颗键根本画不出来，而这个 run 的键就丢了。
  */
  it.each([
    ["文件在前、说明在后", true],
    ["说明在前、文件在后", false],
  ])("只有 present-files 组挂键（%s）", (_label, filesFirst) => {
    const plainText = (id: string) =>
      ({
        id,
        type: "ai",
        content: "Here you go.",
        run_id: "run-1",
      }) as unknown as Message;
    const files = presentFiles("files", "run-1", [
      "/mnt/user-data/outputs/a.txt",
    ]);
    const groups = getMessageGroups(
      filesFirst ? [files, plainText("after")] : [plainText("before"), files],
    );
    const expectedTypes = filesFirst
      ? ["assistant:present-files", "assistant"]
      : ["assistant", "assistant:present-files"];
    expect(groups.map((group) => group.type)).toEqual(expectedTypes);
    // 键永远落在 present-files 那一组上，不管普通回复排在它前面还是后面。
    const filesIndex = expectedTypes.indexOf("assistant:present-files");
    const expected = [undefined, undefined];
    expected[filesIndex] = { runId: "run-1" };
    expect(getArtifactArchiveCandidatesByGroupIndex(groups)).toEqual(expected);
  });

  it("没有 run_id 的呈递不挂键：压缩包地址里就没有 run 可填", () => {
    const noRun = {
      id: "no-run",
      type: "ai",
      content: "",
      tool_calls: [
        {
          id: "call-no-run",
          name: "present_files",
          args: { filepaths: ["/mnt/user-data/outputs/a.txt"] },
        },
      ],
    } as unknown as Message;
    expect(
      getArtifactArchiveCandidatesByGroupIndex(getMessageGroups([noRun])),
    ).toEqual([undefined]);
  });
});
