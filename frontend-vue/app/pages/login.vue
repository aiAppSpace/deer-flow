<!--
  【文件职责】     完整本地登录/注册、SSO 入口与 setup-status fail-closed 恢复。
  【架构位置】     L3 auth surface
  【主要导出】     默认 login page
  【依赖关系】     Gateway auth/setup APIs · auth layout
  【边界与注意】   回跳必须经过 resolveAuthNextPath；未知 setup 状态不得开放注册。
-->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";

import { Button } from "@/components/ui/button";
import FlickeringGrid from "@/components/ui/effects/FlickeringGrid.vue";
import { Input } from "@/components/ui/input";
import { clearAuthenticatedClientState } from "@/core/auth/client-state";
import { resolveAuthNextPath } from "@/core/auth/next-path";
import {
  loadRememberLoginPreference,
  saveRememberLoginPreference,
} from "@/core/auth/remember-login";
import {
  canCreateRegularAccount,
  fetchSetupStatus,
  type SetupStatusResponse,
} from "@/core/auth/setup";
import { parseAuthError } from "@/core/auth/types";

definePageMeta({ layout: "auth" });

type Provider = { id: string; display_name: string; type: string };

const route = useRoute();
const { $i18n } = useNuxtApp();
const queryClient = useQueryClient();
const email = ref("");
const password = ref("");
const rememberMe = ref(true);
const isLogin = ref(true);
const providers = ref<Provider[]>([]);
const setupStatus = ref<SetupStatusResponse | null>(null);
const setupPhase = ref<"checking" | "ready" | "unavailable">("checking");
const setupAttempt = ref(0);
const error = ref(
  typeof route.query.error === "string" ? $i18n.t.value.login.authFailed : "",
);
const showSsoHint = ref(false);
const loading = ref(false);

const redirectPath = computed(() =>
  resolveAuthNextPath(
    typeof route.query.next === "string"
      ? route.query.next
      : typeof route.query.redirect === "string"
        ? route.query.redirect
        : null,
  ),
);
const signupAllowed = computed(() =>
  canCreateRegularAccount({
    checked: setupPhase.value === "ready",
    status: setupStatus.value,
  }),
);
const setupUnavailable = computed(
  () =>
    setupPhase.value === "unavailable" ||
    (setupAttempt.value > 0 && setupPhase.value === "checking"),
);

async function checkSetupStatus() {
  setupPhase.value = "checking";
  try {
    setupStatus.value = await fetchSetupStatus();
    setupPhase.value = "ready";
    if (setupStatus.value.needs_setup) isLogin.value = true;
  } catch {
    setupStatus.value = null;
    setupPhase.value = "unavailable";
  }
}

async function submit() {
  error.value = "";
  showSsoHint.value = false;
  if (!isLogin.value && !signupAllowed.value) {
    error.value = $i18n.t.value.login.adminSetupRequiredDescription;
    return;
  }

  loading.value = true;
  try {
    const endpoint = isLogin.value
      ? "/api/v1/auth/login/local"
      : "/api/v1/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": isLogin.value
          ? "application/x-www-form-urlencoded"
          : "application/json",
      },
      body: isLogin.value
        ? new URLSearchParams({
            username: email.value,
            password: password.value,
            remember_me: String(rememberMe.value),
          })
        : JSON.stringify({
            email: email.value,
            password: password.value,
            remember_me: rememberMe.value,
          }),
    });
    if (!response.ok) {
      error.value = parseAuthError(await response.json()).message;
      showSsoHint.value = isLogin.value && providers.value.length > 0;
      return;
    }
    clearAuthenticatedClientState(queryClient);
    saveRememberLoginPreference({
      email: email.value,
      rememberMe: rememberMe.value,
    });
    await navigateTo(redirectPath.value);
  } catch {
    error.value = $i18n.t.value.login.networkError;
  } finally {
    loading.value = false;
  }
}

function startSso(provider: Provider) {
  window.location.assign(
    `/api/v1/auth/oauth/${encodeURIComponent(provider.id)}?next=${encodeURIComponent(redirectPath.value)}&remember_me=${String(rememberMe.value)}`,
  );
}

