import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const THREAD_ID = "00000000-0000-0000-0000-000000000701";

function seedProject(): Parameters<typeof mockLangGraphAPI>[1] {
  return {
    projects: [{ id: PROJECT_ID, name: "Alpha" }],
    threads: [
      {
        thread_id: THREAD_ID,
        title: "Project chat",
        updated_at: "2026-09-10T10:00:00Z",
        metadata: { deerflow_project_id: PROJECT_ID },
      },
    ],
  };
}

async function openDocumentsTab(page: Page) {
  await page.goto(`/workspace/projects/${PROJECT_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await expect(page.getByTestId("project-documents-shelf")).toBeVisible();
}

test("project document lifecycle: upload → shelf → attach → trash → restore → purge", async ({
  page,
}) => {
  mockLangGraphAPI(page, seedProject());

  // Upload joins the shelf.
  await openDocumentsTab(page);
  await page.getByTestId("project-documents-upload-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello shelf"),
  });
  await expect(page.getByText("notes.txt", { exact: true })).toBeVisible();

  // Attach hands the thread's composer a completed attachment.
  await page
    .getByRole("button", { name: "Attach to chat", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Project chat", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspace/chats/${THREAD_ID}`));
  await expect(page.getByTestId("project-attachment-chip")).toContainText(
    "notes.txt",
  );

  // Move to trash behind its retention-window confirmation.
  await openDocumentsTab(page);
  await page
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await expect(
    page.getByText(/will move to the trash and stay recoverable for 30 days/),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await expect(page.getByText("No documents yet")).toBeVisible();

  // Trash view: origin project + retention, then restore into the origin.
  await page.goto("/workspace/trash", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("notes.txt", { exact: true })).toBeVisible();
  await expect(page.getByText(/from Alpha/)).toBeVisible();
  await expect(page.getByText(/days left/)).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Trash is empty.")).toBeVisible();

  // Restored row is back on the shelf; trash it again, then purge for good.
  await openDocumentsTab(page);
  await expect(page.getByText("notes.txt", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await page.goto("/workspace/trash", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(
    page.getByText(/will be permanently deleted. This cannot be undone./),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByText("Trash is empty.")).toBeVisible();
});

test("Empty trash permanently deletes every freshly trashed row", async ({
  page,
}) => {
  const trashedAt = new Date(Date.now() - 60_000).toISOString();
  mockLangGraphAPI(page, {
    ...seedProject(),
    trashDocuments: ["one.txt", "two.txt"].map((name, index) => ({
      id: `trash-${index}`,
      project_id: PROJECT_ID,
      name,
      size_bytes: 32,
      // Trashed a minute ago: far inside the 30-day retention window, so the
      // action cannot lean on the retention sweep to delete them.
      trashed_at: trashedAt,
      trash_origin: { project_id: PROJECT_ID, project_name: "Alpha" },
    })),
  });

  await page.goto("/workspace/trash", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("one.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("two.txt", { exact: true })).toBeVisible();

  await page.getByTestId("trash-empty-button").click();
  await expect(
    page.getByText(
      "2 documents will be permanently deleted. This cannot be undone.",
    ),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Empty trash", exact: true })
    .click();

  // The confirmation promised both rows; both are gone.
  await expect(page.getByText("Trash is empty.")).toBeVisible();
  await expect(page.getByText("one.txt", { exact: true })).toHaveCount(0);
  await expect(page.getByText("two.txt", { exact: true })).toHaveCount(0);
});

test("the shelf paginates past the first page and the trash confirmation names the configured retention", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    projectsConfig: { trash_retention_days: 7 },
    projectDocuments: Array.from({ length: 120 }, (_, index) => ({
      id: `doc-${index}`,
      project_id: PROJECT_ID,
      name: `doc-${String(index).padStart(3, "0")}.txt`,
      size_bytes: 128,
    })),
  });

  await openDocumentsTab(page);
  // First page: 100 of 120 loaded, with a Load more affordance.
  await expect(page.getByText("Showing 100 of 120")).toBeVisible();
  await expect(page.getByText("doc-099.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("doc-119.txt", { exact: true })).toHaveCount(0);
  await page.getByTestId("project-documents-load-more").click();
  await expect(page.getByText("Showing 120 of 120")).toBeVisible();
  await expect(page.getByText("doc-119.txt", { exact: true })).toBeVisible();
  await expect(page.getByTestId("project-documents-load-more")).toHaveCount(0);

  // The confirmation names the server-configured 7-day window, not the
  // 30-day default.
  await page
    .getByRole("button", { name: "Move to trash", exact: true })
    .first()
    .click();
  await expect(page.getByText(/stay recoverable for 7 days/)).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
});

test("the trash view paginates and counts down the configured retention window", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    projectsConfig: { trash_retention_days: 7 },
    trashDocuments: Array.from({ length: 120 }, (_, index) => ({
      id: `trash-${index}`,
      project_id: PROJECT_ID,
      name: `trash-${String(index).padStart(3, "0")}.txt`,
      size_bytes: 64,
      // Trashed 10 days ago: past the configured 7-day window.
      trashed_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      trash_origin: { project_id: PROJECT_ID, project_name: "Alpha" },
    })),
  });

  await page.goto("/workspace/trash", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Showing 100 of 120")).toBeVisible();
  await page.getByTestId("trash-load-more").click();
  await expect(page.getByText("Showing 120 of 120")).toBeVisible();
  await expect(page.getByTestId("trash-load-more")).toHaveCount(0);
  await expect(page.getByText(/Less than a day left/).first()).toBeVisible();
});

test("a project member thread renders no injected <project> text in the message list", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    projects: [
      {
        id: PROJECT_ID,
        name: "Alpha",
        instructions: "Always answer in haiku.",
      },
    ],
    threads: [
      {
        thread_id: THREAD_ID,
        title: "Project chat",
        updated_at: "2026-09-10T10:00:00Z",
        metadata: { deerflow_project_id: PROJECT_ID },
        messages: [
          {
            type: "human",
            id: "msg-human-1",
            content: [{ type: "text", text: "status?" }],
          },
          { type: "ai", id: "msg-ai-1", content: "all green" },
        ],
      },
    ],
  });
  await page.goto(`/workspace/chats/${THREAD_ID}`, {
    waitUntil: "domcontentloaded",
  });
  const list = page.getByTestId("main-message-list");
  await expect(list.getByText("all green", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // Project context is injected request-side only: no <project> block, and no
  // instructions text, ever reaches the rendered conversation.
  await expect(list.getByText(/<project>/)).toHaveCount(0);
  await expect(list.getByText(/Always answer in haiku/)).toHaveCount(0);
});

test("four project tabs persist UTF-8 instructions and project settings", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    projectsConfig: { instructions_max_bytes: 6 },
  });
  await page.goto(`/workspace/projects/${PROJECT_ID}`);
  for (const name of ["Chats", "Documents", "Instructions", "Settings"])
    await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Instructions", exact: true }).click();
  const input = page.getByRole("textbox", {
    name: "Instructions",
    exact: true,
  });
  await input.fill("中文a");
  await expect(
    page.getByRole("alert").filter({ hasText: "6-byte limit" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await input.fill("中文");
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().endsWith(`/projects/${PROJECT_ID}`),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await response).status()).toBe(200);
  await page.reload();
  await page.getByRole("tab", { name: "Instructions", exact: true }).click();
  await expect(input).toHaveValue("中文");
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill("Alpha renamed");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Alpha renamed", exact: true }),
  ).toBeVisible();
});

