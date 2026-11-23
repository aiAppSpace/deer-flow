/*
  【文件职责】     固定双 locale key、代表性产品域与 formatter 动态内容合同。
  【架构位置】     Vue unit test
  【主要导出】     无；Vitest cases
  【依赖关系】     两份 typed dictionaries
  【边界与注意】   动态文件名、用户内容、URL 与参数值必须原样保留。
*/

import { describe, expect, it } from "vitest";

import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("locale contract", () => {
  it("keeps en-US and zh-CN leaf keys exactly identical", () => {
    expect(leafKeys(zhCN).sort()).toEqual(leafKeys(enUS).sort());
  });

  it("covers every representative product domain including a11y and failures", () => {
    const paths = [
      "inputBox.placeholder",
      "agents.creationError",
      "scheduledTasks.errors.trigger",
      "settings.appearance.systemDescription",
      "browser.urlPlaceholder",
      "artifacts.noSelectionDescription",
      "sidecar.placeholder",
      "channels.connectionExpired",
      "chats.deleteFailed",
      "markdown.unsafeLink",
      "login.serviceUnavailableTitle",
    ];
    for (const dictionary of [enUS, zhCN]) {
      for (const path of paths) {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, part) =>
              typeof node === "object" && node !== null
                ? Reflect.get(node, part)
                : undefined,
            dictionary,
          );
        expect(value, path).toBeTypeOf("string");
        expect(String(value), path).not.toBe("");
      }
    }
  });

  it("keeps formatter parameters opaque instead of translating backend/user/file data", () => {
    const filename = "用户-report.ts";
    const url = "https://example.com/路径?q=raw";
    for (const dictionary of [enUS, zhCN]) {
      expect(dictionary.artifacts.actions.removeFile(filename)).toContain(
        filename,
      );
      expect(dictionary.markdown.unsafeLinkTitle(url)).toContain(url);
    }
  });
});
