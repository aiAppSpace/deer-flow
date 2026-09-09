/*
  【文件职责】     跑 `pnpm audit`，把它报出来的**包集合**与签入的分诊表逐个对。
  【架构位置】     构建脚本（不进产物）
  【主要导出】     collectAuditedPackages · diffTriage（供守卫单测）
  【依赖关系】     baseline/audit-triage.json · scripts/pnpm.py
  【边界与注意】   **这里取代的是一个「永远红」的门禁。**

                   原来 `make audit` 直接跑 `pnpm audit`，Makefile 注释里写着
                   「当前预期是红的，14 条，逐条分诊见上，免得下一个人再做一遍」。
                   wave 202 实测那段分诊**已经盖不住它了**：实际是 **19 条 / 7 个包**
                   （1 low / 13 moderate / 6 high），而 `svgo` / `vitest` /
                   `@vitest/mocker` **从来没被分诊过**，其中 svgo 是 high。
                   数字和包名都写死在散文里，而 `pnpm audit` 每天都在变，
                   **两边漂了没有任何征兆**。

                   **一个永远红的门禁不产生信息**——人只会学会忽略它，
                   于是新冒出来的东西和老的躺在一起，谁也分不出来。
                   改成棘轮之后判据变成：**每一个被报出来的包都表过态就绿，
                   冒出一个没表过态的就红。**

                   **两个方向都查**：漏登记会红（新漏洞混进来看不见），
                   多登记也会红（过期条目一直躺着，正是那段散文的毛病）。

                   **严重度不进判据**：advisory 的 severity 会被上游改，
                   钉它等于把门禁绑在别人的评级上。这里钉的是「哪些包」，
                   而「这个包要不要紧」由表里的 reachability / decision / why 回答。
                   ——同 `backend-enum-mirror` 那条「只钉成员集合，不钉映射」。

                   **要网络**，所以它是 `make audit` 而不是 `make verify` 的一步；
                   离线时 `pnpm audit` 自己会失败，脚本原样把退出码带出去。
*/

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRIAGE = join(ROOT, "baseline", "audit-triage.json");

/** advisories → 去重后的包名集合。 */
export function collectAuditedPackages(auditJson) {
  const advisories = auditJson?.advisories ?? {};
  return [
    ...new Set(Object.values(advisories).map((a) => a.module_name)),
  ].sort();
}

/** 两个方向的差集。空 + 空 = 通过。 */
export function diffTriage(auditedPackages, triagedPackages) {
  const audited = new Set(auditedPackages);
  const triaged = new Set(triagedPackages);
  return {
    untriaged: [...audited].filter((name) => !triaged.has(name)).sort(),
    stale: [...triaged].filter((name) => !audited.has(name)).sort(),
  };
}

function runAudit() {
  try {
    const stdout = execFileSync(
      "python3",
      [
        "../scripts/pnpm.py",
        "--dir",
        "frontend-vue",
        "audit",
        "--audit-level",
        "moderate",
        "--registry",
        "https://registry.npmjs.org",
        "--json",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        // 有漏洞时底层 `pnpm audit` 退出码非 0，`scripts/pnpm.py` 会往 stderr 打
        // 一行 "Error: pnpm command failed"——那不是这道门禁的结论，
        // 让它出现在一次**绿**的运行里会误导人。判据在下面的差集上。
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return JSON.parse(stdout);
  } catch (error) {
    // 有漏洞时 `pnpm audit` 的退出码非 0，但 stdout 仍然是完整的 JSON。
    const stdout = error?.stdout;
    if (typeof stdout === "string" && stdout.trim().startsWith("{")) {
      return JSON.parse(stdout);
    }
    console.error("pnpm audit 跑不起来（离线？registry 不可达？）：");
    console.error(error?.message ?? error);
    process.exit(2);
  }
}

function main() {
  const triage = JSON.parse(readFileSync(TRIAGE, "utf8"));
  const triaged = triage.packages.map((row) => row.package).sort();
  const audit = runAudit();
  const audited = collectAuditedPackages(audit);
  const counts = audit?.metadata?.vulnerabilities ?? {};

  const { untriaged, stale } = diffTriage(audited, triaged);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  console.log(
    `pnpm audit 报了 ${total} 条，涉及 ${audited.length} 个包：` +
      Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k} ${n}`)
        .join(" / "),
  );
  console.log(
    `分诊表登记了 ${triaged.length} 个包（baseline/audit-triage.json）`,
  );

  if (untriaged.length === 0 && stale.length === 0) {
    console.log("每一个被报出来的包都表过态 ✓");
    return;
  }
  if (untriaged.length > 0) {
    console.error(
      `\n**这些包没有表态**：${untriaged.join(", ")}\n` +
        "  去 baseline/audit-triage.json 加一条，写清 reachability / decision / why / revisit。\n" +
        "  写不出来就说明还没查清楚——那正是这道门禁存在的意义。",
    );
  }
  if (stale.length > 0) {
    console.error(
      `\n**这些登记项已经没有对应的 advisory 了**：${stale.join(", ")}\n` +
        "  删掉它。留着过期条目，这张表就退化成它取代的那段散文。",
    );
  }
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
