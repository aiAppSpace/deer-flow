/*
  【文件职责】     有 e2e 正在跑时，挡住会重写 `.output/` 的构建。
  【架构位置】     构建脚本（不进产物）
  【主要导出】     无；CLI（退出码 2 表示被挡住）
  【依赖关系】     ./keep-e2e-failure-artifacts.mjs（复用同一把锁）
  【边界与注意】   **e2e 的 preview server 就是从 `.output/` 取文件的。**
                   2026-09-10 实测：一轮 `make e2e-parity` 跑到一半时跑了
                   `make verify`，它的 `build` 把 chunk 换了一批，于是那一轮的
                   preview 当场开始报——

                     H3Error: ENOENT: … .output/public/_nuxt/vendor-vue-DLJVsuSe.js.br
                     statusCode: 500

                   ——13 分钟的一轮就这么废了。这与「两轮 e2e 互删产物」是同一类事故，
                   只是跨了一层：独占锁挡的是 e2e 对 e2e，挡不住 build 对 e2e。

                   **不会自锁**：e2e 的 webServer 直接调 `./node_modules/.bin/nuxt build`
                   （见 tests/support/playwright-factory.ts），不走 `make build`，
                   所以这道闸门只拦人手敲的构建。

                   逃生口与那把锁一致：`E2E_ALLOW_CONCURRENT=1`。
*/

import { readFileSync } from "node:fs";

import {
  RUN_LOCK_PATH,
  processIsAlive,
} from "./keep-e2e-failure-artifacts.mjs";

function holder() {
  try {
    const parsed = JSON.parse(readFileSync(RUN_LOCK_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // 没有锁文件、或者半截写坏的锁：没有持有者可言。
    return null;
  }
}

if (process.env.E2E_ALLOW_CONCURRENT !== "1") {
  const current = holder();
  if (current && processIsAlive(current.pid)) {
    process.stderr.write(
      `\n有一轮 e2e 正在跑，这次构建不能开始。\n\n` +
        `  持有者 PID ${current.pid}，从 ${current.startedAt} 开始\n` +
        (current.command ? `  跑的是 ${current.command}\n` : "") +
        `\n构建会重写 .output/，而那一轮的 preview server 正从那里取文件——\n` +
        `换掉一批 chunk 之后它会开始报 500 ENOENT，整轮作废。\n\n` +
        `等它跑完；那个进程其实已经没了的话，删掉 ${RUN_LOCK_PATH} 即可。\n` +
        `真要并发：E2E_ALLOW_CONCURRENT=1 make <target>\n`,
    );
    process.exit(2);
  }
}
