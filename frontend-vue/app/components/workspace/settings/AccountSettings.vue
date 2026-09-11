<script setup lang="ts">
/*
  【文件职责】     管理当前用户账号资料与密码。
  【架构位置】     L3
  【主要导出】     默认 AccountSettings 组件
  【依赖关系】     Gateway auth/account APIs
  【边界与注意】   保留 HttpOnly/CSRF 边界，不进入 L2。
*/
import { onMounted, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";

import { LogOut } from "lucide-vue-next";

import SettingsSection from "./SettingsSection.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { performLogout } from "@/core/auth/logout";
import type { User } from "@/core/auth/types";

const { $i18n } = useNuxtApp();
const queryClient = useQueryClient();
const user = ref<User | null>(null);
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const busy = ref(false);
const message = ref("");
const error = ref("");

onMounted(async () => {
  try {
    const response = await fetchWithAuth("/api/v1/auth/me");
    if (response.ok) user.value = (await response.json()) as User;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : $i18n.t.value.settings.account.loadFailed;
  }
});

async function changePassword() {
  error.value = "";
  message.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = $i18n.t.value.settings.account.passwordMismatch;
    return;
  }
  if (newPassword.value.length < 8) {
    error.value = $i18n.t.value.settings.account.passwordTooShort;
    return;
  }
  busy.value = true;
  try {
    const response = await fetchWithAuth("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_password: newPassword.value,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        detail?: string | { message?: string };
      };
      throw new Error(
        typeof body.detail === "string"
          ? body.detail
          : (body.detail?.message ??
              $i18n.t.value.settings.account.changePasswordFailed),
      );
    }
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    message.value = $i18n.t.value.settings.account.passwordChangedSuccess;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : $i18n.t.value.settings.account.changePasswordFailed;
  } finally {
    busy.value = false;
  }
}

/*
  失败也要走得掉：判据与端口说明写在 `core/auth/logout.ts` 的文件头。
  此前这里是 `if (!response.ok) { error = signOutFailed; return; }`——
  「会话坏了 + Gateway 连不上」正是最需要退出的那一刻，那时候人被留在原地。
  `signOutFailed` 仍然会念出来，只是不再拦住退出本身。
*/
async function logout() {
  const outcome = await performLogout({
    post: () => fetchWithAuth("/api/v1/auth/logout", { method: "POST" }),
    navigate: (to) => navigateTo(to),
    hardNavigate: (to) => {
      globalThis.location.href = to;
    },
    queryClient,
  });
  if (outcome === "forced-out") {
    error.value = $i18n.t.value.settings.account.signOutFailed;
  }
}
</script>

<template>
  <div class="space-y-8">
    <SettingsSection :title="$i18n.t.value.settings.account.profileTitle">
      <!--
        资料区是一组 `<span>` 排在两列网格里，不是 `<dl>`（上游
        account-settings-page.tsx:76）。`<dl>` 语义上更贴切，但它在可访问性树里
        会长出 term/definition 节点，而上游那四段是 main 下面的纯文本——两个应用
        读屏器听到的不是同一棵树。照抄上游。
      -->
      <div class="space-y-2">
        <div
          class="grid grid-cols-[max-content_max-content] items-center gap-4"
        >
          <span class="text-muted-foreground text-sm">
            {{ $i18n.t.value.settings.account.email }}
          </span>
          <span class="text-sm font-medium">{{ user?.email ?? "—" }}</span>
          <span class="text-muted-foreground text-sm">
            {{ $i18n.t.value.settings.account.role }}
          </span>
          <span class="text-sm font-medium capitalize">{{
            user?.system_role ?? "—"
          }}</span>
          <template v-if="user?.oauth_provider">
            <span class="text-muted-foreground text-sm">
              {{ $i18n.t.value.settings.account.ssoProvider }}
            </span>
            <span class="text-sm font-medium capitalize">{{
              user.oauth_provider
            }}</span>
          </template>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection
      v-if="!user?.oauth_provider"
      :title="$i18n.t.value.settings.account.changePasswordTitle"
      :description="$i18n.t.value.settings.account.changePasswordDescription"
    >
      <!--
        三个输入框与提交按钮走 shadcn 的 Input / Button primitive，与上游同一个
        （account-settings-page.tsx:107）。本仓原来是手搓的 border + padding，
        可访问名一样，但 focus ring、disabled 态、尺寸档全是另一套。
      -->
      <form class="max-w-sm space-y-3" @submit.prevent="changePassword">
        <Input
          v-model="currentPassword"
          type="password"
          required
          :placeholder="$i18n.t.value.settings.account.currentPassword"
        />
        <Input
          v-model="newPassword"
          type="password"
          required
          minlength="8"
          :placeholder="$i18n.t.value.settings.account.newPassword"
        />
        <Input
          v-model="confirmPassword"
          type="password"
          required
          minlength="8"
          :placeholder="$i18n.t.value.settings.account.confirmNewPassword"
        />
        <p v-if="error" role="alert" class="text-destructive text-sm">
          {{ error }}
        </p>
        <p v-if="message" role="status" class="text-sm text-green-500">
          {{ message }}
        </p>
        <Button type="submit" variant="outline" size="sm" :disabled="busy">
          {{
            busy
              ? $i18n.t.value.settings.account.updating
              : $i18n.t.value.settings.account.updatePassword
          }}
        </Button>
      </form>
    </SettingsSection>
    <SettingsSection
      v-else
      :title="$i18n.t.value.settings.account.changePasswordTitle"
      :description="$i18n.t.value.settings.account.ssoPasswordDescription"
    >
      <p class="text-muted-foreground text-sm">
        {{
          $i18n.t.value.settings.account.ssoPasswordMessage.replace(
            "{provider}",
            user.oauth_provider,
          )
        }}
      </p>
    </SettingsSection>

    <SettingsSection title="" description="">
      <Button variant="destructive" size="sm" class="gap-2" @click="logout">
        <LogOut class="size-4" aria-hidden="true" />
        {{ $i18n.t.value.settings.account.signOut }}
      </Button>
    </SettingsSection>
  </div>
</template>
