/* W09: same stateful Gateway and browser actions feed React and Vue.
 * Source contracts: projects.py/project_documents.py/trash.py; source acceptance:
 * frontend/tests/e2e/project-documents.spec.ts and e2e-real-backend/project-trash.spec.ts.
 * Each state starts with a fresh mock, so destructive actions are independently sampled. */
import type { ParityDimension, ParityScenario, ParityStep } from "./scenarios";
import type { MockAPIOptions } from "../../e2e/utils/mock-api";

const projectId = "00000000-0000-0000-0000-0000000000c1";
const threadId = "00000000-0000-0000-0000-000000000001";
const path = `/workspace/projects/${projectId}`;
const dimensions: ParityDimension[] = [
  { viewport: "desktop", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "dark", locale: "en-US" },
  { viewport: "mobile", theme: "light", locale: "en-US" },
];
const base: MockAPIOptions = {
  projects: [
    {
      id: projectId,
      name: "Quarterly research",
      instructions: "Keep the source links.",
    },
  ],
  threads: [
    {
      thread_id: threadId,
      title: "Project chat",
      updated_at: "2026-10-09T00:00:00Z",
      metadata: { deerflow_project_id: projectId },
    },
  ],
};
const document = {
  id: "parity-shelf-report",
  project_id: projectId,
  name: "report.docx",
  size_bytes: 14,
  content: "original bytes",
  content_type:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  preview_content: "# Converted report\n\nReadable companion",
  preview_content_type: "text/markdown",
};
const trashDocument = {
  id: "parity-trash-report",
  project_id: projectId,
  name: "old-notes.txt",
  size_bytes: 11,
  content: "saved notes",
  trashed_at: "2026-10-09T00:00:00Z",
  trash_origin: { project_id: projectId, project_name: "Quarterly research" },
};
const docs: ParityStep[] = [
  { kind: "click", target: { role: "tab", name: "Documents", exact: true } },
  { kind: "visible", target: { testId: "project-documents-shelf" } },
];
const confirmTrash = {
  selector: '[role="dialog"] button:has-text("Move to trash")',
};
const scenario = (
  input: Omit<
    ParityScenario,
    "backend" | "settle" | "dimensions" | "upstreamSpecs"
  >,
): ParityScenario => ({
  backend: "mock",
  settle: [],
  dimensions,
  upstreamSpecs: ["project-documents"],
  ...input,
});