/*
  已经有 session 的人不该停在登录页上——上游 login/page.tsx:77 的
  `if (isAuthenticated) router.push(redirectPath)`。它不只是「刚登录完的那一跳」：
  **关掉鉴权部署时（`authDisabled`），Gateway 直接给出一个用户**，于是上游访问
  /login 会立刻回到工作区，而本仓停在一张永远也用不上的登录表单上。
  实测（2026-09-02 probe）两个应用在同一份配置下一个跳一个不跳，台账口径下差 58 行。

  判据与上游一致：**只看「有没有 user」**（React 的 `isAuthenticated = user !== null`），
  不看 authDisabled 开关——`unavailable` 是服务状态不是登出，那一支要留在登录页上。

  **session query 必须动态 import**，与 middleware/auth.global.ts 同一条理由：
  `session-query` → `session` → `auth/types` 拖着 zod 与 vue-query 的一整块。
  第一版在这里写了静态 `useAuthSession`，`/login` 的关键路径当场从 348 KB 涨到
  **728 KB**（route-payload 门禁抓的）。走 queryClient 拿的还是同一份缓存，
  与 middleware、`/auth/callback` 共用一个 query key。
*/
async function redirectIfSignedIn() {
  const { authSessionQueryOptions } = await import("@/core/auth/session-query");
  const probe = await queryClient.fetchQuery(authSessionQueryOptions());
  if (probe.tag === "authenticated") await navigateTo(redirectPath.value);
}

