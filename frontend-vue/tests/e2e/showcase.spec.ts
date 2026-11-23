import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DEMO_THREAD_IDS, STATIC_DEMO_ARTIFACTS } from "../../shared/showcase";
import { mockLangGraphAPI } from "./utils/mock-api";
const publicRoot = join(import.meta.dirname, "../../public/demo/threads");
const digest = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");
for (const id of DEMO_THREAD_IDS) {
  test(`public showcase ${id} preserves original resources and stays readonly`, async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        /\/api\//.test(request.url()) &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
      )
        writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });
    const response = await page.goto(`/showcase/${id}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("main-message-list")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toBeDisabled();
    await expect(page.locator("[data-sidebar='sidebar']")).toHaveCount(0);
    await expect(page.getByTestId("browser-trigger")).toHaveCount(0);
    const original = await page.request.get(`/demo/threads/${id}/thread.json`);
    expect(original.status()).toBe(200);
    expect(digest(await original.body())).toBe(
      digest(readFileSync(join(publicRoot, id, "thread.json"))),
    );
    for (const path of STATIC_DEMO_ARTIFACTS[id] ?? []) {
      const artifact = await page.request.get(
        `/mock/api/threads/${id}/artifacts/mnt/${path}`,
      );
      expect(artifact.status(), path).toBe(200);
      expect(digest(await artifact.body()), path).toBe(
        digest(readFileSync(join(publicRoot, id, path))),
      );
    }
    expect(writes).toEqual([]);
  });
}
test("unknown public case and unregistered artifact return 404", async ({
  request,
}) => {
  expect((await request.get("/showcase/not-a-public-demo")).status()).toBe(404);
  expect(
    (
      await request.get(
        `/mock/api/threads/${DEMO_THREAD_IDS[0]}/artifacts/mnt/user-data/outputs/not-registered.html`,
      )
    ).status(),
  ).toBe(404);
});
