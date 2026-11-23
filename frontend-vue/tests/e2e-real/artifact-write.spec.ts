import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { artifactEditorInput } from "../support/artifact-editor";

const here = dirname(fileURLToPath(import.meta.url));
const APP = process.env.E2E_APP_URL ?? "http://localhost:3101";
const fixture = JSON.parse(
  readFileSync(
    join(
      here,
      "../../../backend/tests/fixtures/replay/write_read_file.ultra.json",
    ),
    "utf8",
  ),
) as { prompt: string };

function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

async function selectPresentedArtifact(
  page: import("@playwright/test").Page,
  threadId: string,
  path: string,
) {
  await page.evaluate(
    ({ threadId: id, selected }) => {
      const key = `deerflow:artifacts:v1:${encodeURIComponent(`/workspace/chats/${id}`)}`;
      sessionStorage.setItem(
        key,
        JSON.stringify({
          artifacts: [],
          openedPresentedArtifacts: [selected],
          selectedArtifact: selected,
          open: true,
          panelSize: 40,
        }),
      );
    },
    { threadId, selected: path },
  );
  await page.reload();
  await expect(page.locator("#artifacts")).toBeVisible({ timeout: 30_000 });
}

test("real Gateway writes a file that the user can open and edit", async ({
  page,
  context,
}) => {
  const email = `e2e-m5-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const registration = await context.request.post(
    `${APP}/api/v1/auth/register`,
    { data: { email, password: "very-strong-password-123" } },
  );
  expect(registration.status(), await registration.text()).toBe(201);

  await page.addInitScript(() => {
    localStorage.setItem(
      "deerflow.local-settings",
      JSON.stringify({ context: { mode: "ultra" } }),
    );
  });
  await page.goto("/workspace/chats/new");

  const textarea = page.getByPlaceholder(/how can i assist you/i);
  await expect(textarea).toBeVisible({ timeout: 30_000 });
  await textarea.fill(fixture.prompt);
  await textarea.press("Enter");

  // A write that returns before the 100ms pending-selection delay need not
  // open automatically. Open its actual tool step through the public UI;
  // the long-pending stream suite separately verifies live draft auto-open.
  await expect(
    page
      .locator('[data-role="ai"]')
      .getByText("hi from replay.", { exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /^\d+ more steps?$/ }).click();
  await page
    .getByText("Create the requested output file with exact content", {
      exact: true,
    })
    .click();
  const artifacts = page.locator("#artifacts");
  await expect(artifacts).toBeVisible({ timeout: 60_000 });
  await expect(artifacts.getByText("note.txt", { exact: true })).toBeVisible();
  await expect(
    artifacts.getByText("hi from replay.", { exact: true }),
  ).toBeVisible();

  await expect(page).toHaveURL(/\/workspace\/chats\/[0-9a-f-]+$/);

  // The rendered replay answer proves the run started. Wait for its own Stop
  // control to retire before issuing PUT: Gateway rejects saves during a run.
  await expect(page.getByLabel("Stop")).toBeHidden({ timeout: 60_000 });

  const threadId = page.url().split("/").at(-1)!;
  const notePath = "/mnt/user-data/outputs/note.txt";
  const noteUrl = `${APP}/api/threads/${threadId}/artifacts/mnt/user-data/outputs/note.txt`;

  const ranged = await context.request.get(noteUrl, {
    headers: { Range: "bytes=0-1" },
  });
  expect(ranged.status(), await ranged.text()).toBe(206);
  expect(ranged.headers()["content-range"]).toBe("bytes 0-1/15");
  expect(ranged.headers().etag).toBeTruthy();

  const full = await context.request.get(noteUrl);
  const original = await full.text();
  expect(original).toBe("hi from replay.");
  const firstPut = await context.request.put(noteUrl, {
    data: {
      content: "server baseline",
      expected_sha256: sha256(original),
    },
  });
  const firstPutText = await firstPut.text();
  expect(firstPut.status(), firstPutText).toBe(200);
  const firstPutBody = JSON.parse(firstPutText) as {
    path: string;
    sha256: string;
    size: number;
  };
  expect(firstPutBody).toEqual({
    path: notePath,
    sha256: sha256("server baseline"),
    size: 15,
  });

  const browserProbe = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Range: "bytes=0-1048575" },
    });
    const bytes = await response.arrayBuffer();
    return {
      status: response.status,
      contentRange: response.headers.get("content-range"),
      body: new TextDecoder().decode(bytes),
    };
  }, noteUrl);
  expect(browserProbe).toEqual({
    status: 206,
    contentRange: "bytes 0-14/15",
    body: "server baseline",
  });

  const browserLoadPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/artifacts/mnt/user-data/outputs/note.txt"),
  );
  await selectPresentedArtifact(page, threadId, notePath);
  const browserLoad = await browserLoadPromise;
  expect(browserLoad.status()).toBe(206);
  expect(browserLoad.request().headers().range).toBe("bytes=0-1048575");
  expect(await browserLoad.finished()).toBeNull();
  expect(new TextDecoder().decode(await browserLoad.body())).toBe(
    "server baseline",
  );
  const formalPanel = page.locator("#artifacts");
  await expect(
    formalPanel.getByText("server baseline", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await formalPanel.getByLabel("Edit", { exact: true }).click();
  await artifactEditorInput(formalPanel).fill("vue draft survives");

  const concurrentPut = await context.request.put(noteUrl, {
    data: {
      content: "remote winner",
      expected_sha256: firstPutBody.sha256,
    },
  });
  expect(concurrentPut.status(), await concurrentPut.text()).toBe(200);
  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().includes("/artifacts/mnt/user-data/outputs/note.txt"),
  );
  await formalPanel.getByLabel("Save", { exact: true }).click();
  const conflictResponse = await conflictResponsePromise;
  expect(conflictResponse.status()).toBe(412);
  expect(conflictResponse.request().postDataJSON()).toEqual({
    content: "vue draft survives",
    expected_sha256: firstPutBody.sha256,
  });
  await expect(formalPanel.getByRole("alert")).toContainText(
    "Artifact changed since it was opened",
  );
  await expect(artifactEditorInput(formalPanel)).toHaveText(
    "vue draft survives",
  );
  await formalPanel.getByLabel("Discard changes", { exact: true }).click();

  // The Query focus lifecycle reads document visibility. A window focus event
  // alone is not the React/TanStack visibility-restoration contract.
  expect(await page.evaluate(() => document.visibilityState)).toBe("visible");
  const restoredReadPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/artifacts/mnt/user-data/outputs/note.txt"),
  );
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  const restoredRead = await restoredReadPromise;
  expect(restoredRead.status()).toBe(206);
  expect(restoredRead.request().headers().range).toBe("bytes=0-1048575");
  expect(await restoredRead.finished()).toBeNull();
  expect(new TextDecoder().decode(await restoredRead.body())).toBe(
    "remote winner",
  );
  await expect(
    formalPanel.getByText("remote winner", { exact: true }),
  ).toBeVisible();

  const uploads = [
    {
      name: "report.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("PK\u0003\u0004docx"),
    },
    {
      name: "bundle.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\u0003\u0004zip"),
    },
    {
      name: "payload.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0, 1, 2, 3]),
    },
  ];
  for (const file of uploads) {
    const uploaded = await context.request.post(
      `${APP}/api/threads/${threadId}/uploads`,
      { multipart: { files: file } },
    );
    expect(uploaded.status(), await uploaded.text()).toBe(200);
  }

  const artifactGets: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes("/artifacts/")) {
      artifactGets.push(decodeURIComponent(request.url()));
    }
  });
  for (const file of uploads) {
    const path = `/mnt/user-data/uploads/${file.name}`;
    await selectPresentedArtifact(page, threadId, path);
    const policyPanel = page.locator("#artifacts");
    await expect(
      policyPanel.getByTestId("artifact-download-fallback"),
    ).toBeVisible();
    await expect(policyPanel.getByLabel("Edit", { exact: true })).toHaveCount(
      0,
    );
    await expect(policyPanel.getByTestId("artifact-editor")).toHaveCount(0);
    expect(artifactGets.some((url) => url.includes(file.name))).toBe(false);
  }

  const largeHtml = Buffer.from(
    `<!doctype html><html><body>${"x".repeat(1_100_000)}</body></html>`,
  );
  const htmlUpload = await context.request.post(
    `${APP}/api/threads/${threadId}/uploads`,
    {
      multipart: {
        files: {
          name: "large.html",
          mimeType: "text/html",
          buffer: largeHtml,
        },
      },
    },
  );
  expect(htmlUpload.status(), await htmlUpload.text()).toBe(200);
  await selectPresentedArtifact(
    page,
    threadId,
    "/mnt/user-data/uploads/large.html",
  );
  const htmlPanel = page.locator("#artifacts");
  await expect(
    htmlPanel.getByRole("button", { name: "Load full file" }),
  ).toBeVisible();
  await expect(
    htmlPanel.locator("iframe[title='Artifact preview']"),
  ).toHaveCount(0);
  await expect(htmlPanel.getByTestId("artifact-editor")).toHaveCount(0);
});
