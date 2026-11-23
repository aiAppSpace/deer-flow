<!--
  【文件职责】     提供 Gateway 首次初始化与管理员密码设置页面。
  【架构位置】     L3 application page
  【主要导出】     默认 setup page
  【依赖关系】     Gateway auth setup API
  【边界与注意】   保留 CSRF/auth 安全边界；不属于 L2。
-->

<!-- M7 auth setup surface; mirrors the Gateway's initialize/change-password contracts. -->
<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FlickeringGrid from "@/components/ui/effects/FlickeringGrid.vue";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { clearAuthenticatedClientState } from "@/core/auth/client-state";
import { loadRememberLoginPreference } from "@/core/auth/remember-login";
import {
  fetchSetupStatus,
  isSystemAlreadyInitializedError,
} from "@/core/auth/setup";
import { parseAuthError, userSchema, type User } from "@/core/auth/types";

definePageMeta({ layout: "auth" });
const { $i18n } = useNuxtApp();
const queryClient = useQueryClient();
type Mode = "loading" | "init_admin" | "change_password" | "unavailable";

const mode = ref<Mode>("loading");
const setupAttempt = ref(0);
const email = ref("");
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const rememberMe = ref(true);
const error = ref("");
const loading = ref(false);
let currentUser: User | null = null;
let disposed = false;
let modeGeneration = 0;
onScopeDispose(() => {
  disposed = true;
  modeGeneration++;
});

async function loadMode() {
  const generation = ++modeGeneration;
  const current = () => !disposed && generation === modeGeneration;
  mode.value = "loading";
  try {
    const me = await fetch("/api/v1/auth/me", { credentials: "include" });
    if (!current()) return;
    if (me.ok) {
      const parsed = userSchema.safeParse(await me.json());
      if (!current()) return;
      currentUser = parsed.success ? parsed.data : null;
      if (currentUser?.needs_setup) {
        mode.value = "change_password";
        return;
      }
      await navigateTo("/workspace", { replace: true });
      return;
    }
  } catch {
    // setup-status remains the authoritative unauthenticated recovery path.
  }

  if (!current()) return;
  try {
    const status = await fetchSetupStatus();
    if (!current()) return;
    if (status.needs_setup) mode.value = "init_admin";
    else await navigateTo("/login", { replace: true });
  } catch {
    if (current()) mode.value = "unavailable";
  }
}

async function submitInitialize() {
  if (loading.value) return;
  error.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = $i18n.t.value.setup.passwordMismatch;
    return;
  }
  loading.value = true;
  try {
    const response = await fetch("/api/v1/auth/initialize", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        password: newPassword.value,
        remember_me: rememberMe.value,
      }),
    });
    if (disposed) return;
    if (!response.ok) {
      const data: unknown = await response.json();
      if (disposed) return;
      if (isSystemAlreadyInitializedError(data)) {
        await navigateTo("/login", { replace: true });
        return;
      }
      error.value = parseAuthError(data).message;
      return;
    }
    clearAuthenticatedClientState(queryClient);
    await navigateTo("/workspace");
  } catch {
    if (!disposed) error.value = $i18n.t.value.login.networkError;
  } finally {
    if (!disposed) loading.value = false;
  }
}

async function submitPasswordChange() {
  if (loading.value) return;
  error.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = $i18n.t.value.setup.passwordMismatch;
    return;
  }
  if (newPassword.value.length < 8) {
    error.value = $i18n.t.value.setup.passwordTooShort;
    return;
  }
  loading.value = true;
  try {
    const response = await fetchWithAuth("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_password: newPassword.value,
        new_email: email.value || undefined,
        remember_me: rememberMe.value,
      }),
    });
    if (disposed) return;
    if (!response.ok) {
      const data: unknown = await response.json();
      if (disposed) return;
      error.value = parseAuthError(data).message;
      return;
    }
    clearAuthenticatedClientState(queryClient);
    await navigateTo("/workspace");
  } catch {
    if (!disposed) error.value = $i18n.t.value.login.networkError;
  } finally {
    if (!disposed) loading.value = false;
  }
}

watch(setupAttempt, () => void loadMode(), { immediate: true });
onMounted(() => {
  rememberMe.value = loadRememberLoginPreference().rememberMe;
});
</script>

