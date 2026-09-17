<script setup lang="ts">
/*
  【文件职责】     管理 Lark/飞书集成的安装、App 配置、授权与凭证切换流程。
  【架构位置】     L3
  【主要导出】     默认 IntegrationsSettings 组件
  【依赖关系】     Vue-owned Lark flow API · workspace toast · i18n · clipboard · ui/{card,alert,badge,input,button}
  【边界与注意】   逐行对照 React integrations-settings-page.tsx。流程以 generation 拦截
                   过期响应，并在用户动作同步预开窗口；不依赖 React DOM，也不通过 sleep、
                   重试测试或延迟产品行为解决时序。

                   反馈一律走 workspace toaster，与 React 的 sonner 同一个位置：
                   此前这里把成功/失败渲染成面板内的 role=status / role=alert 段落，
                   于是同一句话在两个应用里出现在不同的地方、带不同的角色。留在面板里的
                   只有 React 也留在面板里的那一处——状态**加载**失败的 destructive Alert。

                   六个 pending 标志分开存，不能并成一个 busy：React 每个 mutation 各有
                   isPending，按钮的转圈、文案与禁用各自读其中一个。合成一个的代价实测
                   过——换应用凭据时会弹出「正在安装技能包」。

                   React 还额外用 NEXT_PUBLIC_STATIC_WEBSITE_ONLY 关掉这几个按钮；
                   静态整站模式按对齐范围双向豁免，这里不复刻。
*/
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  PlugZap,
  RefreshCw,
  XCircle,
} from "lucide-vue-next";

import LarkStatusItem from "./LarkStatusItem.vue";
import SettingsSection from "./SettingsSection.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "@/composables/useAuthSession";
import { SKILLS_QUERY_KEY } from "@/composables/useSkillsCatalog";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import { writeTextToClipboard } from "@/core/clipboard";
import {
  completeLarkAuthorization,
  completeLarkConfiguration,
  installLarkIntegration,
  LarkIntegrationRequestError,
  loadLarkIntegrationStatus,
  setLarkAppCredentials,
  startLarkAuthorization,
  startLarkConfiguration,
} from "@/core/integrations/lark/api";
import type {
  LarkAuthStartRequest,
  LarkAuthStartResponse,
  LarkConfigStartResponse,
  LarkIntegrationStatus,
} from "@/core/integrations/lark/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { cn } from "@/lib/utils";

type PendingFlow =
  | ({ kind: "config" } & LarkConfigStartResponse)
  | ({ kind: "auth" } & LarkAuthStartResponse);

/** 对照 `lark-cli auth login --domain`（业务域 + all）。 */
const DOMAINS = [
  "calendar",
  "im",
  "docs",
  "drive",
  "sheets",
  "base",
  "wiki",
  "task",
  "mail",
  "vc",
  "minutes",
  "note",
  "slides",
  "markdown",
  "mindnotes",
  "contact",
  "approval",
  "attendance",
  "okr",
  "event",
  "apps",
  "all",
] as const;

const AUTOMATIC_LARK_AUTH_WAIT_SECONDS = 8;

const { $i18n } = useNuxtApp();
const copy = computed(() => $i18n.t.value);
const larkCopy = computed(() => copy.value.settings.integrations.lark);
const toast = useWorkspaceToast();
const queryClient = useQueryClient();
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
const isAdmin = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.system_role === "admin";
  const session = auth.session.value;
  return (
    session?.tag === "authenticated" && session.user.system_role === "admin"
  );
});

