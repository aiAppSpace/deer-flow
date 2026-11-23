import { afterEach, expect, vi, test } from "vitest";

import {
  DEFAULT_LOCAL_SETTINGS,
  LOCAL_SETTINGS_KEY,
  getLocalSettings,
  getThreadModelName,
  saveLocalSettings,
  saveThreadModelName,
} from "@/core/settings/local";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("defaults token usage to header total plus per-turn breakdown", () => {
  expect(DEFAULT_LOCAL_SETTINGS.tokenUsage).toEqual({
    headerTotal: true,
    inlineMode: "per_turn",
  });
});

test("falls back when localStorage access is blocked", () => {
  vi.stubGlobal("window", {
    get localStorage() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });

  expect(getLocalSettings()).toEqual(DEFAULT_LOCAL_SETTINGS);
  expect(getThreadModelName("thread-1")).toBeUndefined();
  expect(() => saveLocalSettings(DEFAULT_LOCAL_SETTINGS)).not.toThrow();
  expect(() => saveThreadModelName("thread-1", "model-1")).not.toThrow();
});

function storageWith(value: unknown) {
  const entries = new Map([[LOCAL_SETTINGS_KEY, JSON.stringify(value)]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    },
  });
  return entries;
}

test.each(["flat", "grouped"] as const)(
  "reads React's persisted %s project view",
  (displayMode) => {
    storageWith({ projectsDisplayMode: displayMode });
    expect(getLocalSettings().projects.displayMode).toBe(displayMode);
  },
);

test("writes project display mode using the shared React storage shape", () => {
  const entries = storageWith({ notification: { enabled: false } });
  saveLocalSettings({
    ...getLocalSettings(),
    projects: { displayMode: "grouped" },
  });
  const saved = JSON.parse(entries.get(LOCAL_SETTINGS_KEY)!);
  expect(saved.projectsDisplayMode).toBe("grouped");
  expect(saved).not.toHaveProperty("projects");
  expect(saved.notification.enabled).toBe(false);
});

test("retains a legacy Vue project preference until the next ordinary save migrates it", () => {
  const entries = storageWith({ projects: { displayMode: "grouped" } });
  expect(getLocalSettings().projects.displayMode).toBe("grouped");
  saveLocalSettings(getLocalSettings());
  expect(JSON.parse(entries.get(LOCAL_SETTINGS_KEY)!)).toMatchObject({
    projectsDisplayMode: "grouped",
  });
  expect(JSON.parse(entries.get(LOCAL_SETTINGS_KEY)!)).not.toHaveProperty(
    "projects",
  );
});

test("prefers the canonical React field when both old and canonical values exist", () => {
  storageWith({
    projectsDisplayMode: "flat",
    projects: { displayMode: "grouped" },
  });
  expect(getLocalSettings().projects.displayMode).toBe("flat");
});