watch(setupAttempt, () => void checkSetupStatus(), { immediate: true });
onMounted(() => {
  void redirectIfSignedIn();
  const preference = loadRememberLoginPreference();
  email.value = preference.email;
  rememberMe.value = preference.rememberMe;
  void fetch("/api/v1/auth/providers", { credentials: "include" })
    .then((response) => (response.ok ? response.json() : { providers: [] }))
    .then((data: { providers?: Provider[] }) => {
      providers.value = data.providers ?? [];
    })
    .catch(() => undefined);
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
    <section
      class="bg-background/85 border-border/50 relative z-10 w-full max-w-md space-y-6 rounded-3xl border p-8 shadow-xl backdrop-blur-sm"
    >
      <header class="text-center">
        <h1 class="font-serif text-3xl">DeerFlow</h1>
        <p class="text-muted-foreground mt-2">
          {{
            isLogin
              ? $i18n.t.value.login.signInTitle
              : $i18n.t.value.login.createAccountTitle
          }}
        </p>
      </header>

      <div
        v-if="setupUnavailable"
        role="status"
        aria-live="polite"
        class="border-l-2 border-amber-500 ps-3 text-sm"
      >
        <p class="font-medium">
          {{ $i18n.t.value.login.serviceUnavailableTitle }}
        </p>
        <p class="text-muted-foreground mt-1">
          {{ $i18n.t.value.login.serviceUnavailableDescription }}
        </p>
        <!--
          上游 `(auth)/login/page.tsx:232` 是
          `<Button variant="outline" size="sm" className="mt-3">`。手写那版只留了
          `border`：少 `hover:bg-accent hover:text-accent-foreground`（悬停无反应）、
          少 `cursor-pointer`、少 3px 焦点环、少 `shadow-xs` 与那三条
          `dark:*`，尺寸也差一档（sm 是 `h-8 px-3 gap-1.5`，手写那版是
          `px-3 py-1.5` 没有固定高度）。
        -->
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="mt-3"
          :disabled="setupPhase === 'checking'"
          @click="setupAttempt += 1"
        >
          {{
            setupPhase === "checking"
              ? $i18n.t.value.login.pleaseWait
              : $i18n.t.value.login.retry
          }}
        </Button>
      </div>

      <div
        v-if="setupStatus?.needs_setup"
        class="border-l-2 border-blue-500 ps-3 text-sm"
      >
        <p class="font-medium">
          {{ $i18n.t.value.login.adminSetupRequiredTitle }}
        </p>
        <p class="text-muted-foreground mt-1">
          {{ $i18n.t.value.login.adminSetupRequiredDescription }}
        </p>
        <NuxtLink
          to="/setup"
          class="mt-2 inline-block font-medium text-blue-500 hover:underline"
          >{{ $i18n.t.value.login.createAdminAccount }}</NuxtLink
        >
      </div>

      <!--
        表单里的每一个控件都走 **primitive**，不手写 class。
        wave 68 用 `make dom-parity` 的几何档量出来，这一页此前**系统性地绕过了
        L2 层**：输入框是裸 `<input class="… px-3 py-2">`（实测 h 42 / 字号 16px，
        而上游的 `<Input>` 是 `h-9` + `md:text-sm` → h 36 / 14px），提交键与 SSO 键
        是裸 `<button>`，勾选框只有 `mt-1`（13px，上游是 `h-4 w-4` = 16px）。
        绕过 primitive 丢掉的不只是尺寸——焦点环、`aria-invalid` 态、深色模式、
        禁用态全都不再跟着 L2 走。

        字段分组 `flex flex-col space-y-1` 与 form 的 `space-y-2` 也照上游
        （frontend/src/app/(auth)/login/page.tsx:265）；本仓原来没有分组容器、
        form 用的是 `space-y-3`。
      -->
      <form class="space-y-2" @submit.prevent="submit">
        <div class="flex flex-col space-y-1">
          <label class="text-sm font-medium" for="email">{{
            $i18n.t.value.login.email
          }}</label>
          <Input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            :placeholder="$i18n.t.value.login.emailPlaceholder"
          />
        </div>
        <div class="flex flex-col space-y-1">
          <label class="text-sm font-medium" for="password">{{
            $i18n.t.value.login.password
          }}</label>
          <Input
            id="password"
            v-model="password"
            type="password"
            :autocomplete="isLogin ? 'current-password' : 'new-password'"
            required
            :minlength="isLogin ? 6 : 8"
            :placeholder="$i18n.t.value.login.passwordPlaceholder"
          />
        </div>
        <!--
          与上游 RememberSessionOption 逐字同构
          （frontend/src/components/auth/remember-session-option.tsx:17）。
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
        <Button type="submit" class="w-full" :disabled="loading">
          {{
            loading
              ? $i18n.t.value.login.pleaseWait
              : isLogin
                ? $i18n.t.value.login.signIn
                : $i18n.t.value.login.createAccount
          }}
        </Button>
      </form>

      <div v-if="providers.length" class="space-y-2">
        <!--
          「OR CONTINUE WITH」那条分隔（上游 `(auth)/login/page.tsx:314`）。
          本仓此前直接从表单跳到 SSO 按钮：读屏器听不出这几颗按钮换了一条登录路径，
          视觉上也没有断点。**对照台账看不见它**——`/login` 的对照夹具里没有 SSO
          provider，这一整块根本不渲染（线索 114）。

          结构照抄：一条绝对定位的横线垫底，文字浮在中间并用背景色把线切开。
        -->
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-background text-muted-foreground px-2">
              {{ $i18n.t.value.login.orContinueWith }}
            </span>
          </div>
        </div>
        <p v-if="showSsoHint" class="text-muted-foreground text-center text-sm">
          {{ $i18n.t.value.login.ssoHint }}
        </p>
        <Button
          v-for="provider in providers"
          :key="provider.id"
          type="button"
          variant="outline"
          class="w-full"
          :disabled="loading"
          @click="startSso(provider)"
        >
          {{ $i18n.t.value.login.continueWith(provider.display_name) }}
        </Button>
      </div>
      <!--
        上游把它包在 `div.text-center.text-sm` 里、按钮本身是**行内**的
        （login/page.tsx:347）。本仓原来给按钮加了 `w-full`，于是热区从 204px
        撑到整行 382px——点空白处也会切换登录/注册。
      -->
      <div v-if="signupAllowed" class="text-center text-sm">
        <button
          type="button"
          class="text-blue-500 hover:underline"
          @click="
            isLogin = !isLogin;
            error = '';
            showSsoHint = false;
          "
        >
          {{
            isLogin
              ? $i18n.t.value.login.noAccountSignUp
              : $i18n.t.value.login.haveAccountSignIn
          }}
        </button>
      </div>
      <!--
        同理：上游是 `div.text-muted-foreground.text-center.text-xs` 包一个行内
        `<Link class="hover:underline">`（login/page.tsx:362）。本仓原来把
        `block` 与配色都堆在链接自己身上，热区同样撑满整行。
      -->
      <div class="text-muted-foreground text-center text-xs">
        <NuxtLink to="/" class="hover:underline">{{
          $i18n.t.value.login.backToHome
        }}</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.auth-grid {
  background-image: radial-gradient(
    circle,
    color-mix(in srgb, currentColor 35%, transparent) 1px,
    transparent 1px
  );
  background-size: 8px 8px;
  mask-image: radial-gradient(circle at center, black, transparent 70%);
}
</style>
