#!/usr/bin/env node
/*
  【文件职责】     从 <repo>/examples 下每个扩展包的 deerflow-extension.json 生成
                   app/core/extensions/bundled-documentation.json，作为扩展目录的
                   中英文说明来源（与 React 的 bundled-documentation.json 同源同形）。
  【架构位置】     构建脚本
  【主要导出】     CLI：默认写文件；--check 校验签入产物与扩展包说明一致
  【依赖关系】     ../examples（扩展包自带的公开说明，随上游同步）
  【边界与注意】   校验与投影逐条对齐后端
                   `deerflow/extensions/documentation.py` 的 `validate_documentation`，
                   另加上游 `scripts/sync_extension_documentation.py` 的两条打包要求：
                   必须同时有中英文、id 不许重复。只投影公开字段，包里的其他字段
                   不进产物。产物签入，所以窄 context 的构建不需要 examples/。
*/

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXAMPLES = fileURLToPath(new URL("../../examples/", import.meta.url));
const OUT = fileURLToPath(
  new URL("../app/core/extensions/bundled-documentation.json", import.meta.url),
);
const FILENAME = "deerflow-extension.json";
const MAX_BYTES = 65536;

function fail(path, reason) {
  console.error(`扩展说明无效：${path}：${reason}`);
  process.exit(1);
}

const text = (value) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 4000;
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validate(value, path) {
  if (!record(value) || value.schema_version !== 1)
    fail(path, "documentation requires schema_version 1");
  if (
    typeof value.id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(value.id)
  )
    fail(path, "documentation requires a stable id");
  const locales = value.locales;
  if (
    !record(locales) ||
    Object.keys(locales).length === 0 ||
    Object.keys(locales).length > 20
  )
    fail(path, "documentation requires at least one locale");
  const result = { schema_version: 1, id: value.id, locales: {} };
  for (const [locale, copy] of Object.entries(locales)) {
    if (!/^[a-z]{2}(?:-[A-Za-z]{2,8})?$/.test(locale) || !record(copy))
      fail(path, "invalid documentation locale");
    if (!text(copy.title) || !text(copy.description))
      fail(path, "documentation title and description are required");
    const steps = copy.usage;
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > 12)
      fail(path, "documentation requires usage steps");
    if (
      steps.some(
        (step) => !record(step) || !text(step.title) || !text(step.description),
      )
    )
      fail(path, "usage steps require a title and description");
    const projected = {
      title: copy.title,
      description: copy.description,
      usage: steps.map((step) => ({
        title: step.title,
        description: step.description,
      })),
    };
    const requirements = copy.requirements;
    if (requirements !== undefined && requirements !== null) {
      if (
        !Array.isArray(requirements) ||
        requirements.length > 12 ||
        requirements.some((item) => !text(item))
      )
        fail(path, "requirements must be a list of nonempty descriptions");
      if (requirements.length) projected.requirements = requirements;
    }
    result.locales[locale] = projected;
  }
  if ("docs_url" in value) {
    let url;
    try {
      url = new URL(value.docs_url);
    } catch {
      fail(path, "docs_url must be a public HTTPS URL");
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    )
      fail(path, "docs_url must be a public HTTPS URL");
    result.docs_url = value.docs_url;
  }
  return result;
}

function render() {
  if (!existsSync(EXAMPLES)) {
    console.error(`缺少扩展包目录：${EXAMPLES}`);
    process.exit(1);
  }
  const manifests = readdirSync(EXAMPLES, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith("deerflow-extension-"),
    )
    .flatMap((pkg) =>
      readdirSync(`${EXAMPLES}${pkg.name}`, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          pkg: pkg.name,
          path: `${EXAMPLES}${pkg.name}/${entry.name}/${FILENAME}`,
        }))
        .filter((entry) => existsSync(entry.path)),
    )
    // Same order as Python's sorted(Path): compare segment by segment, so
    // `knowledge/` precedes `knowledge-center/`.
    .sort((a, b) => {
      const left = a.path.split("/");
      const right = b.path.split("/");
      for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
        if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
      }
      return left.length - right.length;
    });

  const pages = {};
  for (const { pkg, path } of manifests) {
    const raw = readFileSync(path);
    if (raw.length > MAX_BYTES) fail(path, "documentation is too large");
    const page = validate(JSON.parse(raw.toString("utf8")), path);
    const languages = new Set(
      Object.keys(page.locales).map((tag) => tag.toLowerCase().split("-")[0]),
    );
    if (!languages.has("en") || !languages.has("zh"))
      fail(path, "bundled documentation requires English and Chinese");
    if (Object.values(pages).some((existing) => existing.id === page.id))
      fail(path, `duplicate extension documentation id: ${page.id}`);
    pages[pkg] = page;
  }
  return `${JSON.stringify(pages, null, 2)}\n`;
}

const body = render();
if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current === body) {
    console.log("扩展目录说明与 examples/*/deerflow-extension.json 一致。");
    process.exit(0);
  }
  console.error(
    "扩展目录说明已过期：examples/ 下的扩展说明变了但 app/core/extensions/bundled-documentation.json 没重新生成。\n" +
      "运行 `make gen-extension-documentation`。",
  );
  process.exit(1);
}
writeFileSync(OUT, body, "utf8");
console.log(`已生成 ${OUT.split("frontend-vue/")[1]}`);