const status = ref<LarkIntegrationStatus | null>(null);
const loading = ref(true);
const fetching = ref(false);
/** 状态**加载**失败；mutation 的失败走 toast，与 React 的 useQuery error 同义。 */
const loadError = ref<string | null>(null);
const installPending = ref(false);
const startConfigPending = ref(false);
const completeConfigPending = ref(false);
const startAuthPending = ref(false);
const completeAuthPending = ref(false);
const switchAppPending = ref(false);
const checkingConnection = ref(false);
const selectedDomains = ref<string[]>([]);
const customScope = ref("");
const pendingFlow = ref<PendingFlow | null>(null);
const showChangeApp = ref(false);
const changeAppId = ref("");
const changeAppSecret = ref("");
const changeAppBrand = ref<"feishu" | "lark">("feishu");
const browserWindow = ref<Window | null>(null);
const authRequest = ref<LarkAuthStartRequest>({ recommend: false });
/** 授权流程只占一条 toast，反复改写它而不是每轮插一条。 */
let authToastId: number | null = null;
/*
  在飞的状态回读。React 在 beginFlow 里 queryClient.cancelQueries（react-query 把
  AbortSignal 交给 queryFn），少了它，一次开始得更早、回来得更晚的 status 会把新流程
  刚写进去的状态覆盖回旧的。这里用同一个手段：一个 controller，开新流程就 abort。
*/
let statusAbort: AbortController | null = null;
let clientGeneration = 0;
let authAttempt = 0;
let authDeadline = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const connectBusy = computed(
  () =>
    startConfigPending.value ||
    completeConfigPending.value ||
    startAuthPending.value ||
    completeAuthPending.value ||
    switchAppPending.value,
);
const integrationBusy = computed(
  () =>
    connectBusy.value ||
    checkingConnection.value ||
    pendingFlow.value !== null ||
    installPending.value,
);
const credentialsConfigured = computed(
  () => status.value?.auth.status === "authenticated",
);
const connected = computed(
  () => credentialsConfigured.value && status.value?.auth.verified === true,
);
/*
  sandbox runtime 这一行只在 sandbox 真的跑 lark-cli 时才有意义
  （AIO / provisioner 模式报的 mode 不是 "none"）。
*/
const showSandboxRuntime = computed(
  () => !!status.value && status.value.sandbox_runtime_mode !== "none",
);
const trimmedCustomScope = computed(() => customScope.value.trim());
const hasAdditionalPermissionRequest = computed(
  () => selectedDomains.value.length > 0 || trimmedCustomScope.value.length > 0,
);
const installDisabled = computed(() => !isAdmin.value || integrationBusy.value);
const authActionDisabled = computed(
  () =>
    !status.value?.installed ||
    !status.value.cli.available ||
    integrationBusy.value,
);
const connectButtonLabel = computed(() => {
  if (checkingConnection.value) return larkCopy.value.checkingConnection;
  if (connectBusy.value) return larkCopy.value.authStarting;
  if (credentialsConfigured.value && hasAdditionalPermissionRequest.value)
    return larkCopy.value.requestPermissions;
  return credentialsConfigured.value
    ? larkCopy.value.connectedAction
    : larkCopy.value.connect;
});
const permissionDomains = computed(() =>
  DOMAINS.map((id) => ({
    id,
    label: larkCopy.value.authDomains[id].label,
    description: larkCopy.value.authDomains[id].description,
  })),
);
const statusCards = computed(() => {
  const current = status.value;
  if (!current) return [];
  return [
    {
      label: larkCopy.value.skillPack,
      ok: current.installed,
      value: current.installed
        ? larkCopy.value.skillsInstalled(
            current.skills_installed,
            current.skills_expected,
          )
        : larkCopy.value.notInstalled,
    },
    {
      label: larkCopy.value.gatewayCli,
      ok: current.cli.available,
      value: current.cli.available
        ? (current.cli.version ?? copy.value.settings.integrations.available)
        : (current.cli.error ?? copy.value.settings.integrations.unavailable),
    },
    {
      label: larkCopy.value.auth,
      ok: connected.value,
      value:
        current.auth.status === "authenticated"
          ? current.auth.verified
            ? (current.auth.user ?? copy.value.settings.integrations.connected)
            : current.auth.user
              ? larkCopy.value.authConfiguredFor(current.auth.user)
              : larkCopy.value.authConfigured
          : larkCopy.value.authNotConfigured,
    },
  ];
});
const sandboxRuntimeValue = computed(() => {
  const current = status.value;
  if (!current) return "";
  if (!current.sandbox_runtime_ready)
    return (
      current.sandbox_runtime_detail ?? larkCopy.value.sandboxRuntimeNotReady
    );
  if (current.sandbox_runtime_mode === "broker")
    return larkCopy.value.sandboxRuntimeBroker;
  if (current.sandbox_runtime_mode === "init-container")
    return larkCopy.value.sandboxRuntimeInitContainer;
  return larkCopy.value.sandboxRuntimeGatewayDownload;
});
const nextStep = computed(() => {
  const current = status.value;
  if (!current?.installed)
    return {
      icon: null,
      title: larkCopy.value.installNextTitle,
      description: larkCopy.value.installNextDescription,
    };
  if (!current.cli.available)
    return {
      icon: null,
      title: larkCopy.value.cliNextTitle,
      description: larkCopy.value.cliNextDescription,
    };
  if (connected.value)
    return {
      icon: CheckCircle2,
      title: larkCopy.value.connectedTitle,
      description: larkCopy.value.connectedDescription,
    };
  if (credentialsConfigured.value)
    return {
      icon: CheckCircle2,
      title: larkCopy.value.configuredTitle,
      description: larkCopy.value.configuredDescription,
    };
  return {
    icon: ExternalLink,
    title: larkCopy.value.authNextTitle,
    description: larkCopy.value.authNextDescription,
  };
});
const pendingFlowTitle = computed(() => {
  const pending = pendingFlow.value;
  if (!pending) return "";
  if (pending.kind === "config") return larkCopy.value.openConnectionLinkTitle;
  return completeAuthPending.value
    ? larkCopy.value.waitingAuthTitle
    : larkCopy.value.openAuthLinkTitle;
});
const pendingFlowDescription = computed(() => {
  const pending = pendingFlow.value;
  if (!pending) return "";
  if (pending.kind === "config")
    return larkCopy.value.openConnectionLinkDescription;
  return completeAuthPending.value
    ? larkCopy.value.waitingAuthDescription
    : larkCopy.value.openAuthLinkDescription;
});
/** manifest 版本优先：技能包声明的版本才是「装了哪一版」，`version` 是回退。 */
const installedVersion = computed(() =>
  status.value ? (status.value.manifest_version ?? status.value.version) : null,
);
/** 只有确实更新时才提示；上游版本号与已装版本相同不算可更新。 */
const updateAvailableVersion = computed(() => {
  const latest = status.value?.latest_available_version;
  if (!latest || latest === installedVersion.value) return null;
  return latest;
});

