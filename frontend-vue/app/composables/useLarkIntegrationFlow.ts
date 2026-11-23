import { computed, onScopeDispose, ref, watch } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { CheckCircle2, ExternalLink } from "lucide-vue-next";
import { useCapabilityUser } from "@/composables/useCapabilities";
import { SKILLS_QUERY_KEY } from "@/composables/useSkillsCatalog";
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
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

export function useLarkIntegrationFlow() {
  type PendingFlow =
    | ({ kind: "config" } & LarkConfigStartResponse)
    | ({ kind: "auth" } & LarkAuthStartResponse);

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
  const user = useCapabilityUser();
  let isCurrentOwner = captureWorkspaceQueryOwner(queryClient);
  const isAdmin = computed(() => user.value?.system_role === "admin");

  const statusKey = computed(() => [
    "integrations",
    "lark",
    "status",
    user.value?.id,
  ]);
  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: ({ signal }) => loadLarkIntegrationStatus(signal),
    enabled: computed(() => !!user.value),
  });
  const status = computed(() => statusQuery.data.value ?? null);
  const loading = statusQuery.isLoading;
  const fetching = statusQuery.isFetching;
  const loadError = computed(() =>
    statusQuery.error.value ? describeError(statusQuery.error.value) : null,
  );
  async function setStatus(
    next: LarkIntegrationStatus,
    generation: number,
    attempt?: number,
  ) {
    const key = [...statusKey.value];
    const userId = user.value?.id;
    // A resolved GET may still have a queued cache write. Finish cancellation
    // before publishing the mutation, then recheck the flow and account owner.
    await queryClient.cancelQueries({ queryKey: key, exact: true });
    if (
      !active(generation) ||
      user.value?.id !== userId ||
      (attempt !== undefined && attempt !== authAttempt)
    )
      return;
    queryClient.setQueryData<LarkIntegrationStatus>(key, (current) =>
      current && !next.sandbox_runtime_probed
        ? {
            ...next,
            sandbox_runtime_mode: current.sandbox_runtime_mode,
            sandbox_runtime_probed: current.sandbox_runtime_probed,
            sandbox_runtime_ready: current.sandbox_runtime_ready,
            sandbox_runtime_detail: current.sandbox_runtime_detail,
          }
        : next,
    );
    if (!next.sandbox_runtime_probed) {
      void queryClient.invalidateQueries({ queryKey: key, exact: true });
    }
  }
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

  let authToastId: number | null = null;

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

  const showSandboxRuntime = computed(
    () => !!status.value && status.value.sandbox_runtime_mode !== "none",
  );
  const trimmedCustomScope = computed(() => customScope.value.trim());
  const hasAdditionalPermissionRequest = computed(
    () =>
      selectedDomains.value.length > 0 || trimmedCustomScope.value.length > 0,
  );
  const installDisabled = computed(
    () => !isAdmin.value || integrationBusy.value,
  );
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
              ? (current.auth.user ??
                copy.value.settings.integrations.connected)
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
    if (pending.kind === "config")
      return larkCopy.value.openConnectionLinkTitle;
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

  const installedVersion = computed(() =>
    status.value
      ? (status.value.manifest_version ?? status.value.version)
      : null,
  );

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

  const actionControllers = new Set<AbortController>();
  function cancelActions() {
    actionControllers.forEach((controller) => controller.abort());
  }
  async function action<T>(
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    actionControllers.add(controller);
    try {
      return await run(controller.signal);
    } finally {
      actionControllers.delete(controller);
    }
  }

  function beginFlow() {
    clearRetry();
    cancelActions();
    authAttempt += 1;
    clientGeneration += 1;
    void queryClient.cancelQueries({ queryKey: statusKey.value, exact: true });
    if (authToastId !== null) {
      toast.dismiss(authToastId);
      authToastId = null;
    }
    pendingFlow.value = null;
    return clientGeneration;
  }

  function active(generation: number) {
    return generation === clientGeneration && isCurrentOwner();
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

  async function load(_initial = false, propagate = false) {
    await statusQuery.refetch({ throwOnError: propagate });
  }

  async function install() {
    const generation = clientGeneration;
    installPending.value = true;
    try {
      const result = await action((signal) => installLarkIntegration(signal));
      if (!active(generation)) return;
      await setStatus(result.status, generation);
      if (!active(generation)) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["capabilities"] }),
      ]);
      if (!active(generation)) return;
      toast.success(result.message);
      await load();
    } catch (cause) {
      if (!active(generation)) return;
      if (
        cause instanceof LarkIntegrationRequestError &&
        cause.isAdminRequired
      ) {
        toast.error(copy.value.settings.integrations.adminRequired);
        return;
      }
      toast.error(describeError(cause));
    } finally {
      if (active(generation)) installPending.value = false;
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
      const completed = await action((signal) =>
        completeLarkAuthorization(
          {
            device_code: result.device_code,
            generation: result.generation,
            ...(automatic
              ? { wait_timeout_seconds: AUTOMATIC_LARK_AUTH_WAIT_SECONDS }
              : {}),
          },
          signal,
        ),
      );
      if (!active(generation) || attempt !== authAttempt) return;
      await setStatus(completed.status, generation, attempt);
      if (!active(generation) || attempt !== authAttempt) return;
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
      const result = await action((signal) =>
        startLarkAuthorization(
          {
            ...authRequest.value,
            ...(serverGeneration ? { generation: serverGeneration } : {}),
          },
          signal,
        ),
      );
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
      const result = await action((signal) =>
        startLarkConfiguration({ brand }, signal),
      );
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
      const configured = await action((signal) =>
        completeLarkConfiguration(
          {
            device_code: pending.device_code,
            generation: pending.generation,
            brand: pending.brand,
            interval: pending.interval,
            expires_in: pending.expires_in,
          },
          signal,
        ),
      );
      if (!active(generation)) return;
      await setStatus(configured.status, generation);
      if (!active(generation)) return;
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
    authRequest.value = buildAuthRequest();
    const target = preopenBrowser();
    const generation = beginFlow();
    switchAppPending.value = true;
    try {
      const result = await action((signal) =>
        setLarkAppCredentials(
          {
            app_id: changeAppId.value.trim(),
            app_secret: changeAppSecret.value.trim(),
            brand: changeAppBrand.value,
          },
          signal,
        ),
      );
      if (!active(generation)) return;
      await setStatus(result.status, generation);
      if (!active(generation)) return;
      toast.success(larkCopy.value.changeAppSwitched);
      changeAppSecret.value = "";
      showChangeApp.value = false;
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
    const generation = clientGeneration;
    const pending = pendingFlow.value;
    if (!pending) return;
    const copied = await writeTextToClipboard(pending.verification_url);
    if (!active(generation) || pendingFlow.value !== pending) return;
    if (copied) toast.success(copy.value.clipboard.copiedToClipboard);
    else toast.error(copy.value.clipboard.failedToCopyToClipboard);
  }

  function manualComplete() {
    const pending = pendingFlow.value;
    if (!pending || pending.kind !== "auth") return;
    clearRetry();
    authAttempt += 1;
    void completeAuth(pending, clientGeneration, authAttempt, false);
  }

  watch(
    () => user.value?.id,
    () => {
      beginFlow();
      isCurrentOwner = captureWorkspaceQueryOwner(queryClient);
      installPending.value = false;
      startConfigPending.value = false;
      completeConfigPending.value = false;
      startAuthPending.value = false;
      completeAuthPending.value = false;
      switchAppPending.value = false;
      checkingConnection.value = false;
      changeAppSecret.value = "";
    },
  );
  onScopeDispose(() => {
    cancelActions();
    clientGeneration += 1;
    clearRetry();
    void queryClient.cancelQueries({ queryKey: statusKey.value, exact: true });
  });

  return {
    copy,
    larkCopy,
    isAdmin,
    status,
    loading,
    fetching,
    loadError,
    installPending,
    completeConfigPending,
    completeAuthPending,
    switchAppPending,
    checkingConnection,
    selectedDomains,
    customScope,
    pendingFlow,
    showChangeApp,
    changeAppId,
    changeAppSecret,
    changeAppBrand,
    connectBusy,
    integrationBusy,
    showSandboxRuntime,
    installDisabled,
    authActionDisabled,
    connectButtonLabel,
    permissionDomains,
    statusCards,
    sandboxRuntimeValue,
    nextStep,
    pendingFlowTitle,
    pendingFlowDescription,
    installedVersion,
    updateAvailableVersion,
    toggleDomain,
    load,
    install,
    completeAuth,
    connect,
    continueConfiguration,
    switchApp,
    reRegister,
    copyLink,
    manualComplete,
  };
}
