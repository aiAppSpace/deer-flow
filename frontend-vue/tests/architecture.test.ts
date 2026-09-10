/*
  【文件职责】     守护 agent-core 的 L1 禁入边界（08 §L1 禁入清单的全部 7 条）。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     扫描 packages/agent-core/src
  【边界与注意】   禁止通过改测试放宽 L1 边界。

                   M0 版只查了 import specifier，也就是 7 条里的第 4 条和半条第 7 条。
                   其余 5 条（endpoint、LangGraph 名称、DeerFlow 业务词、cookie/token
                   读取、全局单例）当时没查——`src/` 只有一个 10 行的 stub，查不查都绿。
                   **现在补齐正是因为 M2 马上要往这个目录里写东西**：
                   边界靠的是「越界当场红」，等目录满了再补，越界的代码已经进来了。

                   注意第 1 条与第 3 条只能按**词**匹配，不能按子串：L1 合法地存在
                   `values` 之外的 `getValues`、业务词之外的 `stateKey`。
                   按子串匹配会制造误报，而误报会让人去改测试——那正是这条注释开头
                   禁止的事。
*/

import { readdirSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { checkoutFiles } from "../scripts/lib/checkout-files.mjs";
import { stripComments as stripJsComments } from "../scripts/lib/strip-comments.mjs";

const sourceRoot = new URL("../packages/agent-core/src/", import.meta.url);

/** 第 4 条 + 第 7 条：框架运行时依赖，以及反向 import。 */
const forbiddenImports = [
  /^vue(?:\/|$)/,
  /^@vue\//,
  /^nuxt(?:\/|$)/,
  /^#(?:app|imports)/,
  /^pinia(?:\/|$)/,
  /^react(?:\/|$)/,
  /^react-dom(?:\/|$)/,
  /^@langchain\//,
  /^ai(?:\/|$)/,
  /^@\/components(?:\/|$)/,
  /^@\/core(?:\/|$)/,
  /(?:^|\/)frontend\//,
  /(?:^|\/)app\/core\//,
];

/** 第 1 条：具体 endpoint 或 `/api/` 路径。L1 不认识 URL。 */
const forbiddenPaths = [/\/api\//, /\/api['"`]/];

/**
 * 第 2 条：LangGraph 名称。第 3 条：DeerFlow 业务词。
 * 都按整词匹配（见文件头）。
 */
const forbiddenWords = [
  // LangGraph
  "messages-tuple",
  "checkpoints",
  "langgraph",
  "assistant_id",
  "thread_id",
  // DeerFlow 业务
  "artifact",
  "artifacts",
  "skill",
  "skills",
  "subagent",
  "browserView",
  "browser-view",
];

/** 第 5 条：cookie / token / runtime config 的读取。 */
const forbiddenReads = [
  /\bdocument\s*\.\s*cookie\b/,
  /\buseRuntimeConfig\b/,
  /\bprocess\s*\.\s*env\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
];

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directory,
    );
    return entry.isDirectory()
      ? sourceFiles(child)
      : extname(entry.name) === ".ts"
        ? [child]
        : [];
  });
}