function describeError(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function clearRetry() {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}

function beginFlow() {
  clearRetry();
  authAttempt += 1;
  clientGeneration += 1;
  statusAbort?.abort();
  statusAbort = null;
  if (authToastId !== null) {
    toast.dismiss(authToastId);
    authToastId = null;
  }
  pendingFlow.value = null;
  return clientGeneration;
}

function active(generation: number) {
  return generation === clientGeneration;
}

function preopenBrowser() {
  const target = globalThis.open?.("about:blank", "_blank") ?? null;
  if (target) target.opener = null;
  browserWindow.value = target;
  return target;
}

function closeBrowser(target: Window | null) {
  target?.close();
  if (browserWindow.value === target) browserWindow.value = null;
}

function openUrl(url: string, target = browserWindow.value) {
  if (target && !target.closed) {
    target.location.href = url;
    browserWindow.value = target;
  } else {
    browserWindow.value =
      globalThis.open?.(url, "_blank", "noopener,noreferrer") ?? null;
  }
}

function buildAuthRequest(): LarkAuthStartRequest {
  const domains = selectedDomains.value.includes("all")
    ? ["all"]
    : [...new Set(selectedDomains.value)];
  const scopes = [
    ...new Set(
      trimmedCustomScope.value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return {
    recommend: false,
    domains,
    scope: scopes.length ? scopes.join(" ") : null,
  };
}

function toggleDomain(domain: string) {
  if (domain === "all") {
    selectedDomains.value = selectedDomains.value.includes("all")
      ? []
      : ["all"];
    return;
  }
  const withoutAll = selectedDomains.value.filter((item) => item !== "all");
  selectedDomains.value = withoutAll.includes(domain)
    ? withoutAll.filter((item) => item !== domain)
    : [...withoutAll, domain];
}

async function load(initial = false, propagate = false) {
  if (initial) loading.value = true;
  else fetching.value = true;
  const controller = new AbortController();
  statusAbort = controller;
  try {
    status.value = await loadLarkIntegrationStatus(controller.signal);
    loadError.value = null;
  } catch (cause) {
    // 取消不是失败：react-query 也不会把 cancel 当成 query error 报出来。
    if (controller.signal.aborted) return;
    loadError.value = describeError(cause);
    if (propagate) throw cause;
  } finally {
    if (statusAbort === controller) statusAbort = null;
    loading.value = false;
    fetching.value = false;
  }
}

async function install() {
  installPending.value = true;
  try {
    const result = await installLarkIntegration();
    status.value = result.status;
    // React 在 onSuccess 里 invalidate 这两份 server state：状态回读一次，
    // 技能索引标脏，切到 Skills 面板时才看得到新装的 lark-* 技能。
    await queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
    toast.success(result.message);
    await load();
  } catch (cause) {
    if (cause instanceof LarkIntegrationRequestError && cause.isAdminRequired) {
      toast.error(copy.value.settings.integrations.adminRequired);
      return;
    }
    toast.error(describeError(cause));
  } finally {
    installPending.value = false;
  }
}

function scheduleAuthRetry(
  result: LarkAuthStartResponse,
  generation: number,
  attempt: number,
) {
  clearRetry();
  if (!active(generation)) return;
  if (Date.now() >= authDeadline) {
    toast.info(larkCopy.value.authorizationStillPending);
    return;
  }
  retryTimer = setTimeout(
    () => void completeAuth(result, generation, attempt, true),
    1500,
  );
}

async function completeAuth(
  result: LarkAuthStartResponse,
  generation: number,
  attempt: number,
  automatic: boolean,
) {
  const options = authToastId === null ? undefined : { id: authToastId };
  completeAuthPending.value = true;
  try {
    const completed = await completeLarkAuthorization({
      device_code: result.device_code,
      generation: result.generation,
      ...(automatic
        ? { wait_timeout_seconds: AUTOMATIC_LARK_AUTH_WAIT_SECONDS }
        : {}),
    });
    if (!active(generation) || attempt !== authAttempt) return;
    status.value = completed.status;
    if (completed.success) {
      clearRetry();
      toast.success(completed.message, options);
      authToastId = null;
      pendingFlow.value = null;
      browserWindow.value = null;
      return;
    }
    toast.info(
      completed.message || larkCopy.value.authorizationStillPending,
      options,
    );
    if (automatic) scheduleAuthRetry(result, generation, attempt);
  } catch (cause) {
    if (!active(generation) || attempt !== authAttempt) return;
    if (
      automatic &&
      cause instanceof LarkIntegrationRequestError &&
      cause.status === 504
    ) {
      toast.info(larkCopy.value.authorizationStillPending, options);
      scheduleAuthRetry(result, generation, attempt);
      return;
    }
    toast.error(describeError(cause), options);
    authToastId = null;
  } finally {
    // 只有还属于当前流程的这一轮才有资格改状态：授权是带重试的轮询，
    // 上一轮迟到的 finally 会把正在等待的那一轮标记成不在等待。
    if (active(generation) && attempt === authAttempt) {
      completeAuthPending.value = false;
    }
  }
}

async function startAuth(
  generation: number,
  target: Window | null,
  serverGeneration?: string,
) {
  startAuthPending.value = true;
  try {
    const result = await startLarkAuthorization({
      ...authRequest.value,
      ...(serverGeneration ? { generation: serverGeneration } : {}),
    });
    if (!active(generation)) return;
    pendingFlow.value = { kind: "auth", ...result };
    openUrl(result.verification_url, target);
    authToastId = toast.info(larkCopy.value.authStarted);
    clearRetry();
    authAttempt += 1;
    const attempt = authAttempt;
    authDeadline = Date.now() + Math.max(result.expires_in ?? 300, 30) * 1000;
    void completeAuth(result, generation, attempt, true);
  } catch (cause) {
    if (!active(generation)) return;
    closeBrowser(target);
    toast.error(describeError(cause));
  } finally {
    if (active(generation)) startAuthPending.value = false;
  }
}

async function startRegistration(
  brand: "feishu" | "lark",
  generation: number,
  target: Window | null,
) {
  startConfigPending.value = true;
  try {
    const result = await startLarkConfiguration({ brand });
    if (!active(generation)) return;
    pendingFlow.value = { kind: "config", ...result };
    openUrl(result.verification_url, target);
    toast.success(larkCopy.value.connectionStarted);
  } catch (cause) {
    if (!active(generation)) return;
    closeBrowser(target);
    toast.error(describeError(cause));
  } finally {
    if (active(generation)) startConfigPending.value = false;
  }
}

async function connect() {
  if (!status.value) return;
  authRequest.value = buildAuthRequest();
  /*
    在点击手势内同步预开空白页。这里不能相信缓存里的授权状态：`authenticated`
    可能已在服务端过期，若等 refetch 回来再 window.open，就已经脱离用户手势、
    会被浏览器拦掉。先开、用不上再关，弹窗才稳。
  */
  const target = preopenBrowser();
  const generation = beginFlow();
  checkingConnection.value = true;
  try {
    await load(false, true);
    if (!active(generation) || !status.value) return;
    if (status.value.app_configured) await startAuth(generation, target);
    else await startRegistration("feishu", generation, target);
  } catch (cause) {
    if (!active(generation)) return;
    closeBrowser(target);
    toast.error(describeError(cause));
  } finally {
    if (active(generation)) checkingConnection.value = false;
  }
}

async function continueConfiguration() {
  const pending = pendingFlow.value;
  if (!pending || pending.kind !== "config") return;
  const generation = clientGeneration;
  completeConfigPending.value = true;
  try {
    const configured = await completeLarkConfiguration({
      device_code: pending.device_code,
      generation: pending.generation,
      brand: pending.brand,
      interval: pending.interval,
      expires_in: pending.expires_in,
    });
    if (!active(generation)) return;
    status.value = configured.status;
    toast.success(larkCopy.value.connectionReady);
    pendingFlow.value = null;
    await startAuth(generation, browserWindow.value, configured.generation);
  } catch (cause) {
    if (!active(generation)) return;
    pendingFlow.value = null;
    toast.error(describeError(cause));
  } finally {
    if (active(generation)) completeConfigPending.value = false;
  }
}

async function switchApp() {
  /*
    与 connect 同一条约束：切换 POST 解析之后才轮到浏览器授权，那时再开窗口
    已经不在手势里。所以在这里同步预开。
  */
  authRequest.value = buildAuthRequest();
  const target = preopenBrowser();
  const generation = beginFlow();
  switchAppPending.value = true;
  try {
    const result = await setLarkAppCredentials({
      app_id: changeAppId.value.trim(),
      app_secret: changeAppSecret.value.trim(),
      brand: changeAppBrand.value,
    });
    if (!active(generation)) return;
    status.value = result.status;
    toast.success(larkCopy.value.changeAppSwitched);
    changeAppSecret.value = "";
    showChangeApp.value = false;
    // 新 app 还没有用户授权，直接把浏览器授权推下去，让这次切换落到可用状态。
    await startAuth(generation, target, result.generation);
  } catch (cause) {
    if (!active(generation)) return;
    closeBrowser(target);
    toast.error(describeError(cause));
  } finally {
    if (active(generation)) switchAppPending.value = false;
  }
}

function reRegister() {
  authRequest.value = buildAuthRequest();
  const target = preopenBrowser();
  const generation = beginFlow();
  void startRegistration(changeAppBrand.value, generation, target);
}

async function copyLink() {
  const pending = pendingFlow.value;
  if (!pending) return;
  if (await writeTextToClipboard(pending.verification_url))
    toast.success(copy.value.clipboard.copiedToClipboard);
  else toast.error(copy.value.clipboard.failedToCopyToClipboard);
}

function manualComplete() {
  const pending = pendingFlow.value;
  if (!pending || pending.kind !== "auth") return;
  clearRetry();
  authAttempt += 1;
  void completeAuth(pending, clientGeneration, authAttempt, false);
}

onMounted(() => void load(true));
onUnmounted(() => {
  clientGeneration += 1;
  clearRetry();
  statusAbort?.abort();
  statusAbort = null;
});
</script>

<template>
  <SettingsSection
    :title="copy.settings.integrations.title"
    :description="copy.settings.integrations.description"
  >
    <Card>
      <!--
        设置页里只有这一页包了 Card，于是窄屏（<sm）下它的 px-6 叠在面板内边距和
        里面那几个状态盒上：375px 屏上内容列只剩 167px，比「在浏览器重新注册」
        那颗按钮（191px）和 OAuth scope 示例都窄，两者当场溢出。sm 以上不变。
      -->
      <CardHeader class="px-4 sm:px-6">
        <!--
          `min-w-0` + `shrink-0` 不是装饰，是这张卡片在窄屏下装不装得下的唯一变量
          （两边同改，上游 integrations-settings-page.tsx:642 同一处）。

          CardHeader 在有 CardAction 时是 `grid-cols-[1fr_auto]`：第 2 列是那颗
          `whitespace-nowrap` 的 Refresh（min-content 95px），第 1 列虽然是 `1fr`，
          但 grid/flex 子项默认 `min-width: auto`——**缩不到自己的 min-content 以下**。
          于是这一列卡在 137px（图标 36 + gap 12 + 文字 min-content 89），
          两列谁也让不出空间，整个 grid 溢出，表现为 Refresh 探出卡片右边。

          实测（375px 视口、卡片内容宽 257）：本机 macOS 恰好不溢出，
          CI 的 Linux 字体宽一点就 `cardOverflow: 9`——**余量本来就是 0**。
          把视口收窄到 366px 能在本机复现同一个数（溢出 8），越界者自始至终
          只有 `[data-slot="card-action"]`。
        -->
        <div class="flex min-w-0 items-center gap-3">
          <div class="bg-primary/10 text-primary shrink-0 rounded-lg p-2">
            <PlugZap class="size-5" />
          </div>
          <div class="min-w-0">
            <CardTitle>{{ larkCopy.title }}</CardTitle>
            <CardDescription>{{ larkCopy.description }}</CardDescription>
          </div>
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            :disabled="fetching"
            @click="load()"
          >
            <RefreshCw :class="cn('size-4', fetching && 'animate-spin')" />
            {{ copy.settings.integrations.refresh }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="space-y-4 px-4 sm:px-6">
        <div v-if="loading" class="text-muted-foreground text-sm">
          {{ copy.common.loading }}
        </div>
        <Alert v-else-if="loadError" variant="destructive">
          <XCircle />
          <AlertTitle>{{ copy.settings.integrations.loadFailed }}</AlertTitle>
          <AlertDescription>{{ loadError }}</AlertDescription>
        </Alert>
        <template v-else-if="status">
          <div
            :class="
              cn(
                'grid gap-3',
                showSandboxRuntime ? 'md:grid-cols-4' : 'md:grid-cols-3',
              )
            "
          >
            <LarkStatusItem
              v-for="item in statusCards"
              :key="item.label"
              :label="item.label"
              :ok="item.ok"
              :value="item.value"
            />
            <LarkStatusItem
              v-if="showSandboxRuntime"
              :label="larkCopy.sandboxRuntime"
              :ok="status.sandbox_runtime_ready"
              :value="sandboxRuntimeValue"
            />
          </div>

          <div
            v-if="status.installed"
            class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
          >
            <span>{{ larkCopy.installedVersion(installedVersion ?? "") }}</span>
            <span
              v-if="updateAvailableVersion"
              class="text-amber-600 dark:text-amber-500"
            >
              {{ larkCopy.updateAvailable(updateAvailableVersion) }}
            </span>
            <span
              v-if="status.runtime_version_mismatch"
              class="text-amber-600 dark:text-amber-500"
            >
              {{ larkCopy.runtimeVersionMismatch }}
            </span>
          </div>

          <Alert>
            <component :is="nextStep.icon" v-if="nextStep.icon" />
            <AlertTitle>{{ nextStep.title }}</AlertTitle>
            <AlertDescription>{{ nextStep.description }}</AlertDescription>
          </Alert>

          <div
            v-if="status.installed && status.cli.available"
            class="rounded-lg border p-3"
          >
            <div class="space-y-1">
              <div class="text-sm font-medium">
                {{ larkCopy.permissionTitle }}
              </div>
              <p class="text-muted-foreground text-sm">
                {{ larkCopy.permissionDescription }}
              </p>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <!--
                选中只是换了个 variant，不加 aria-pressed 的话读屏器听不出哪些域
                被选上了——颜色是唯一的线索。与 ScheduledTaskScheduleInput 的
                星期几按钮同一个形状，那边一直写着 aria-pressed。
              -->
              <Button
                v-for="domain in permissionDomains"
                :key="domain.id"
                size="sm"
                :variant="
                  selectedDomains.includes(domain.id) ? 'default' : 'outline'
                "
                :disabled="integrationBusy"
                :title="domain.description"
                :aria-pressed="selectedDomains.includes(domain.id)"
                @click="toggleDomain(domain.id)"
              >
                {{ domain.label }}
              </Button>
            </div>
            <div class="mt-3 space-y-1">
              <Input
                v-model="customScope"
                :disabled="integrationBusy"
                :placeholder="larkCopy.customScopePlaceholder"
                :aria-label="larkCopy.customScopeLabel"
              />
              <!--
                这句话里嵌着 OAuth scope 字面量（`calendar:calendar.free_busy:read.`），
                冒号和点在词中不提供换行机会，所以它在 text-xs 下是一个 192.2px 宽的
                「单词」。**实测：整块设置面板的 min-content 就是这一颗 token 撑出来的**
                ——192.2 + p-3 24 + border 2 + px-4 32 + card border 2 = 卡片 252.2、
                滚动区 286.2，而 375px 屏上那格只有 293px。Linux 字体宽一点就顶破。

                用 `break-words` 没用：按 css-text-3，`overflow-wrap: break-word` 新增的
                换行机会**不计入 min-content**；`anywhere` 才计入，而且它只在一个词
                实在放不下时才从中间断开，正常文字仍然在空格处换行。
              -->
              <p class="text-muted-foreground text-xs wrap-anywhere">
                {{ larkCopy.customScopeDescription }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button :disabled="installDisabled" @click="install">
              <RefreshCw v-if="installPending" class="size-4 animate-spin" />
              {{
                installPending
                  ? copy.settings.integrations.installing
                  : status.installed
                    ? copy.settings.integrations.reinstall
                    : copy.settings.integrations.install
              }}
            </Button>
            <Button
              variant="outline"
              :disabled="authActionDisabled"
              @click="connect"
            >
              <RefreshCw
                v-if="connectBusy || checkingConnection"
                class="size-4 animate-spin"
              />
              {{ connectButtonLabel }}
            </Button>
            <Button
              v-if="
                status.installed &&
                status.cli.available &&
                status.app_configured
              "
              variant="ghost"
              :disabled="integrationBusy"
              @click="showChangeApp = !showChangeApp"
            >
              {{ larkCopy.changeAppButton }}
            </Button>
            <span v-if="!isAdmin" class="text-muted-foreground text-sm">
              {{ copy.settings.integrations.adminRequired }}
            </span>
          </div>

          <div
            v-if="showChangeApp && status.installed && status.cli.available"
            class="space-y-3 rounded-lg border p-3"
          >
            <div class="space-y-1">
              <div class="text-sm font-medium">
                {{ larkCopy.changeAppTitle }}
              </div>
              <p class="text-muted-foreground text-sm">
                {{ larkCopy.changeAppDescription }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <!--
                品牌是单选，但这两颗仍然是普通按钮：真做成 radiogroup 就欠一套
                方向键 roving focus，而两边都没有（ToggleGroupItem 的文件头写的
                正是这条分叉）。aria-pressed 至少把状态念出来，又不许诺不存在的
                键盘语义。
              -->
              <Button
                v-for="brand in ['feishu', 'lark'] as const"
                :key="brand"
                size="sm"
                :variant="changeAppBrand === brand ? 'default' : 'outline'"
                :disabled="integrationBusy"
                :aria-pressed="changeAppBrand === brand"
                @click="changeAppBrand = brand"
              >
                {{
                  brand === "feishu" ? larkCopy.brandFeishu : larkCopy.brandLark
                }}
              </Button>
            </div>
            <div class="space-y-2">
              <Input
                v-model="changeAppId"
                :disabled="integrationBusy"
                :placeholder="larkCopy.changeAppIdLabel"
                :aria-label="larkCopy.changeAppIdLabel"
              />
              <Input
                v-model="changeAppSecret"
                type="password"
                :disabled="integrationBusy"
                :placeholder="larkCopy.changeAppSecretLabel"
                :aria-label="larkCopy.changeAppSecretLabel"
              />
              <p class="text-muted-foreground text-xs">
                {{ larkCopy.changeAppAuthResetNote }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                size="sm"
                :disabled="
                  integrationBusy ||
                  !changeAppId.trim() ||
                  !changeAppSecret.trim()
                "
                @click="switchApp"
              >
                <RefreshCw
                  v-if="switchAppPending"
                  class="size-4 animate-spin"
                />
                {{ larkCopy.changeAppSubmit }}
              </Button>
              <!--
                实测这颗按钮的 min-content 是 191.1px，而 360px 屏上它所在的
                内容列只有 186px——**整块设置面板在那一档撑出格子，就是它一颗撑的**。
                一颗在最窄的受支持屏幕上放不下的按钮标签必须允许折行；
                `min-h-8` 让单行时的高度仍然正好是 `sm` 档，约 400px 以上毫无变化。
              -->
              <Button
                size="sm"
                variant="outline"
                class="h-auto min-h-8 py-1 whitespace-normal"
                :disabled="integrationBusy"
                @click="reRegister"
              >
                <ExternalLink class="size-4" />
                {{ larkCopy.changeAppReRegister }}
              </Button>
            </div>
          </div>

          <Alert v-if="installPending">
            <RefreshCw class="size-4 animate-spin" />
            <AlertTitle>{{ larkCopy.installingTitle }}</AlertTitle>
            <AlertDescription>
              {{ larkCopy.installingDescription }}
            </AlertDescription>
          </Alert>

          <Alert v-if="pendingFlow">
            <ExternalLink />
            <AlertTitle>{{ pendingFlowTitle }}</AlertTitle>
            <AlertDescription>
              <div class="space-y-3">
                <p>{{ pendingFlowDescription }}</p>
                <div
                  class="bg-muted text-foreground rounded-md px-3 py-2 text-xs break-all"
                >
                  {{ pendingFlow.verification_url }}
                </div>
                <div class="flex flex-wrap gap-2">
                  <a
                    :href="pendingFlow.verification_url"
                    target="_blank"
                    rel="noreferrer"
                    :class="buttonVariants({ size: 'sm' })"
                  >
                    <ExternalLink class="size-4" />
                    {{ larkCopy.openAuthLink }}
                  </a>
                  <Button size="sm" variant="outline" @click="copyLink">
                    <Copy class="size-4" />
                    {{ larkCopy.copyAuthLink }}
                  </Button>
                  <Button
                    v-if="pendingFlow.kind === 'config'"
                    size="sm"
                    variant="outline"
                    :disabled="completeConfigPending"
                    @click="continueConfiguration"
                  >
                    <RefreshCw
                      v-if="completeConfigPending"
                      class="size-4 animate-spin"
                    />
                    {{
                      completeConfigPending
                        ? larkCopy.preparingAuthorization
                        : larkCopy.continueAuth
                    }}
                  </Button>
                  <Button
                    v-else
                    size="sm"
                    :disabled="completeAuthPending"
                    @click="manualComplete"
                  >
                    {{
                      completeAuthPending
                        ? larkCopy.completingAuth
                        : larkCopy.completeAuth
                    }}
                  </Button>
                </div>
                <p
                  v-if="pendingFlow.expires_in !== null"
                  class="text-muted-foreground text-xs"
                >
                  {{ larkCopy.authExpiresIn(pendingFlow.expires_in) }}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </template>
      </CardContent>
    </Card>
  </SettingsSection>
</template>
