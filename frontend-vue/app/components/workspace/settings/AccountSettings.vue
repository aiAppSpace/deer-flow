<script setup lang="ts">
/*
  【文件职责】     管理当前用户账号资料与密码。
  【架构位置】     L3
  【主要导出】     默认 AccountSettings 组件
  【依赖关系】     Gateway auth/account APIs
  【边界与注意】   保留 HttpOnly/CSRF 边界，不进入 L2。
*/
import { computed, onScopeDispose, ref, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";

import { LogOut } from "lucide-vue-next";

import SettingsSection from "./SettingsSection.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { performLogout } from "@/core/auth/logout";
import { AUTH_DISABLED_USER } from "@/core/auth/auth-disabled-user";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";
import { parseAuthError } from "@/core/auth/types";

const { $i18n } = useNuxtApp();
const queryClient = useQueryClient();
const captureOwner = useWorkspaceAsyncOwner();
const { session, authDisabled } = useSettingsPermissions();
const user = computed(() =>
  session.value?.tag === "authenticated"
    ? session.value.user
    : authDisabled
      ? AUTH_DISABLED_USER
      : null,
);
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const busy = ref(false);
const message = ref("");
const error = ref("");
let passwordRequest: AbortController | undefined;
function clearPassword() {
  passwordRequest?.abort();
  passwordRequest = undefined;
  currentPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  busy.value = false;
  error.value = "";
  message.value = "";
}
watch(() => user.value?.id, clearPassword, { flush: "sync" });
onScopeDispose(clearPassword);

async function changePassword() {
  if (busy.value || user.value?.oauth_provider) return;
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
  const controller = new AbortController();
  passwordRequest = controller;
  const ownsPage = captureOwner();
  const isCurrent = () => ownsPage() && !controller.signal.aborted;
  try {
    const response = await fetchWithAuth("/api/v1/auth/change-password", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_password: newPassword.value,
      }),
    });
    if (!isCurrent()) return;
    if (!response.ok) {
      const body: unknown = await response.json();
      if (isCurrent()) error.value = parseAuthError(body).message;
      return;
    }
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    message.value = $i18n.t.value.settings.account.passwordChangedSuccess;
  } catch {
    if (isCurrent()) error.value = $i18n.t.value.settings.account.networkError;
  } finally {
    if (passwordRequest === controller) {
      passwordRequest = undefined;
      if (isCurrent()) busy.value = false;
    }
  }
}

// Shared logout owns state retirement and navigation, including transport failure.
async function logout() {
  clearPassword();
  await performLogout({
    post: () => fetchWithAuth("/api/v1/auth/logout", { method: "POST" }),
    navigate: (to) => navigateTo(to),
    hardNavigate: (to) => {
      globalThis.location.href = to;
    },
    queryClient,
  });
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