test("converted preview preserves the original download bytes and filename", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    projectDocuments: [
      {
        id: "converted",
        project_id: PROJECT_ID,
        name: "report.docx",
        size_bytes: 14,
        content: "original bytes",
        content_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        preview_content: "# Converted report\n\nReadable companion",
        preview_content_type: "text/markdown",
      },
    ],
  });
  await openDocumentsTab(page);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "report.docx", exact: true });
  await expect(dialog.locator("pre")).toHaveText(
    "# Converted report\n\nReadable companion",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("report.docx");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe("original bytes");
});

test("conversation file promotion creates an independent shelf row with provenance", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    threadFileGroups: [
      {
        thread_id: THREAD_ID,
        display_name: "Project chat",
        updated_at: "2026-10-09T00:00:00Z",
        files: [
          {
            kind: "output",
            name: "answer.txt",
            size_bytes: 11,
            modified_at: "2026-10-09T00:00:00Z",
            artifact_url: "/api/artifact",
            content: "tool output",
          },
        ],
      },
    ],
  });
  await openDocumentsTab(page);
  await page
    .getByRole("button", { name: "Save to project", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Save to project",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Shelf name", exact: true })
    .fill("saved-answer.txt");
  await dialog
    .getByRole("button", { name: "Save to project", exact: true })
    .click();
  await expect(
    page
      .getByTestId("project-documents-shelf")
      .getByText("saved-answer.txt", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("project-documents-shelf")
      .getByText("from Project chat · output", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("project-thread-files")
      .getByText("answer.txt", { exact: true }),
  ).toBeVisible();
});

