import { flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  manifest: vi.fn(),
  download: vi.fn(),
  handoff: vi.fn(),
}));
vi.mock("@/core/skills/export", async () => ({
  ...(await vi.importActual<typeof import("@/core/skills/export")>(
    "@/core/skills/export",
  )),
  loadSkillExportManifest: mock.manifest,
  downloadSkillExport: mock.download,
  handOffSkillDownload: mock.handoff,
}));
import SkillExportDialog from "@/components/workspace/capabilities/SkillExportDialog.vue";
import {
  SkillExportRequestError,
  type SkillExportManifest,
} from "@/core/skills/export";
import { enUS } from "@/core/i18n/locales/en-US";
const text = enUS.settings.skills;
const clean = (): SkillExportManifest => ({
  skill_name: "review",
  revision: "r1",
  can_export: true,
  file_count: 52,
  directory_count: 1,
  total_bytes: 2048,
  files: Array.from({ length: 52 }, (_, index) => ({
    path: `file-${index}`,
    type: "file",
    size: 10,
    executable: false,
  })),
  requirements: {
    compatibility: null,
    allowed_tools: [],
    required_secrets: [{ name: "MY_KEY", optional: true }],
  },
  warnings: [
    { code: "unknown", message: "<script>unsafe</script>", path: "example" },
  ],
  blockers: [],
});
const wrappers: ReturnType<typeof mount>[] = [];
function setup() {
  const w = mount(SkillExportDialog, {
    props: { name: "review" },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
  });
  wrappers.push(w);
  return w;
}
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
}
beforeEach(() => {
  mock.manifest.mockReset().mockResolvedValue(clean());
  mock.download.mockReset().mockResolvedValue(new Blob(["zip"]));
  mock.handoff.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
describe("skill export preview", () => {
  it("requires explicit preview refresh after revision409 and never retries a stale download", async () => {
    mock.download.mockRejectedValueOnce(
      new SkillExportRequestError(409, "changed", "changed"),
    );
    setup();
    await flushPromises();
    button(text.exportDownload).click();
    await flushPromises();
    expect(document.body.textContent).toContain(text.exportChanged);
    expect(button(text.exportDownload).disabled).toBe(true);
    expect(mock.manifest).toHaveBeenCalledTimes(1);
    expect(mock.download).toHaveBeenCalledTimes(1);
    button(text.exportDownload).click();
    await flushPromises();
    expect(mock.download).toHaveBeenCalledTimes(1);
    mock.manifest.mockResolvedValueOnce({ ...clean(), revision: "r2" });
    button(text.exportRefresh).click();
    await flushPromises();
    expect(button(text.exportDownload).disabled).toBe(false);
    button(text.exportDownload).click();
    await flushPromises();
    expect(mock.download.mock.calls.at(-1)?.slice(0, 2)).toEqual([
      "review",
      "r2",
    ]);
    expect(mock.handoff).toHaveBeenCalledOnce();
  });
  it("shows bounded file pages, declared requirements and inert security notices", async () => {
    setup();
    await flushPromises();
    expect(document.querySelectorAll("details li")).toHaveLength(50);
    expect(document.body.textContent).toContain(text.exportUndeclared);
    expect(document.body.textContent).toContain(text.exportNone);
    expect(document.body.textContent).toContain(
      `MY_KEY (${text.exportOptional})`,
    );
    expect(document.querySelector("script")).toBeNull();
    button(text.exportMore).click();
    await flushPromises();
    expect(document.querySelectorAll("details li")).toHaveLength(2);
    button(text.exportPrevious).click();
    await flushPromises();
    expect(document.querySelectorAll("details li")).toHaveLength(50);
  });
  it("aborts on close and ignores a late download without creating a browser URL", async () => {
    let release!: (blob: Blob) => void;
    mock.download.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          release = resolve;
        }),
    );
    const wrapper = setup();
    await flushPromises();
    button(text.exportDownload).click();
    await flushPromises();
    const signal = mock.download.mock.calls[0]![2] as AbortSignal;
    button(enUS.common.close).click();
    expect(signal.aborted).toBe(true);
    expect(wrapper.emitted("close")).toHaveLength(1);
    release(new Blob(["late"]));
    await flushPromises();
    expect(mock.handoff).not.toHaveBeenCalled();
  });
  it("keeps blocked manifests from offering a download and offers a user refresh", async () => {
    mock.manifest.mockResolvedValueOnce({
      ...clean(),
      can_export: false,
      revision: null,
      blockers: [
        { code: "unknown", message: "unsafe path", path: "../escape" },
      ],
    });
    setup();
    await flushPromises();
    expect(button(text.exportDownload)).toBeUndefined();
    expect(button(text.exportRefresh)).toBeTruthy();
    expect(document.body.textContent).toContain("../escape: unsafe path");
  });
});