/** 应用侧源码（相对仓库根的路径），用于反方向的深路径 import 检查。 */
function appSourceFiles(relRoot: string): string[] {
  const root = new URL(`../${relRoot}/`, import.meta.url);
  const found: string[] = [];
  const walk = (directory: URL, prefix: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`);
      } else if ([".ts", ".vue"].includes(extname(entry.name))) {
        found.push(`${prefix}${entry.name}`);
      }
    }
  };
  walk(root, `${relRoot}/`);
  return found;
}

/*
  注释里出现业务词是允许的——禁的是代码认识它们，不是文档提到它们。

  **用共享那份、别再写正则。** 正则版不认字符串：一个 `"/workspace/**"`
  就能开出假注释，把后面的代码（连同 import）一口吃掉，而这条边界正是靠
  数 import 判违规的——被吃掉的 import 数不到，是**静默放过**。
  wave 84 在 `file-header-claims` 上撞见过一次真的（`config/routes.ts`），
  同一轮把这一份也换掉：实测切换前后本仓的 import 集合逐个文件相同。
*/
function stripComments(source: string): string {
  return stripJsComments(source, ["line", "block"]);
}

const files = sourceFiles(sourceRoot).map((file) => {
  const raw = readFileSync(file, "utf8");
  return {
    name: file.pathname.split("/agent-core/").pop() ?? file.pathname,
    raw,
    code: stripComments(raw),
  };
});

describe("agent-core 的 L1 禁入清单（08）", () => {
  it("扫到了源文件（目录空掉时不能假绿）", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("没有宿主框架依赖，也没有反向 import", () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const match of file.code.matchAll(
        /(?:from\s+|import\s*)["']([^"']+)["']/g,
      )) {
        const specifier = match[1] ?? "";
        if (forbiddenImports.some((pattern) => pattern.test(specifier))) {
          violations.push(`${file.name}: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("没有具体 endpoint 或 /api/ 路径", () => {
    const violations = files
      .filter((file) => forbiddenPaths.some((p) => p.test(file.code)))
      .map((file) => file.name);
    expect(violations).toEqual([]);
  });

  it("没有 LangGraph 名称与 DeerFlow 业务词", () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const word of forbiddenWords) {
        // 整词：两侧不能再接标识符字符，否则 getValues / stateKey 会被误伤。
        const pattern = new RegExp(
          `(?<![\\w$])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w$])`,
          "i",
        );
        if (pattern.test(file.code)) violations.push(`${file.name}: ${word}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("不读 cookie / token / runtime config", () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const pattern of forbiddenReads) {
        if (pattern.test(file.code)) {
          violations.push(`${file.name}: ${pattern.source}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("应用侧不深路径 import agent-core（08 §包与 workspace 契约）", () => {
    // 反方向的那一条：L1 只能通过 `@deerflow/agent-core` 的公共导出面被消费。
    // 深路径 import 会绕过 src/index.ts，让「整包搬走」这个卖点当场作废——
    // 消费方拿到包之后发现自己依赖的是没导出的内部路径。
    // 目前应用侧一处都没有（M2 才开始接线），趁还是零的时候把门关上。
    const violations: string[] = [];
    for (const root of ["app", "tests/unit", "server"]) {
      for (const rel of appSourceFiles(root)) {
        const absolute = fileURLToPath(new URL(`../${rel}`, import.meta.url));
        const code = stripComments(readFileSync(absolute, "utf8"));
        for (const match of code.matchAll(
          /(?:from\s+|import\s*)["']([^"']+)["']/g,
        )) {
          const specifier = match[1] ?? "";
          if (/agent-core\/src(?:\/|$)/.test(specifier)) {
            violations.push(`${rel}: ${specifier}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("没有全局单例（模块级可变状态）", () => {
    // 模块顶层的 `let` / `var` 就是单例的形状：整个包共享一份，
    // 多 thread / 多 sidecar session 会互相串状态。L1 的实例必须由工厂函数创建。
    const violations: string[] = [];
    for (const file of files) {
      for (const line of file.code.split("\n")) {
        if (/^(?:export\s+)?(?:let|var)\s/.test(line)) {
          violations.push(`${file.name}: ${line.trim()}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

const l2Files = [
  "app/components/markdown/CodeBlock.vue",
  "app/components/markdown/MarkdownBlock.vue",
  "app/components/markdown/MarkdownCopyButton.vue",
  "app/components/markdown/MarkdownIcon.vue",
  "app/components/markdown/MarkdownImage.vue",
  "app/components/markdown/MarkdownLinkSafetyModal.vue",
  "app/components/markdown/MarkdownPre.vue",
  "app/components/markdown/MarkdownSafeLink.vue",
  "app/components/markdown/MarkdownTable.vue",
  "app/components/markdown/MermaidChart.vue",
  "app/components/markdown/MermaidDiagram.vue",
  "app/components/markdown/MermaidDownloadMenu.vue",
  "app/components/markdown/MermaidFullscreen.vue",
  "app/components/markdown/MermaidZoomPan.vue",
  "app/components/markdown/StreamMarkdown.vue",
  "app/components/markdown/components.ts",
  "app/components/ui/alert-dialog/AlertDialog.vue",
  "app/components/ui/alert-dialog/AlertDialogAction.vue",
  "app/components/ui/alert-dialog/AlertDialogCancel.vue",
  "app/components/ui/alert-dialog/AlertDialogContent.vue",
  "app/components/ui/alert-dialog/AlertDialogDescription.vue",
  "app/components/ui/alert-dialog/AlertDialogFooter.vue",
  "app/components/ui/alert-dialog/AlertDialogHeader.vue",
  "app/components/ui/alert-dialog/AlertDialogTitle.vue",
  "app/components/ui/alert-dialog/AlertDialogTrigger.vue",
  "app/components/ui/alert-dialog/index.ts",
  "app/components/ui/alert/Alert.vue",
  "app/components/ui/alert/AlertDescription.vue",
  "app/components/ui/alert/AlertTitle.vue",
  "app/components/ui/alert/index.ts",
  "app/components/ui/alert/variants.ts",
  "app/components/ui/badge/Badge.vue",
  "app/components/ui/badge/index.ts",
  "app/components/ui/badge/variants.ts",
  "app/components/ui/button/Button.vue",
  "app/components/ui/button/index.ts",
  "app/components/ui/button/variants.ts",
  "app/components/ui/card/Card.vue",
  "app/components/ui/card/CardAction.vue",
  "app/components/ui/card/CardContent.vue",
  "app/components/ui/card/CardDescription.vue",
  "app/components/ui/card/CardFooter.vue",
  "app/components/ui/card/CardHeader.vue",
  "app/components/ui/card/CardTitle.vue",
  "app/components/ui/card/index.ts",
  "app/components/ui/chain-of-thought/ChainOfThought.vue",
  "app/components/ui/chain-of-thought/ChainOfThoughtContent.vue",
  "app/components/ui/chain-of-thought/ChainOfThoughtStep.vue",
  "app/components/ui/chain-of-thought/context.ts",
  "app/components/ui/chain-of-thought/index.ts",
  "app/components/ui/code-editor/CodeEditor.vue",
  "app/components/ui/code-editor/index.ts",
  "app/components/ui/collapsible/Collapsible.vue",
  "app/components/ui/collapsible/CollapsibleContent.vue",
  "app/components/ui/collapsible/CollapsibleTrigger.vue",
  "app/components/ui/collapsible/index.ts",
  "app/components/ui/command/Command.vue",
  "app/components/ui/command/CommandEmpty.vue",
  "app/components/ui/command/CommandInput.vue",
  "app/components/ui/command/CommandItem.vue",
  "app/components/ui/command/CommandList.vue",
  "app/components/ui/command/CommandShortcut.vue",
  "app/components/ui/command/index.ts",
  "app/components/ui/conversation/ConversationEmptyState.vue",
  "app/components/ui/conversation/index.ts",
  "app/components/ui/dialog/Dialog.vue",
  "app/components/ui/dialog/DialogClose.vue",
  "app/components/ui/dialog/DialogContent.vue",
  "app/components/ui/dialog/DialogDescription.vue",
  "app/components/ui/dialog/DialogFooter.vue",
  "app/components/ui/dialog/DialogHeader.vue",
  "app/components/ui/dialog/DialogOverlay.vue",
  "app/components/ui/dialog/DialogTitle.vue",
  "app/components/ui/dialog/DialogTrigger.vue",
  "app/components/ui/dialog/index.ts",
  "app/components/ui/dropdown-menu/DropdownMenu.vue",
  "app/components/ui/dropdown-menu/DropdownMenuContent.vue",
  "app/components/ui/dropdown-menu/DropdownMenuGroup.vue",
  "app/components/ui/dropdown-menu/DropdownMenuItem.vue",
  "app/components/ui/dropdown-menu/DropdownMenuLabel.vue",
  "app/components/ui/dropdown-menu/DropdownMenuRadioGroup.vue",
  "app/components/ui/dropdown-menu/DropdownMenuRadioItem.vue",
  "app/components/ui/dropdown-menu/DropdownMenuSeparator.vue",
  "app/components/ui/dropdown-menu/DropdownMenuSub.vue",
  "app/components/ui/dropdown-menu/DropdownMenuSubContent.vue",
  "app/components/ui/dropdown-menu/DropdownMenuSubTrigger.vue",
  "app/components/ui/dropdown-menu/DropdownMenuTrigger.vue",
  "app/components/ui/dropdown-menu/index.ts",
  "app/components/ui/empty/Empty.vue",
  "app/components/ui/empty/EmptyContent.vue",
  "app/components/ui/empty/EmptyDescription.vue",
  "app/components/ui/empty/EmptyHeader.vue",
  "app/components/ui/empty/EmptyMedia.vue",
  "app/components/ui/empty/EmptyTitle.vue",
  "app/components/ui/empty/index.ts",
  "app/components/ui/hover-card/HoverCard.vue",
  "app/components/ui/hover-card/HoverCardContent.vue",
  "app/components/ui/hover-card/HoverCardTrigger.vue",
  "app/components/ui/hover-card/index.ts",
  "app/components/ui/input/Input.vue",
  "app/components/ui/input/index.ts",
  "app/components/ui/popover/Popover.vue",
  "app/components/ui/popover/PopoverAnchor.vue",
  "app/components/ui/popover/PopoverContent.vue",
  "app/components/ui/popover/PopoverTrigger.vue",
  "app/components/ui/popover/index.ts",
  "app/components/ui/progress/Progress.vue",
  "app/components/ui/progress/index.ts",
  "app/components/ui/reasoning/Reasoning.vue",
  "app/components/ui/reasoning/ReasoningContent.vue",
  "app/components/ui/reasoning/ReasoningTrigger.vue",
  "app/components/ui/reasoning/context.ts",
  "app/components/ui/reasoning/index.ts",
  "app/components/ui/scroll-area/ScrollArea.vue",
  "app/components/ui/scroll-area/index.ts",
  "app/components/ui/select/Select.vue",
  "app/components/ui/select/SelectContent.vue",
  "app/components/ui/select/SelectGroup.vue",
  "app/components/ui/select/SelectItem.vue",
  "app/components/ui/select/SelectLabel.vue",
  "app/components/ui/select/SelectScrollDownButton.vue",
  "app/components/ui/select/SelectScrollUpButton.vue",
  "app/components/ui/select/SelectSeparator.vue",
  "app/components/ui/select/SelectTrigger.vue",
  "app/components/ui/select/SelectValue.vue",
  "app/components/ui/select/index.ts",
  "app/components/ui/sheet/Sheet.vue",
  "app/components/ui/sheet/SheetClose.vue",
  "app/components/ui/sheet/SheetContent.vue",
  "app/components/ui/sheet/SheetDescription.vue",
  "app/components/ui/sheet/SheetFooter.vue",
  "app/components/ui/sheet/SheetHeader.vue",
  "app/components/ui/sheet/SheetTitle.vue",
  "app/components/ui/sheet/SheetTrigger.vue",
  "app/components/ui/sheet/index.ts",
  "app/components/ui/sheet/variants.ts",
  "app/components/ui/sidebar/SidebarGroup.vue",
  "app/components/ui/sidebar/SidebarGroupContent.vue",
  "app/components/ui/sidebar/SidebarGroupLabel.vue",
  "app/components/ui/sidebar/SidebarMenu.vue",
  "app/components/ui/sidebar/SidebarMenuAction.vue",
  "app/components/ui/sidebar/SidebarMenuButton.vue",
  "app/components/ui/sidebar/SidebarMenuItem.vue",
  "app/components/ui/sidebar/SidebarTrigger.vue",
  "app/components/ui/sidebar/index.ts",
  "app/components/ui/sidebar/menu-button-variants.ts",
  "app/components/ui/skeleton/Skeleton.vue",
  "app/components/ui/skeleton/index.ts",
  "app/components/ui/switch/Switch.vue",
  "app/components/ui/switch/index.ts",
  "app/components/ui/tabs/Tabs.vue",
  "app/components/ui/tabs/TabsContent.vue",
  "app/components/ui/tabs/TabsList.vue",
  "app/components/ui/tabs/TabsTrigger.vue",
  "app/components/ui/tabs/index.ts",
  "app/components/ui/tabs/variants.ts",
  "app/components/ui/textarea/Textarea.vue",
  "app/components/ui/textarea/index.ts",
  "app/components/ui/toggle-group/ToggleGroup.vue",
  "app/components/ui/toggle-group/ToggleGroupItem.vue",
  "app/components/ui/toggle-group/index.ts",
  "app/components/ui/tooltip/Tooltip.vue",
  "app/components/ui/tooltip/TooltipContent.vue",
  "app/components/ui/tooltip/TooltipProvider.vue",
  "app/components/ui/tooltip/TooltipTrigger.vue",
  "app/components/ui/tooltip/index.ts",
  "app/core/code-editor/editor.ts",
  "app/core/code-editor/language.ts",
  "app/core/code-editor/palette.ts",
  "app/core/markdown/animate.ts",
  "app/core/markdown/blocks.ts",
  "app/core/markdown/index.ts",
  "app/core/markdown/links.ts",
  "app/core/markdown/math.ts",
  "app/core/markdown/mermaid-export.ts",
  "app/core/markdown/pipeline.ts",
  "app/core/markdown/plugins.ts",
  "app/core/markdown/render.ts",
  "app/core/markdown/rendering-context.ts",
  "app/core/markdown/safe-markdown.ts",
  "app/lib/utils.ts",
] as const;

const l2ForbiddenImports = [
  /^@\/core\/(?:agent-deerflow|api|artifacts|auth|channels|config|models|settings|sidecar|skills|tasks|threads|uploads)(?:\/|$)/,
  /^@\/components\/(?:chat|workspace)(?:\/|$)/,
  /^@\/composables(?:\/|$)/,
  /^@\/stores(?:\/|$)/,
  /^#(?:app|imports)(?:\/|$)/,
];

/*
  头里自称 L2 的文件，实测集合。**这是 `l2Files` 的反向口径**——原来只有正向
  （名单上的每一份都要有 L2 头），于是「自称 L2 但没上名单」的文件**谁都不检查**：
  下面那条进口边界只遍历名单。

  wave 61 实测：162 份文件自称 L2，名单上只有 132 份。缺的 30 份全部创建于名单
  最后一次改动（`fa2cde27`，2026-08-13）之后——MarkdownTable 是 08-24，
  dropdown-menu 的 Sub 三件是 08-26，select、card、alert、input、badge 是 08-30——
  也就是说，**「新增 L2 组件要加进 l2Files」这条成文规则，三周里每一次都被违反了，
  而没有任何门禁变红**。其中 `app/core/auth/logout.ts` 拿这条边界一跑就违规
  （import `@/core/auth/client-state`），它本来就不该是 L2，已改成 L3。

  名单同时**改成全表字母序**：它此前是「按冻结时间追加」（当时那份 focusable
  模块卡在第 30 位、`app/core/code-editor/*` 在第 41 位；那份文件 wave 148 已删），而交接文档一直写着「按字母序」。
  顺序对这份名单没有任何语义（只被两个 for...of 消费），排序之后插入位置唯一，
  下面那条断言把它钉住。
*/
function filesClaimingL2(): string[] {
  // 【坑】扫描面要含**未跟踪且未被忽略**的文件：只看 `git ls-files` 的话，
  // 一份刚写出来、还没提交的 L2 文件是隐形的——而这条边界最该拦住它的时刻
  // 正是提交之前。理由与去重/存在性过滤都在 scripts/lib/checkout-files.mjs。
  const present = checkoutFiles(["app", "server", "packages", "scripts"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
  }).filter((file) => /\.(ts|mts|mjs|vue)$/.test(file));
  const claiming: string[] = [];
  for (const file of present) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const label = /【架构位置】\s*(.+)/.exec(source)?.[1]?.trim();
    if (label && /^L2(\s|$|—|，|\()/.test(label)) claiming.push(file);
  }
  return claiming;
}

/*
  **L1 / L3 的标签有意不上门禁**（wave 61 量过之后写下的理由，别再重新问一遍）：
  L2 这个标签有牙——它对应 `l2Files` 与 `l2ForbiddenImports`，写错会让一份产品
  代码混进可复用层。L1 与 L3 没有任何被强制的后果：L1 的定义域就是
  `packages/agent-core/`（实测 23 份 src 文件全部写着 L1，一份不漏），
  L3 是「除此之外的一切」，标签错了不会让任何 import 变得合法或非法。
  **一条只保护注释、不保护任何约束的门禁，不如把理由写下来**（同线索 179 的
  「需要十三条豁免的门禁不如不立」）。

  实测的唯一一处第二义：`app/core/channels/provider-state.ts` 写着
  `L1 framework-neutral channel policy`。它在 `packages/agent-core/` 之外，
  按分层表该是 L3；但它只 import 一个同目录的 type，那句 L1 说的是
  「与框架无关的纯策略」这条**另一个轴**。**有意保留**：改成 L3 会丢掉那句信息，
  而它没有误导任何 import 判断。`app/components/ui/effects/` 下九份文件反过来——
  在 L2 目录里却写着 L3，理由写在各自文件头（只服务产品特效，不进 M8 公共集合），
  下面那条集合断言因此按**标签**而不是按目录判。
*/
describe("L2 reusable UI boundary", () => {
  it("扫到的文件数不是零（形状先断言再计算）", () => {
    const claiming = filesClaimingL2();
    expect(claiming.length).toBeGreaterThan(100);
    expect(l2Files.length).toBeGreaterThan(100);
  });

  it("自称 L2 的文件集合逐个等于 l2Files", () => {
    /*
      两个方向都要：**多出来的**会绕过下面那条进口边界（wave 61 撞到 30 份），
      **少掉的**说明名单里有份文件已经改了头或已经不是 L2 了。
    */
    expect([...filesClaimingL2()].sort()).toEqual([...l2Files].sort());
  });

  it("l2Files 按字母序，新增只有一个正确位置", () => {
    expect([...l2Files]).toEqual([...l2Files].sort());
  });

  it("freezes the exact reusable source set and final L2 headers", () => {
    const missing: string[] = [];
    for (const file of l2Files) {
      const source = readFileSync(
        new URL(`../${file}`, import.meta.url),
        "utf8",
      );
      if (!/【架构位置】\s+L2(?:\s|$)/.test(source)) missing.push(file);
      if (source.includes("L2 候选")) missing.push(`${file}: candidate`);
    }
    expect(missing).toEqual([]);
  });

  it("keeps L2 independent from DeerFlow product wiring", () => {
    const violations: string[] = [];
    for (const file of l2Files) {
      const source = stripComments(
        readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      );
      for (const match of source.matchAll(
        /(?:from\s+|import\s*)["']([^"']+)["']/g,
      )) {
        const specifier = match[1] ?? "";
        if (l2ForbiddenImports.some((pattern) => pattern.test(specifier))) {
          violations.push(`${file}: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  /*
    **`ARCHITECTURE.md:84`：「`app/components/ui/` 是唯一的交互控件底座，建在 Reka UI
    之上」——这句话此前没有任何机器在守**（wave 153 逐句盘点 `ARCHITECTURE.md` 里
    43 句规范性断言时量到的；`grep -rn reka-ui tests/ scripts/` 只找到三处，
    都是 chunk 分桶与体积预算在用它当**打包种子**，没有一处在守这条边界）。

    实测当时它是**真的**：`app/` 与 `packages/` 里 `ui/` 之外 **0 处** import `reka-ui`，
    `ui/` 之内 **69 份**。**一条正确但没人守的边界，和一条错的边界只差一次改动**——
    产品组件直接建在 reka 上，就绕开了这一层统一补的东西：`aria-modal`、z-index 分层、
    可访问名走 `primitives.*`、以及 wave 148 那三处刚收拢回来的模态语义。

    判据零豁免（坑 180）：**`app/components/ui/` 之外，任何文件都不许 import `reka-ui`**。
    需要 primitive 就去 `ui/` 里加一个，而不是在产品层直接拿 reka 拼一个。
    反方向也查：`ui/` 那一半必须**真的**在用 reka——否则上面那个 0 是在数空气。
  */
  it("keeps Reka behind app/components/ui/", () => {
    const inside: string[] = [];
    const outside: string[] = [];
    for (const file of checkoutFiles(["app", "packages"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
    })) {
      if (!/\.(vue|ts)$/.test(file)) continue;
      const source = stripJsComments(
        readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
        file.endsWith(".vue") ? ["line", "block", "html"] : ["line", "block"],
      );
      if (!/["']reka-ui["']/.test(source)) continue;
      (file.startsWith("app/components/ui/") ? inside : outside).push(file);
    }
    // 尺子先量自己：路径或正则写坏会让下面那条静默全绿（坑 131）。
    expect(inside.length).toBeGreaterThan(50);
    expect(
      outside,
      "Reka 只能出现在 app/components/ui/ 里——产品层需要 primitive 就去那一层加一个，" +
        "直接建在 reka 上会绕开这一层统一补的 aria-modal、z-index 分层与可访问名约定。",
    ).toEqual([]);
  });

  it("uses artifacts as a one-way extension consumer", () => {
    const artifactPanel = readFileSync(
      new URL(
        "../app/components/workspace/artifacts/ArtifactPanel.vue",
        import.meta.url,
      ),
      "utf8",
    );
    const artifactPreview = readFileSync(
      new URL(
        "../app/components/workspace/artifacts/ArtifactPreview.vue",
        import.meta.url,
      ),
      "utf8",
    );
    expect(artifactPanel).toContain(
      'import ArtifactPreview from "./ArtifactPreview.vue"',
    );
    expect(artifactPreview).toContain(
      'import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue"',
    );
  });
});
