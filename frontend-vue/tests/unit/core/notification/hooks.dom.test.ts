import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "@/composables/useNotifications";
const settings = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/core/settings/store", () => ({
  getBaseSettingsSnapshot: () => ({
    notification: { enabled: settings.enabled },
  }),
}));
let instances: FakeNotification[] = [];
class FakeNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>();
  onclick: (() => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  close = vi.fn();
  constructor(
    public title: string,
    public options?: NotificationOptions,
  ) {
    instances.push(this);
  }
}
function host() {
  let owner!: ReturnType<typeof useNotifications>;
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = useNotifications();
        return () => h("div");
      },
    }),
  );
  return { owner, wrapper };
}
beforeEach(() => {
  instances = [];
  settings.enabled = false;
  FakeNotification.permission = "default";
  FakeNotification.requestPermission.mockReset();
  vi.stubGlobal("Notification", FakeNotification);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("notification browser lifecycle", () => {
  it("requests permission without changing the saved enabled preference", async () => {
    FakeNotification.requestPermission.mockResolvedValue("granted");
    const { owner, wrapper } = host();
    await expect(owner.requestPermission()).resolves.toBe("granted");
    expect(owner.permission.value).toBe("granted");
    expect(settings.enabled).toBe(false);
    owner.showNotification("disabled");
    expect(instances).toHaveLength(0);
    wrapper.unmount();
  });
  it("keeps permission state local and ignores an answer after unmount", async () => {
    let resolve!: (value: NotificationPermission) => void;
    FakeNotification.requestPermission.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const a = host();
    const b = host();
    const request = a.owner.requestPermission();
    a.wrapper.unmount();
    resolve("granted");
    await request;
    expect(a.owner.permission.value).toBe("default");
    expect(b.owner.permission.value).toBe("default");
    b.wrapper.unmount();
  });
  it("rechecks native permission, throttles each owner independently, focuses and closes on click", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    settings.enabled = true;
    FakeNotification.permission = "granted";
    const a = host();
    const b = host();
    const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
    a.owner.showNotification("first", { body: "body" });
    a.owner.showNotification("throttled");
    b.owner.showNotification("other owner");
    expect(instances.map((item) => item.title)).toEqual([
      "first",
      "other owner",
    ]);
    instances[0]!.onclick?.();
    expect(focus).toHaveBeenCalled();
    expect(instances[0]!.close).toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    a.owner.showNotification("next");
    expect(instances).toHaveLength(3);
    FakeNotification.permission = "denied";
    vi.advanceTimersByTime(1000);
    a.owner.showNotification("revoked");
    expect(instances).toHaveLength(3);
    a.wrapper.unmount();
    b.wrapper.unmount();
    focus.mockRestore();
  });
  it("handles unsupported hosts without requesting native permission", async () => {
    vi.stubGlobal("Notification", undefined);
    delete (window as unknown as Record<string, unknown>).Notification;
    const { owner, wrapper } = host();
    expect(owner.supported.value).toBe(false);
    await expect(owner.requestPermission()).resolves.toBe("denied");
    wrapper.unmount();
  });
});
