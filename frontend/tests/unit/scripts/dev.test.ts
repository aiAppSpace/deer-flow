import { describe, expect, test } from "@rstest/core";

import { getDevBundler, getNextDevArgs } from "../../../scripts/dev.mjs";
import { getNextStartArgs } from "../../../scripts/start.mjs";

describe("frontend dev launcher", () => {
  test("production start uses the same local port and preserves explicit overrides", () => {
    expect(getNextStartArgs([], {})).toEqual(["start", "--port", "3200"]);
    expect(getNextStartArgs([], { PORT: "3000" })).toEqual(["start"]);
    expect(getNextStartArgs(["--", "--port", "3370"], {})).toEqual([
      "start",
      "--port",
      "3370",
    ]);
    expect(getNextStartArgs(["--hostname", "127.0.0.1"], {})).toEqual([
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3200",
    ]);
  });
  test("allows an explicit bundler override on every platform", () => {
    expect(getDevBundler("win32", { DEER_FLOW_DEV_BUNDLER: "turbo" })).toBe(
      "turbo",
    );
    expect(
      getNextDevArgs("linux", [], { DEER_FLOW_DEV_BUNDLER: "webpack" }),
    ).toEqual(["dev", "--webpack", "--port", "3200"]);
  });

  test("rejects an unsupported bundler override", () => {
    expect(() =>
      getDevBundler("linux", { DEER_FLOW_DEV_BUNDLER: "invalid" }),
    ).toThrow('DEER_FLOW_DEV_BUNDLER must be either "turbo" or "webpack"');
  });

  test("passes through extra Next.js arguments", () => {
    expect(getNextDevArgs("win32", ["--", "--port", "3302"])).toEqual([
      "dev",
      "--webpack",
      "--port",
      "3302",
      "--hostname",
      "127.0.0.1",
    ]);
  });

  test("binds loopback by default on Windows only", () => {
    expect(getNextDevArgs("win32")).toEqual([
      "dev",
      "--webpack",
      "--port",
      "3200",
      "--hostname",
      "127.0.0.1",
    ]);
    expect(getNextDevArgs("linux", [], {})).toEqual([
      "dev",
      "--webpack",
      "--port",
      "3200",
    ]);
    expect(getNextDevArgs("darwin", [], {})).toEqual([
      "dev",
      "--webpack",
      "--port",
      "3200",
    ]);
  });

  test("keeps an explicit Windows hostname passthrough", () => {
    expect(getNextDevArgs("win32", ["--", "--hostname", "0.0.0.0"])).toEqual([
      "dev",
      "--webpack",
      "--hostname",
      "0.0.0.0",
      "--port",
      "3200",
    ]);
    expect(getNextDevArgs("win32", ["--", "--hostname=0.0.0.0"])).toEqual([
      "dev",
      "--webpack",
      "--hostname=0.0.0.0",
      "--port",
      "3200",
    ]);
    expect(getNextDevArgs("win32", ["--", "-H", "0.0.0.0"])).toEqual([
      "dev",
      "--webpack",
      "-H",
      "0.0.0.0",
      "--port",
      "3200",
    ]);
  });

  test("uses webpack by default on every platform", () => {
    expect(getDevBundler("win32")).toBe("webpack");
    expect(getDevBundler("linux")).toBe("webpack");
    expect(getDevBundler("darwin")).toBe("webpack");
    expect(getNextDevArgs("win32")).toEqual([
      "dev",
      "--webpack",
      "--port",
      "3200",
      "--hostname",
      "127.0.0.1",
    ]);
    expect(getNextDevArgs("linux", [], {})).toEqual([
      "dev",
      "--webpack",
      "--port",
      "3200",
    ]);
  });

  test("preserves explicit container and caller ports", () => {
    for (const platform of ["win32", "linux", "darwin"]) {
      const tail = platform === "win32" ? ["--hostname", "127.0.0.1"] : [];
      expect(getNextDevArgs(platform, [], { PORT: "3000" })).toEqual([
        "dev",
        "--webpack",
        ...tail,
      ]);
      for (const args of [
        ["--port", "3370"],
        ["-p", "3370"],
        ["--port=3370"],
        ["-p3370"],
      ]) {
        expect(getNextDevArgs(platform, args, {})).toEqual([
          "dev",
          "--webpack",
          ...args,
          ...tail,
        ]);
      }
    }
  });
});
