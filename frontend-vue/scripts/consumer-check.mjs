/*
  【文件职责】     验证 agent-core tarball 的独立安装、类型检查与实际最小会话。
  【架构位置】     构建脚本
  【主要导出】     无（CLI）
  【依赖关系】     scripts/pnpm.py · packages/agent-core
  【边界与注意】   用真实 tarball 在 workspace 外 clean install，从 bare specifier 消费 package exports。
                   独立类型检查后，由 esbuild 打包并实际执行最小 session，验证导出与依赖完整性。
                   pnpm 均经 scripts/pnpm.py；临时目录由转发的 pnpm --dir 指定。
*/

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const packageDir = join(root, "packages/agent-core");
const exampleDir = join(root, "examples/agent-core-consumer");

/**
 * consumer 自己的工具链。
 *
 * `typescript` 跟着本仓库走——用另一个版本 typecheck，验的就不是我们这份合同了。
 * `esbuild` 只是"一个打包器"，本仓库没有直接依赖它（pnpm 严格模式下也读不到它的
 * package.json），所以这里写死一个版本；它换了不影响结论。
 */
const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const typescriptVersion = rootPkg.devDependencies.typescript;

function pnpm(args, { cwd } = {}) {
  execFileSync(
    "python3",
    [
      join(repoRoot, "scripts/pnpm.py"),
      "--dir",
      "frontend-vue",
      ...(cwd ? ["--dir", cwd] : []),
      ...args,
    ],
    { cwd: root, stdio: ["ignore", "inherit", "inherit"] },
  );
}

let tarballDir;
let consumer;
try {
  tarballDir = mkdtempSync(join(tmpdir(), "deerflow-agent-core-pack-"));
  console.log("· pnpm pack");
  pnpm(["pack", "--pack-destination", tarballDir], { cwd: packageDir });
  const tarball = join(
    tarballDir,
    readdirSync(tarballDir).find((name) => name.endsWith(".tgz")),
  );

  consumer = mkdtempSync(join(tmpdir(), "deerflow-agent-core-consumer-"));
  cpSync(join(exampleDir, "src"), join(consumer, "src"), { recursive: true });
  copyFileSync(
    join(exampleDir, "tsconfig.json"),
    join(consumer, "tsconfig.json"),
  );
  copyFileSync(tarball, join(consumer, "deerflow-agent-core.tgz"));
  const examplePackage = JSON.parse(
    readFileSync(join(exampleDir, "package.json"), "utf8"),
  );
  examplePackage.devDependencies.typescript = typescriptVersion;
  writeFileSync(
    join(consumer, "package.json"),
    `${JSON.stringify(examplePackage, null, 2)}\n`,
  );
  // 这个临时目录不在任何 workspace 里，也不该被本仓库的设置影响。
  writeFileSync(join(consumer, ".npmrc"), "ignore-workspace-root-check=true\n");

  console.log("· clean install");
  pnpm(["install", "--no-frozen-lockfile"], { cwd: consumer });

  console.log("· typecheck from the consumer's own tsconfig");
  pnpm(["exec", "tsc", "--noEmit"], { cwd: consumer });

  console.log("· minimal session run");
  pnpm(
    [
      "exec",
      "esbuild",
      "src/main.ts",
      "--bundle",
      "--platform=node",
      "--format=esm",
      "--log-level=warning",
      "--outfile=consumer.mjs",
    ],
    { cwd: consumer },
  );
  const output = execFileSync(
    process.execPath,
    [join(consumer, "consumer.mjs")],
    {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  process.stdout.write(output);
  if (!output.includes("consumer session OK")) {
    throw new Error("the consumer session did not report success");
  }
  console.log(
    "\n@deerflow/agent-core installs, typechecks and runs from a clean consumer.",
  );
} finally {
  for (const dir of [tarballDir, consumer]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}
