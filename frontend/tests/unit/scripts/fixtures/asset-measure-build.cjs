const { appendFileSync, renameSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

if (process.argv.slice(2, 5).join(" ") === "exec next start") {
  // Model the old package-manager wrapper with an actual child listener so
  // its cleanup cannot pass merely because the fixture omitted the child.
  const child = spawnSync(
    process.execPath,
    [resolve("node_modules/next/dist/bin/next"), ...process.argv.slice(4)],
    { stdio: "inherit", env: process.env },
  );
  process.exit(child.status ?? 1);
}

appendFileSync(
  process.env.ASSET_FIXTURE_LOG,
  JSON.stringify({
    kind: "build",
    args: process.argv.slice(2),
    cwd: process.cwd(),
    staticMode: process.env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY ?? null,
  }) + "\n",
);
if (process.env.ASSET_FIXTURE_MODE === "spawn-error") {
  // The script's next spawn now receives a genuinely missing cwd.
  renameSync(process.cwd(), `${process.cwd()}-moved`);
}