test("archived projects retain preview/download/attach while disabling shelf writes", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    projects: [{ id: PROJECT_ID, name: "Alpha", status: "archived" }],
    projectDocuments: [
      {
        id: "readonly",
        project_id: PROJECT_ID,
        name: "readonly.txt",
        size_bytes: 4,
        content: "safe",
      },
    ],
  });
  await openDocumentsTab(page);
  await expect(
    page.getByTestId("project-documents-archived-banner"),
  ).toBeVisible();
  await expect(page.getByTestId("project-documents-upload-input")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Move to trash", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save to project", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Download", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Attach to chat", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("safe", { exact: true }),
  ).toBeVisible();
});

test("restore chooses an active replacement project, merges identical content and preserves damaged rows", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    projectDocuments: [
      {
        id: "survivor",
        project_id: PROJECT_ID,
        name: "existing.txt",
        size_bytes: 4,
        content: "same",
      },
    ],
    trashDocuments: [
      {
        id: "orphan",
        project_id: "gone",
        name: "orphan.txt",
        size_bytes: 4,
        content: "same",
        trashed_at: new Date().toISOString(),
        trash_origin: { project_id: "gone", project_name: "Gone" },
      },
      {
        id: "broken",
        project_id: PROJECT_ID,
        name: "broken.txt",
        size_bytes: 4,
        content_missing: true,
        trashed_at: new Date().toISOString(),
        trash_origin: { project_id: PROJECT_ID, project_name: "Alpha" },
      },
    ],
  });
  await page.goto("/workspace/trash");
  const orphan = page.locator('[data-trash-document-id="orphan"]');
  await orphan.getByRole("button", { name: "Restore", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose a project", exact: true })
    .getByRole("button", { name: "Alpha", exact: true })
    .click();
  await expect(orphan).toHaveCount(0);
  const broken = page.locator('[data-trash-document-id="broken"]');
  await broken.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(
    page.getByText(
      "This document's content is missing or damaged, so it stays in the trash.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(broken).toBeVisible();
  await openDocumentsTab(page);
  await expect(page.getByText("Showing 1 of 1", { exact: true })).toBeVisible();
  await expect(page.getByText("existing.txt", { exact: true })).toBeVisible();
});

test("partial empty-trash failure refetches removed rows and preserves remaining retryable rows", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    trashPurgeFailureIds: ["fail"],
    trashDocuments: ["removed", "fail", "remaining"].map((id) => ({
      id,
      project_id: PROJECT_ID,
      name: `${id}.txt`,
      size_bytes: 4,
      trashed_at: new Date().toISOString(),
      trash_origin: { project_id: PROJECT_ID, project_name: "Alpha" },
    })),
  });
  await page.goto("/workspace/trash");
  await page.getByTestId("trash-empty-button").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Empty trash", exact: true })
    .click();
  await expect(
    page.getByText(
      "Purge failed during file cleanup; the remaining documents stay in trash and the purge can be retried",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('[data-trash-document-id="removed"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-trash-document-id="fail"]')).toBeVisible();
  await expect(
    page.locator('[data-trash-document-id="remaining"]'),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Empty trash", exact: true }),
  ).toBeEnabled();
});