export const PROJECT_PARITY_SCENARIOS: ParityScenario[] = [
  scenario({
    id: "project-workflows",
    title: "项目四个页签、指令保存与设置",
    path,
    mock: { ...base, projectsConfig: { instructions_max_bytes: 6 } },
    states: [
      {
        id: "chats",
        steps: [
          {
            kind: "visible",
            target: { role: "tab", name: "Chats", exact: true },
          },
          { kind: "visible", target: { text: "Project chat", exact: true } },
        ],
      },
      {
        id: "documents",
        steps: [
          ...docs,
          {
            kind: "visible",
            target: { text: "No documents yet", exact: true },
          },
        ],
      },
      {
        id: "instructions-over-limit",
        steps: [
          {
            kind: "click",
            target: { role: "tab", name: "Instructions", exact: true },
          },
          {
            kind: "fill",
            target: { role: "textbox", name: "Instructions", exact: true },
            value: "中文a",
          },
          {
            kind: "visible",
            target: {
              text: "Instructions are over the 6-byte limit. Shorten them to save.",
              exact: true,
            },
          },
        ],
      },
      {
        id: "instructions-saved",
        steps: [
          {
            kind: "click",
            target: { role: "tab", name: "Instructions", exact: true },
          },
          {
            kind: "fill",
            target: { role: "textbox", name: "Instructions", exact: true },
            value: "中文",
          },
          {
            kind: "click",
            target: { role: "button", name: "Save", exact: true },
          },
          { kind: "visible", target: { text: "Saved", exact: true } },
        ],
      },
      {
        id: "settings",
        steps: [
          {
            kind: "click",
            target: { role: "tab", name: "Settings", exact: true },
          },
          {
            kind: "visible",
            target: { role: "textbox", name: "Project name", exact: true },
          },
          {
            kind: "visible",
            target: { role: "button", name: "Archive", exact: true },
          },
        ],
      },
    ],
  }),
  scenario({
    id: "project-document-upload",
    title: "文件上传进入 shelf 并进入回收确认",
    path,
    mock: base,
    states: [
      {
        id: "uploaded",
        steps: [
          ...docs,
          {
            kind: "set-input-files",
            target: { testId: "project-documents-upload-input" },
            file: {
              name: "notes.txt",
              mimeType: "text/plain",
              base64: "aGVsbG8gc2hlbGY=",
            },
          },
          { kind: "visible", target: { text: "notes.txt", exact: true } },
        ],
      },
      {
        id: "trash-confirmation",
        steps: [
          ...docs,
          {
            kind: "set-input-files",
            target: { testId: "project-documents-upload-input" },
            file: {
              name: "notes.txt",
              mimeType: "text/plain",
              base64: "aGVsbG8gc2hlbGY=",
            },
          },
          { kind: "visible", target: { text: "notes.txt", exact: true } },
          {
            kind: "click",
            target: { role: "button", name: "Move to trash", exact: true },
          },
          {
            kind: "visible",
            target: { role: "dialog", name: "Move to trash?", exact: true },
          },
        ],
      },
      {
        id: "trashed",
        steps: [
          ...docs,
          {
            kind: "set-input-files",
            target: { testId: "project-documents-upload-input" },
            file: {
              name: "notes.txt",
              mimeType: "text/plain",
              base64: "aGVsbG8gc2hlbGY=",
            },
          },
          { kind: "visible", target: { text: "notes.txt", exact: true } },
          {
            kind: "click",
            target: { role: "button", name: "Move to trash", exact: true },
          },
          { kind: "click", target: confirmTrash },
          {
            kind: "visible",
            target: { text: "No documents yet", exact: true },
          },
        ],
      },
    ],
  }),
  scenario({
    id: "project-document-preview-download",
    title: "转换预览与原始文件下载互不混淆",
    path,
    mock: { ...base, projectDocuments: [document] },
    states: [
      {
        id: "preview",
        steps: [
          ...docs,
          {
            kind: "click",
            target: { role: "button", name: "Preview", exact: true },
          },
          {
            kind: "visible",
            target: { role: "dialog", name: "report.docx", exact: true },
          },
          {
            kind: "visible",
            target: {
              text: "# Converted report\n\nReadable companion",
              exact: true,
            },
          },
        ],
      },
      {
        id: "original-downloaded",
        steps: [
          ...docs,
          {
            kind: "download",
            target: { role: "link", name: "Download", exact: true },
            suggestedFilename: "report.docx",
          },
          { kind: "visible", target: { text: "report.docx", exact: true } },
        ],
      },
    ],
  }),
  scenario({
    id: "project-document-attach",
    title: "文档附加后交接给目标聊天输入区",
    path,
    mock: { ...base, projectDocuments: [document] },
    steps: [
      ...docs,
      {
        kind: "click",
        target: { role: "button", name: "Attach to chat", exact: true },
      },
      {
        kind: "click",
        target: { role: "button", name: "Project chat", exact: true },
      },
      { kind: "visible", target: { testId: "project-attachment-chip" } },
    ],
  }),
  scenario({
    id: "project-document-archived",
    title: "归档 shelf 可预览下载附加且不能写入",
    path,
    mock: {
      ...base,
      projects: [{ ...base.projects![0]!, status: "archived" }],
      projectDocuments: [document],
    },
    steps: [
      ...docs,
      {
        kind: "visible",
        target: { testId: "project-documents-archived-banner" },
      },
      { kind: "hidden", target: { testId: "project-documents-upload-input" } },
      {
        kind: "hidden",
        target: { role: "button", name: "Move to trash", exact: true },
      },
      {
        kind: "visible",
        target: { role: "button", name: "Preview", exact: true },
      },
      {
        kind: "visible",
        target: { role: "link", name: "Download", exact: true },
      },
      {
        kind: "visible",
        target: { role: "button", name: "Attach to chat", exact: true },
      },
    ],
  }),
  scenario({
    id: "project-document-promotion",
    title: "会话文件复制到 shelf 并保留来源",
    path,
    mock: {
      ...base,
      threadFileGroups: [
        {
          thread_id: threadId,
          display_name: "Project chat",
          updated_at: "2026-10-09T00:00:00Z",
          files: [
            {
              kind: "output",
              name: "answer.txt",
              content: "tool output",
              size_bytes: 11,
              modified_at: "2026-10-09T00:00:00Z",
              artifact_url: `/api/threads/${threadId}/artifacts/mnt/user-data/outputs/answer.txt`,
            },
          ],
        },
      ],
    },
    steps: [
      ...docs,
      {
        kind: "click",
        target: { role: "button", name: "Save to project", exact: true },
      },
      {
        kind: "fill",
        target: { role: "textbox", name: "Shelf name", exact: true },
        value: "saved-answer.txt",
      },
      {
        kind: "click",
        target: {
          selector: '[role="dialog"] button:text-is("Save to project")',
        },
      },
      { kind: "visible", target: { text: "saved-answer.txt", exact: true } },
      {
        kind: "visible",
        target: { text: "from Project chat · output", exact: true },
      },
    ],
  }),
  scenario({
    id: "project-trash",
    title: "真实回收站路由的来源、恢复及永久删除",
    path: "/workspace/trash",
    mock: { ...base, trashDocuments: [trashDocument] },
    states: [
      {
        id: "listing",
        steps: [
          { kind: "visible", target: { text: "old-notes.txt", exact: true } },
          {
            kind: "visible",
            target: { role: "button", name: "Restore", exact: true },
          },
        ],
      },
      {
        id: "restored",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: "Restore", exact: true },
          },
          { kind: "visible", target: { text: "Trash is empty.", exact: true } },
        ],
      },
      {
        id: "purge-confirmation",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: "Delete permanently", exact: true },
          },
          {
            kind: "visible",
            target: {
              role: "dialog",
              name: "Delete permanently?",
              exact: true,
            },
          },
        ],
      },
      {
        id: "purged",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: "Delete permanently", exact: true },
          },
          {
            kind: "click",
            target: {
              selector: '[role="dialog"] button:has-text("Delete permanently")',
            },
          },
          { kind: "visible", target: { text: "Trash is empty.", exact: true } },
        ],
      },
      {
        id: "empty-confirmation",
        steps: [
          { kind: "click", target: { testId: "trash-empty-button" } },
          {
            kind: "visible",
            target: { role: "dialog", name: "Empty trash?", exact: true },
          },
        ],
      },
      {
        id: "emptied",
        steps: [
          { kind: "click", target: { testId: "trash-empty-button" } },
          {
            kind: "click",
            target: {
              selector: '[role="dialog"] button:has-text("Empty trash")',
            },
          },
          { kind: "visible", target: { text: "Trash is empty.", exact: true } },
        ],
      },
    ],
  }),
  scenario({
    id: "project-trash-orphan",
    title: "原项目已失效时选取活跃项目恢复",
    path: "/workspace/trash",
    mock: {
      ...base,
      trashDocuments: [
        {
          ...trashDocument,
          trash_origin: { project_id: "gone", project_name: "Removed project" },
        },
      ],
    },
    steps: [
      {
        kind: "click",
        target: { role: "button", name: "Restore", exact: true },
      },
      {
        kind: "visible",
        target: { role: "dialog", name: "Choose a project", exact: true },
      },
      {
        kind: "visible",
        target: { role: "button", name: "Quarterly research", exact: true },
      },
    ],
  }),
  scenario({
    id: "project-trash-content-conflict",
    title: "缺失或损坏原件恢复失败后保留回收项",
    path: "/workspace/trash",
    mock: {
      ...base,
      trashDocuments: [{ ...trashDocument, content_missing: true }],
    },
    steps: [
      {
        kind: "click",
        target: { role: "button", name: "Restore", exact: true },
      },
      {
        kind: "visible",
        target: {
          text: "This document's content is missing or damaged, so it stays in the trash.",
          exact: true,
        },
      },
      { kind: "visible", target: { text: "old-notes.txt", exact: true } },
    ],
  }),
  scenario({
    id: "project-trash-partial-purge",
    title: "部分清空失败刷新已删除项并保留剩余项",
    path: "/workspace/trash",
    mock: {
      ...base,
      trashPurgeFailureIds: ["parity-trash-fail"],
      trashDocuments: [
        trashDocument,
        { ...trashDocument, id: "parity-trash-fail", name: "remaining.txt" },
      ],
    },
    steps: [
      { kind: "click", target: { testId: "trash-empty-button" } },
      {
        kind: "click",
        target: { selector: '[role="dialog"] button:has-text("Empty trash")' },
      },
      {
        kind: "visible",
        target: {
          text: "Purge failed during file cleanup; the remaining documents stay in trash and the purge can be retried",
          exact: true,
        },
      },
      { kind: "hidden", target: { text: "old-notes.txt", exact: true } },
      { kind: "visible", target: { text: "remaining.txt", exact: true } },
    ],
  }),
];
