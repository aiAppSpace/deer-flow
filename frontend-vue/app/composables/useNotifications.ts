/*
  【文件职责】     管理浏览器通知权限和页面可见性下的通知发送。
  【架构位置】     L3 Vue adapter
  【主要导出】     useNotifications
  【依赖关系】     browser Notification API · Vue lifecycle
  【边界与注意】   N2 宿主能力，不属于 L2 公共集合。
*/

import { onMounted, readonly, ref } from "vue";

import {
  getBaseSettingsSnapshot,
  updateLocalSettings,
} from "@/core/settings/store";

const permission = ref<NotificationPermission>("default");
const supported = ref(false);
let lastNotificationTime: number | null = null;

function syncSupport() {
  supported.value = typeof window !== "undefined" && "Notification" in window;
  if (supported.value) permission.value = Notification.permission;
}

export function useNotifications() {
  onMounted(syncSupport);

  async function requestPermission() {
    syncSupport();
    if (!supported.value) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    permission.value = result;
    if (result === "granted") {
      updateLocalSettings("notification", { enabled: true });
    }
    return result;
  }

  function showNotification(title: string, options?: NotificationOptions) {
    syncSupport();
    if (!supported.value || !getBaseSettingsSnapshot().notification.enabled)
      return;
    permission.value = Notification.permission;
    if (permission.value !== "granted") return;
    const now = Date.now();
    if (lastNotificationTime !== null && now - lastNotificationTime < 1000)
      return;
    lastNotificationTime = now;
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    // 上游 `core/notification/hooks.ts` 也挂了这一条。通知失败是宿主行为
    // （权限被撤、系统通知中心拒收），页面上看不见，不记就彻底没有痕迹。
    notification.onerror = (error) => {
      console.error("Notification error:", error);
    };
  }

  return {
    permission: readonly(permission),
    supported: readonly(supported),
    requestPermission,
    showNotification,
  };
}