test("member threads paginate independently from per-thread conversation file limits", async ({
  page,
}) => {
  const members = Array.from({ length: 120 }, (_, i) => ({
    thread_id: `40000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
    title: `Member ${String(i).padStart(3, "0")}`,
    updated_at: "2026-10-09T00:00:00Z",
    metadata: { deerflow_project_id: PROJECT_ID },
  }));
  mockLangGraphAPI(page, {
    ...seedProject(),
    threads: members,
    threadFileGroups: [
      {
        thread_id: members[0]!.thread_id,
        display_name: "Member 000",
        updated_at: "2026-10-09T00:00:00Z",
        files: Array.from({ length: 201 }, (_, i) => ({
          kind: "output",
          name: `file-${String(i).padStart(3, "0")}.txt`,
          size_bytes: 1,
          modified_at: "2026-10-09T00:00:00Z",
          artifact_url: "/artifact",
        })),
      },
    ],
  });
  await page.goto(`/workspace/projects/${PROJECT_ID}`);
  const nextPage = page.waitForResponse(
    (r) =>
      r.url().includes(`/projects/${PROJECT_ID}/threads?`) &&
      new URL(r.url()).searchParams.get("offset") === "100",
  );
  await page.getByTestId("project-threads-load-more").click();
  expect(await (await nextPage).json()).toHaveLength(20);
  await expect(page.getByTestId("project-threads-load-more")).toHaveCount(0);
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await expect(page.getByTestId("thread-files-truncated")).toContainText(
    "Only the first 200 files of this chat are shown.",
  );
  await expect(
    page
      .getByTestId("project-thread-files")
      .getByText("file-200.txt", { exact: true }),
  ).toHaveCount(0);
  const nextFiles = page.waitForResponse(
    (r) =>
      r.url().includes(`/projects/${PROJECT_ID}/thread-files?`) &&
      new URL(r.url()).searchParams.get("offset") === "20",
  );
  await page.getByTestId("project-thread-files-load-more").click();
  expect(await (await nextFiles).json()).toMatchObject({
    next_offset: 40,
    groups: expect.any(Array),
  });
});

test("read/write/delete denials never optimistically remove shelf or trash data", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    ...seedProject(),
    projectDocuments: [
      {
        id: "protected",
        project_id: PROJECT_ID,
        name: "protected.txt",
        size_bytes: 4,
        content: "safe",
      },
    ],
  });
  let readDenied = true;
  await page.route(`**/api/projects/${PROJECT_ID}/documents*`, (route) => {
    const method = route.request().method();
    if (method === "GET" && readDenied)
      return route.fulfill({
        status: 403,
        json: { detail: "Permission denied: projects:read" },
      });
    if (method === "POST")
      return route.fulfill({
        status: 403,
        json: { detail: "Permission denied: projects:write" },
      });
    return route.fallback();
  });
  await page.route(
    `**/api/projects/${PROJECT_ID}/documents/protected`,
    (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({
            status: 403,
            json: { detail: "Permission denied: projects:delete" },
          })
        : route.fallback(),
  );
  await openDocumentsTab(page);
  await expect(
    page.getByText("Couldn't load project documents", { exact: true }),
  ).toBeVisible();
  readDenied = false;
  await page
    .getByRole("button", { name: "Try again", exact: true })
    .first()
    .click();
  await expect(page.getByText("protected.txt", { exact: true })).toBeVisible();
  await page.getByTestId("project-documents-upload-input").setInputFiles({
    name: "denied.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("no"),
  });
  await expect(
    page.getByText("Permission denied: projects:write", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("denied.txt", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await expect(
    page.getByText("Permission denied: projects:delete", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("protected.txt", { exact: true })).toBeVisible();
});
