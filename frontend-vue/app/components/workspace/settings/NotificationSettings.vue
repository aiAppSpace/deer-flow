<script setup lang="ts">
/*
  【文件职责】     管理浏览器通知权限与本地偏好。
  【架构位置】     L3
  【主要导出】     默认 NotificationSettings 组件
  【依赖关系】     useNotifications · settings store · ui/switch
  【边界与注意】   N2 产品接线，不属于 L2。
*/
import { onBeforeUnmount, ref } from "vue";

import { Bell } from "lucide-vue-next";

import SettingsSection from "./SettingsSection.vue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/composables/useNotifications";
import {
  getBaseSettingsSnapshot,
  subscribe,
  updateLocalSettings,
} from "@/core/settings/store";

const notifications = useNotifications();
const { $i18n } = useNuxtApp();
const enabled = ref(getBaseSettingsSnapshot().notification.enabled);
const unsubscribe = subscribe(() => {
  enabled.value = getBaseSettingsSnapshot().notification.enabled;
});

onBeforeUnmount(unsubscribe);

async function requestPermission() {
  await notifications.requestPermission();
}

function toggle(next: boolean) {
  enabled.value = next;
  updateLocalSettings("notification", {
    enabled: enabled.value,
  });
}

function sendTestNotification() {
  notifications.showNotification(
    $i18n.t.value.settings.notification.testTitle,
    { body: $i18n.t.value.settings.notification.testBody },
  );
}
</script>

<template>
  <SettingsSection
    v-if="!notifications.supported.value"
    :title="$i18n.t.value.settings.notification.title"
    :description="$i18n.t.value.settings.notification.description"
  >
    <p class="text-muted-foreground text-sm">
      {{ $i18n.t.value.settings.notification.notSupported }}
    </p>
  </SettingsSection>
  <SettingsSection v-else :title="$i18n.t.value.settings.notification.title">
    <template #description>
      <div class="flex flex-wrap items-center gap-2">
        <div>{{ $i18n.t.value.settings.notification.description }}</div>
        <div>
          <Switch
            :aria-label="$i18n.t.value.settings.notification.title"
            :model-value="
              notifications.permission.value === 'granted' && enabled
            "
            :disabled="notifications.permission.value !== 'granted'"
            @update:model-value="toggle"
          />
        </div>
      </div>
    </template>
    <div class="flex flex-col gap-4">
      <!--
        两颗都带一颗 `BellIcon`（上游 notification-settings-page.tsx:71 / 85，
        `className="mr-2 size-4"`）。手写那两版**一颗图标都没有**，而且各自只抄了
        变体的填色：请求权限那颗少 `hover:bg-primary/90`，测试那颗少
        `hover:bg-accent hover:text-accent-foreground` 与三条 `dark:*`；
        两颗都少 `cursor-pointer`、3px 焦点环、`h-9` 与 `disabled:*`。
      -->
      <Button
        v-if="notifications.permission.value === 'default'"
        class="h-auto max-w-full min-w-0 whitespace-normal max-[361px]:w-full"
        type="button"
        @click="requestPermission"
      >
        <Bell class="mr-2 size-4" />
        {{ $i18n.t.value.settings.notification.requestPermission }}
      </Button>
      <!--
        权限被拒那条提示上游是有底色的（`bg-amber-50` + `dark:bg-amber-950/50`），
        文字走 `text-muted-foreground`，边框是 amber-200/amber-800。本仓原来只有
        一条 amber-300 描边、没有底色也没有深色分支——深色主题下它和普通段落
        长得一样，用户看不出这是一条警告。
      -->
      <p
        v-if="notifications.permission.value === 'denied'"
        class="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/50"
      >
        {{ $i18n.t.value.settings.notification.deniedHint }}
      </p>
      <div
        v-if="notifications.permission.value === 'granted' && enabled"
        class="flex flex-col gap-4"
      >
        <Button
          class="h-auto max-w-full min-w-0 whitespace-normal max-[361px]:w-full"
          type="button"
          variant="outline"
          @click="sendTestNotification"
        >
          <Bell class="mr-2 size-4" />
          {{ $i18n.t.value.settings.notification.testButton }}
        </Button>
      </div>
    </div>
  </SettingsSection>
</template>
