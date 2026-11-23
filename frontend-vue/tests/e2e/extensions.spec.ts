import { expect, test } from "@playwright/test";
import { mockLangGraphAPI } from "./utils/mock-api";

const revision = "a".repeat(64);
const namespace = "community.bookmarks";
const moduleName = "bookmarks.v1";
const assetRoot = `/api/plugins/${namespace}/assets/${revision}/static/dist`;
const inlineEntry = `/api/plugins/modules/${moduleName}/${revision}.mjs`;
function contribution(transport: "inline-v1" | "assets-v1") {
  return {
    namespace,
    viewer_id: "default",
    module: moduleName,
    transport,
    entry: transport === "assets-v1" ? `${assetRoot}/index.mjs` : inlineEntry,
    title: "Bookmarks",
    description: "Browser extension fixture",
    settings: { enabled: true },
    backend_actions: ["save"],
  };
}
const declaration = `
export default {
  apiVersion: 1, module: ${JSON.stringify(moduleName)},
  surfaces: [{ id: "library", slot: "page", title: "Library", navigation: {label: "Bookmarks", labelZh: "书签", icon: "bookmark"},
    mount(root, context) {
      const heading = document.createElement("h2");
      heading.textContent = label;
      const image = document.createElement("img");
      image.alt = "Packaged badge";
      image.src = imageURL;
      root.append(heading, image);
      return { dispose() { window.__pluginDisposed = (window.__pluginDisposed || 0) + 1; } };
    }
  }]
};`;

test("assets-v1 mounts the native relative chunk/resource graph and disposes when leaving the page", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  const assets = new Set<string>();
  await page.route(/\/api\/plugins$/, (route) =>
    route.fulfill({ json: [contribution("assets-v1")] }),
  );
  await page.route(`**${assetRoot}/*`, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    assets.add(pathname);
    if (pathname.endsWith("/index.mjs"))
      return route.fulfill({
        contentType: "text/javascript",
        body: `import { label } from "./chunk.mjs"; const imageURL = new URL("./badge.svg", import.meta.url).href; ${declaration}`,
      });
    if (pathname.endsWith("/chunk.mjs"))
      return route.fulfill({
        contentType: "text/javascript",
        body: 'export const label = "Relative chunk loaded";',
      });
    if (pathname.endsWith("/badge.svg"))
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="green"/></svg>',
      });
    return route.fulfill({ status: 404 });
  });
  await page.goto(`/workspace/extensions/${namespace}/library`);
  await expect(
    page.getByRole("heading", { name: "Bookmarks", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Relative chunk loaded" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Packaged badge" }),
  ).toHaveAttribute("src", new URL(`${assetRoot}/badge.svg`, page.url()).href);
  await expect
    .poll(() => [...assets].sort())
    .toEqual(
      [
        `${assetRoot}/badge.svg`,
        `${assetRoot}/chunk.mjs`,
        `${assetRoot}/index.mjs`,
      ].sort(),
    );
  await page.setViewportSize({ width: 390, height: 844 });
  const desktopState = (await page.context().cookies()).find(
    (cookie) => cookie.name === "sidebar_state",
  )?.value;
  const trigger = page.getByRole("button", {
    name: "Toggle Sidebar",
    exact: true,
  });
  await expect(trigger.locator("svg")).toHaveClass(/lucide-panel-left-open/);
  await trigger.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await expect(drawer).toBeVisible();
  const close = drawer.getByRole("button", {
    name: "Toggle Sidebar",
    exact: true,
  });
  await expect(close.locator("svg")).toHaveClass(/lucide-panel-left-close/);
  await close.press("Enter");
  await expect(drawer).toBeHidden();
  await expect(trigger.locator("svg")).toHaveClass(/lucide-panel-left-open/);
  await trigger.focus();
  await expect(trigger).toBeFocused();
  expect(
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "sidebar_state",
    )?.value,
  ).toBe(desktopState);
  expect(
    await page.evaluate(() => Reflect.get(window, "__pluginDisposed") ?? 0),
  ).toBe(0);
  await trigger.press("Enter");
  await expect(drawer).toBeVisible();
  await page
    .getByRole("link", { name: "Capability Center", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspace\/capabilities/);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__pluginDisposed")))
    .toBe(1);
});

test("inline-v1 mounts through the Blob loader and unknown surfaces retain reload and capabilities recovery", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  await page.route(/\/api\/plugins$/, (route) =>
    route.fulfill({ json: [contribution("inline-v1")] }),
  );
  await page.route(`**${inlineEntry}`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `const label = "Inline module loaded"; const imageURL = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"; ${declaration}`,
    }),
  );
  await page.goto(`/workspace/extensions/${namespace}/library`);
  await expect(
    page.getByRole("heading", { name: "Inline module loaded" }),
  ).toBeVisible();
  await page.goto(`/workspace/extensions/${namespace}/missing`);
  await expect(
    page.getByRole("heading", { name: "Extension page unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  await page.getByRole("link", { name: "View extensions" }).click();
  await expect(page).toHaveURL(/\/workspace\/capabilities\?tab=extensions/);
});

test("a missing installed asset leaves the workspace usable and offers reload", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  await page.route(/\/api\/plugins$/, (route) =>
    route.fulfill({ json: [contribution("assets-v1")] }),
  );
  await page.route(`**${assetRoot}/index.mjs`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      json: { detail: "Plugin asset unavailable; reload the page." },
    }),
  );
  await page.goto(`/workspace/extensions/${namespace}/library`);
  await expect(
    page.getByRole("heading", { name: "Extension page unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Capability Center", exact: true }),
  ).toBeVisible();
});
