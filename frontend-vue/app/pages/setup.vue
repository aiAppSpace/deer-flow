<!--
  【文件职责】     提供 Gateway 首次初始化与管理员密码设置页面。
  【架构位置】     L3 application page
  【主要导出】     默认 setup page
  【依赖关系】     Gateway auth setup API
  【边界与注意】   保留 CSRF/auth 安全边界；不属于 L2。
-->

<!-- M7 auth setup surface; mirrors the Gateway's initialize/change-password contracts. -->
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
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

async function loadMode() {
  mode.value = "loading";
  try {
    const me = await fetch("/api/v1/auth/me", { credentials: "include" });
    if (me.ok) {
      const parsed = userSchema.safeParse(await me.json());
      currentUser = parsed.success ? parsed.data : null;
      if (currentUser?.needs_setup) {
        email.value = currentUser.email;
        mode.value = "change_password";
        return;
      }
      await navigateTo("/workspace", { replace: true });
      return;
    }
  } catch {
    // setup-status remains the authoritative unauthenticated recovery path.
  }

  try {
    const status = await fetchSetupStatus();
    if (status.needs_setup) mode.value = "init_admin";
    else await navigateTo("/login", { replace: true });
  } catch {
    mode.value = "unavailable";
  }
}

async function submitInitialize() {
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
    if (!response.ok) {
      const data: unknown = await response.json();
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
    error.value = $i18n.t.value.login.networkError;
  } finally {
    loading.value = false;
  }
}

async function submitPasswordChange() {
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
    if (!response.ok) {
      error.value = parseAuthError(await response.json()).message;
      return;
    }
    clearAuthenticatedClientState(queryClient);
    await navigateTo("/workspace");
  } catch {
    error.value = $i18n.t.value.login.networkError;
  } finally {
    loading.value = false;
  }
}

watch(setupAttempt, () => void loadMode(), { immediate: true });
onMounted(() => {
  rememberMe.value = loadRememberLoginPreference().rememberMe;
});
</script>

<template>
  <div
    class="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4"
  >
    <FlickeringGrid
      class="absolute inset-0 z-0 text-black opacity-35 [mask:url('/images/deer.svg')_center/100vw_no-repeat] md:[mask-size:72vh] dark:text-white"
      :square-size="4"
      :grid-gap="4"
      color="currentColor"
      :max-opacity="0.3"
      :flicker-chance="0.25"
    />
    <p v-if="mode === 'loading'" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.common.loading }}
    </p>
    <section
      v-else-if="mode === 'unavailable'"
      class="relative z-10 w-full max-w-md space-y-4 text-center"
    >
      <h1 class="text-xl font-semibold">
        {{ $i18n.t.value.login.serviceUnavailableTitle }}
      </h1>
      <p class="text-muted-foreground text-sm">
        {{ $i18n.t.value.login.serviceUnavailableDescription }}
      </p>
      <div class="flex justify-center gap-3">
        <!--
          上游 `(auth)/setup/page.tsx:187` 是裸 `<Button>`（default 变体、default
          尺寸）。手写那版只抄了填色：少 `hover:bg-primary/90`（悬停时完全没反应）、
          少 `cursor-pointer`、少 3px 焦点环、少 `h-9`（`px-4 py-2` 算出来的高度
          与上游的 36px 不一样）、也少 `disabled:*`。
        -->
        <Button type="button" @click="setupAttempt += 1">
          {{ $i18n.t.value.login.retry }}
        </Button>
        <!--
          按钮而不是链接，且走 replace。React 这里是
          `<Button onClick={() => router.replace("/login")}>`（setup/page.tsx 的
          gateway-unavailable 分支）。三处可观察差异都由此而来：role 决定读屏怎么
          播报、以及空格键是否触发；replace 决定点完之后「后退」回到哪里——push
          会把这个不可用页留在历史里，用户后退又撞回来；链接还多出右键、中键和
          新标签页打开这些按钮没有的能力。
        -->
        <Button
          type="button"
          variant="outline"
          @click="navigateTo('/login', { replace: true })"
        >
          {{ $i18n.t.value.login.signIn }}
        </Button>
      </div>
    </section>
    <section
      v-else
      class="bg-background/90 border-border/50 relative z-10 w-full max-w-md space-y-6 rounded-3xl border p-8 shadow-xl backdrop-blur-sm"
    >
      <header class="text-center">
        <h1 class="font-serif text-3xl">DeerFlow</h1>
        <p class="text-muted-foreground mt-2">
          {{
            mode === "init_admin"
              ? $i18n.t.value.setup.createAdminTitle
              : $i18n.t.value.setup.completeAdminTitle
          }}
        </p>
        <!--
          上游 `(auth)/setup/page.tsx:225` 在标题下面还有一行小字副标题
          （`text-muted-foreground mt-1 text-xs`）。本仓一直没有——
          wave 194 让这一屏第一次进取样面才照出来。
        -->
        <p
          v-if="mode === 'init_admin'"
          class="text-muted-foreground mt-1 text-xs"
        >
          {{ $i18n.t.value.setup.createAdminSubtitle }}
        </p>
      </header>
      <!--
        **表单里的每一个控件都走 primitive，不手写 class。**

        这与 login.vue 是同一条纪律，而那一页 wave 68 就修过了、这一页漏了
        ——因为 `/setup` 直到 wave 194 才第一次进取样面，这个缺口挂了 126 轮。
        实测读数与当年一模一样：裸 `<input class="… px-3 py-2">` 是 h 42 / 字号 16px，
        上游的 `<Input>` 是 `h-9` + `md:text-sm` → **h 36 / 14px**。
        绕过 primitive 丢掉的不只是尺寸——焦点环、`aria-invalid` 态、深色模式、
        禁用态全都不再跟着 L2 走。

        字段分组 `flex flex-col space-y-1` 与 form 的 `space-y-2` 也照上游
        （frontend/src/app/(auth)/setup/page.tsx:229）。
      -->
      <form
        class="space-y-2"
        @submit.prevent="
          mode === 'init_admin' ? submitInitialize() : submitPasswordChange()
        "
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
        <div v-if="mode === 'change_password'" class="flex flex-col space-y-1">
          <label class="text-sm font-medium" for="current-password">{{
            $i18n.t.value.setup.currentPassword
          }}</label>
          <Input
            id="current-password"
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
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
        <!--
          与上游 RememberSessionOption 逐字同构
          （frontend/src/components/auth/remember-session-option.tsx:17），
          与 login.vue 那一处同一份写法。本仓这里此前只有一行光秃秃的
          「保持登录」，说明整句都没有——读屏器听到的可访问名因此也短了一整句。
        -->
        <label class="text-muted-foreground flex items-start gap-2 text-sm">
          <input
            v-model="rememberMe"
            type="checkbox"
            class="border-input mt-1 h-4 w-4 rounded"
          />
          <span>
            <span class="text-foreground block font-medium">{{
              $i18n.t.value.login.rememberMe
            }}</span>
            <span>{{ $i18n.t.value.login.rememberMeDescription }}</span>
          </span>
        </label>
        <p v-if="error" role="alert" class="text-destructive text-sm">
          {{ error }}
        </p>
        <!-- 上游 `(auth)/setup/page.tsx:276` 是 `<Button type="submit" className="w-full">`。 -->
        <Button type="submit" class="w-full" :disabled="loading">
          {{
            loading
              ? $i18n.t.value.login.pleaseWait
              : mode === "init_admin"
                ? $i18n.t.value.setup.createAdmin
                : $i18n.t.value.setup.completeSetup
          }}
        </Button>
      </form>
    </section>
  </div>
</template>