<template>
  <div
    :class="
      mode === 'unavailable'
        ? 'flex min-h-screen items-center justify-center px-4'
        : mode === 'loading'
          ? 'flex min-h-screen items-center justify-center'
          : 'bg-background flex min-h-screen items-center justify-center'
    "
  >
    <FlickeringGrid
      v-if="mode === 'init_admin' || mode === 'change_password'"
      class="absolute inset-0 z-0 mask-[url(/images/deer.svg)] mask-size-[100vw] mask-center mask-no-repeat text-black md:mask-size-[72vh] dark:text-white"
      :square-size="4"
      :grid-gap="4"
      color="currentColor"
      :max-opacity="0.3"
      :flicker-chance="0.25"
    />
    <p v-if="mode === 'loading'" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.common.loading }}
    </p>
    <div
      v-else-if="mode === 'unavailable'"
      class="w-full max-w-md space-y-4 text-center"
    >
      <div>
        <h1 class="text-xl font-semibold">
          {{ $i18n.t.value.login.serviceUnavailableTitle }}
        </h1>
        <p class="text-muted-foreground mt-2 text-sm">
          {{ $i18n.t.value.login.serviceUnavailableDescription }}
        </p>
      </div>
      <div class="flex justify-center gap-3">
        <Button type="button" @click="setupAttempt += 1">{{
          $i18n.t.value.login.retry
        }}</Button>
        <Button
          type="button"
          variant="outline"
          @click="navigateTo('/login', { replace: true })"
          >{{ $i18n.t.value.login.signIn }}</Button
        >
      </div>
    </div>
    <div
      v-else
      class="border-border/20 bg-background/5 w-full max-w-md space-y-6 rounded-3xl border p-8 backdrop-blur-sm"
    >
      <div class="text-center">
        <h1 class="font-serif text-3xl">DeerFlow</h1>
        <p class="text-muted-foreground mt-2">
          {{
            mode === "init_admin"
              ? $i18n.t.value.setup.createAdminTitle
              : $i18n.t.value.setup.completeAdminTitle
          }}
        </p>
        <p class="text-muted-foreground mt-1 text-xs">
          {{
            mode === "init_admin"
              ? $i18n.t.value.setup.createAdminSubtitle
              : $i18n.t.value.setup.completeAdminSubtitle
          }}
        </p>
      </div>
      <form
        v-if="mode === 'init_admin'"
        class="space-y-2"
        @submit.prevent="submitInitialize"
      >
        <div class="flex flex-col space-y-1">
          <label class="text-sm font-medium" for="setup-email">{{
            $i18n.t.value.login.email
          }}</label>
          <Input
            id="setup-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            :placeholder="$i18n.t.value.login.emailPlaceholder"
          />
        </div>
        <div class="flex flex-col space-y-1">
          <label class="text-sm font-medium" for="new-password">{{
            $i18n.t.value.setup.password
          }}</label>
          <Input
            id="new-password"
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            required
            :minlength="8"
            :placeholder="$i18n.t.value.setup.passwordPlaceholder"
          />
        </div>
        <div class="flex flex-col space-y-1">
          <label class="text-sm font-medium" for="confirm-password">{{
            $i18n.t.value.setup.confirmPassword
          }}</label>
          <Input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            :minlength="8"
            :placeholder="$i18n.t.value.setup.confirmPasswordPlaceholder"
          />
        </div>
        <label class="text-muted-foreground flex items-start gap-2 text-sm">
          <input
            v-model="rememberMe"
            type="checkbox"
            class="border-input mt-1 h-4 w-4 rounded"
          />
          <span
            ><span class="text-foreground block font-medium">{{
              $i18n.t.value.login.rememberMe
            }}</span
            ><span>{{ $i18n.t.value.login.rememberMeDescription }}</span></span
          >
        </label>
        <p v-if="error" role="alert" class="text-destructive ms-1 text-sm">
          {{ error }}
        </p>
        <Button type="submit" class="w-full" :disabled="loading">{{
          loading
            ? $i18n.t.value.setup.creatingAdmin
            : $i18n.t.value.setup.createAdmin
        }}</Button>
      </form>
      <form v-else class="space-y-4" @submit.prevent="submitPasswordChange">
        <Input
          v-model="email"
          type="email"
          required
          :placeholder="$i18n.t.value.setup.emailPlaceholder"
          :aria-label="$i18n.t.value.setup.emailPlaceholder"
          autocomplete="email"
        />
        <Input
          v-model="currentPassword"
          type="password"
          required
          :placeholder="$i18n.t.value.setup.currentPassword"
          :aria-label="$i18n.t.value.setup.currentPassword"
          autocomplete="current-password"
        />
        <Input
          v-model="newPassword"
          type="password"
          required
          :minlength="8"
          :placeholder="$i18n.t.value.setup.newPassword"
          :aria-label="$i18n.t.value.setup.newPassword"
          autocomplete="new-password"
        />
        <Input
          v-model="confirmPassword"
          type="password"
          required
          :minlength="8"
          :placeholder="$i18n.t.value.setup.confirmNewPassword"
          :aria-label="$i18n.t.value.setup.confirmNewPassword"
          autocomplete="new-password"
        />
        <label class="text-muted-foreground flex items-start gap-2 text-sm">
          <input
            v-model="rememberMe"
            type="checkbox"
            class="border-input mt-1 h-4 w-4 rounded"
          />
          <span
            ><span class="text-foreground block font-medium">{{
              $i18n.t.value.login.rememberMe
            }}</span
            ><span>{{ $i18n.t.value.login.rememberMeDescription }}</span></span
          >
        </label>
        <p v-if="error" role="alert" class="text-destructive text-sm">
          {{ error }}
        </p>
        <Button type="submit" class="w-full" :disabled="loading">{{
          loading
            ? $i18n.t.value.setup.settingUp
            : $i18n.t.value.setup.completeSetup
        }}</Button>
      </form>
    </div>
  </div>
</template>
