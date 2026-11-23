import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import vm from "node:vm";

import {
  defineConfig,
  devices,
  request,
  type APIRequestContext,
  type Page,
  type PlaywrightTestConfig,
} from "@playwright/test";
import { afterEach, describe, expect, test } from "@rstest/core";
import ts from "typescript";

type Driver = (context: {
  context: { request: Pick<APIRequestContext, "post"> };
  page: Pick<Page, "addInitScript" | "goto">;
}) => Promise<void>;
const actual = { defineConfig, devices, request };
function loadSource<T>(
  relative: string,
  env: Record<string, string | undefined>,
  register?: (name: string, driver: Driver) => void,
): T {
  const filename = resolve(__dirname, "../../..", relative);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const loadedModule = { exports: {} };
  const require = createRequire(filename);
  vm.runInNewContext(
    code,
    {
      module: loadedModule,
      exports: loadedModule.exports,
      URL,
      console,
      setTimeout,
      process: { env, platform: process.platform },
      require: (name: string) =>
        name === "@playwright/test"
          ? {
              ...actual,
              ...(register
                ? {
                    test: Object.assign(register, {
                      describe: { configure: () => undefined },
                    }),
                    expect,
                  }
                : {}),
            }
          : require(name),
    },
    { filename },
  );
  return loadedModule.exports as T;
}
type Config = { default: PlaywrightTestConfig };
const directories: string[] = [];
afterEach(() => {
  directories
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true }));
});

describe("record frontend origin", () => {
  test.each([undefined, "3299"])(
    "shares config baseURL, readiness and PORT with override %s",
    async (override) => {
      const { default: config } = loadSource<Config>(
        "playwright.record.config.ts",
        { E2E_RECORD_FRONTEND_PORT: override, PORT: "3000" },
      );
      const expectedPort = override ?? "3212";
      expect(config.use!.baseURL).toBe(`http://localhost:${expectedPort}`);
      const servers = Array.isArray(config.webServer)
        ? config.webServer
        : [config.webServer];
      const frontend = servers.at(-1)!;
      expect(frontend.url).toBe(config.use!.baseURL);
      expect(frontend.env!.PORT).toBe(expectedPort);
    },
  );

  test("the actual driver registers against its context origin before navigation", async () => {
    const seen: string[] = [];
    const listener = http.createServer((request, response) => {
      seen.push(request.url!);
      request.resume();
      response.writeHead(201, { "content-type": "application/json" });
      response.end("{}");
    });
    await new Promise<void>((accept, reject) => {
      listener.once("error", reject);
      listener.listen(0, "localhost", accept);
    });
    let api: APIRequestContext | undefined;
    try {
      const address = listener.address();
      if (!address || typeof address === "string")
        throw new Error("Missing owned listener port");
      const directory = mkdtempSync(join(tmpdir(), "deerflow-record-origin-"));
      directories.push(directory);
      const env = {
        E2E_RECORD_FRONTEND_PORT: String(address.port),
        PORT: "3000",
        DEERFLOW_RECORD_OUT: join(directory, "capture.jsonl"),
      };
      const { default: config } = loadSource<Config>(
        "playwright.record.config.ts",
        env,
      );
      let driver: Driver | undefined;
      loadSource(
        "tests/e2e-record/record-write-read-file.spec.ts",
        env,
        (_name, run) => {
          driver = run;
        },
      );
      expect(driver).toBeTypeOf("function");
      api = await actual.request.newContext({ baseURL: config.use!.baseURL });
      const stopBeforeModel = new Error("Stop before any UI or model action");
      const navigation: string[] = [];
      const post: APIRequestContext["post"] = async (url, options) => {
        // Reject the old hardcoded AiPPT origin before it could perform I/O.
        expect(new URL(url, config.use!.baseURL).origin).toBe(
          new URL(config.use!.baseURL!).origin,
        );
        expect(url).toBe("/api/v1/auth/register");
        return api!.post(url, options);
      };
      await expect(
        driver!({
          context: { request: { post } },
          page: {
            addInitScript: async () => ({
              dispose: async () => undefined,
              [Symbol.asyncDispose]: async () => undefined,
            }),
            goto: async (url) => {
              navigation.push(new URL(url, config.use!.baseURL).href);
              throw stopBeforeModel;
            },
          },
        }),
      ).rejects.toBe(stopBeforeModel);
      expect(seen).toEqual(["/api/v1/auth/register"]);
      expect(navigation).toEqual([
        new URL("/workspace/chats/new", config.use!.baseURL).href,
      ]);
    } finally {
      await api?.dispose();
      await new Promise<void>((accept, reject) =>
        listener.close((error) => (error ? reject(error) : accept())),
      );
    }
  }, 15_000);
});
