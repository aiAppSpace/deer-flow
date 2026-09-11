<script setup lang="ts">
/*
  【文件职责】     设置页的 channel 面板：每个 provider 的账号列表、连接、配置与管理员删除。
  【架构位置】     L3 product UI
  【主要导出】     默认 ChannelConnections 组件
  【依赖关系】     useChannelConnections · auth session · ChannelRuntimeConfigDialog · ui/item · ui/dialog · ui/alert-dialog
  【边界与注意】   侧栏是另一个组件（WorkspaceChannelsList.vue），不要再把两者合成一个 variant——
                   理由写在那个文件的头注释里。

                   这里比 React 的 channels-settings-page.tsx 多出多账号列表、逐账号断开与
                   管理员删 provider 配置三件事，是刻意保留的：tests/e2e-channels/channels.spec.ts
                   拿真实 Gateway 钉住了这条生命周期。**但多出来的东西只在真用得上时出现**——
                   一行 binding row 都没有时账号列表整块不渲染，那张卡片就与上游逐层同形。

                   卡片本体走 `ui/item`（与上游 channels-settings-page.tsx:167 同一族组件），
                   不要改回手写的 article + 两层 flex：那样每一行可见元素都比上游深一层。

                   connections 是这个面板的状态真相（一个 provider 可以挂多个账号，
                   provider.connection_status 只能表达其中最新的一行）；一行都没有时
                   才回落到 provider.connection_status，见 core/channels/state.ts。
                   provider 删除是全局管理员动作，不能伪装成用户断开。
*/

import { computed, ref } from "vue";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Plug,
  Unplug,
} from "lucide-vue-next";

import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import ChannelRuntimeConfigDialog from "./ChannelRuntimeConfigDialog.vue";
import SettingsSection from "@/components/workspace/settings/SettingsSection.vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthSession } from "@/composables/useAuthSession";
import { useChannelConnections } from "@/composables/useChannelConnections";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import {
  closeConnectWindow,
  openConnectUrl,
  prepareConnectWindow,
  type ChannelConnectWindow,
} from "@/core/channels/open-connect-url";
import {
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
  providerSupportsConnect,
} from "@/core/channels/provider-state";
import {
  getChannelConnectionLabel,
  getChannelProviderStatusKey,
  type ChannelProviderView,
} from "@/core/channels/state";
import type {
  ChannelConnection,
  ChannelProvider,
  ChannelProviderId,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";

const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels);
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
const scopeKey = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.id;
  const session = auth.session.value;
  return session?.tag === "authenticated" ? session.user.id : "";
});
const isAdmin = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.system_role === "admin";
  const session = auth.session.value;
  return (
    session?.tag === "authenticated" && session.user.system_role === "admin"
  );
});
const channels = useChannelConnections({
  scopeKey,
  enabled: computed(() => Boolean(scopeKey.value)),
});

const editing = ref<ChannelProvider | null>(null);
const actionError = ref<string | null>(null);
const activeConnectProvider = ref<ChannelProviderId | null>(null);
const removingProvider = ref<ChannelProvider | null>(null);

const activeFlow = computed(() => {
  const provider = activeConnectProvider.value;
  return provider ? channels.connectFlows.value[provider] : undefined;
});

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function statusLabel(status: string) {
  const labels = text.value;
  if (status === "connected") return labels.connected;
  if (status === "pending") return labels.pending;
  if (status === "revoked") return labels.revoked;
  if (status === "not_connected") return labels.notConnected;
  if (status === "disabled") return labels.disabled;
  if (status === "unconfigured") return labels.unconfigured;
  if (status === "unavailable") return labels.unavailableShort;
  return status.replaceAll("_", " ");
}

/*
  provider 那一行走 React 的优先级（停用/未配置/不可用先于连接状态）；
  账号那一行不走——账号只有它自己的绑定状态，provider 的运行时状况在上面已经说过一次了。
*/
function providerStatusLabel(view: ChannelProviderView) {
  return statusLabel(getChannelProviderStatusKey(view));
}
/* 与上游 `isConnected(provider)` 同一条判据：徽标的变体与图标都看它。 */
function providerConnected(view: ChannelProviderView) {
  return getChannelProviderStatusKey(view) === "connected";
}

/*
  **为什么不可用要写进描述里，而不是只挂在按钮的 title 上。**

  上游 `channels-settings-page.tsx:189` 的 `ItemDescription` 是三截拼起来的：
  渠道描述 + 已连接时的「已连接为 X」 + 未连接时的不可用原因。本仓原来只有第一截，
  后两截一个都没有：**「为什么连不上」只存在于按钮的 `title` 里**——悬停才出现，
  触摸设备上根本看不到，读屏器也不会在读到这一行时念出来。
  对照台账 `channels#settings-panel` 上那条
  `ariaOnlyReact: - paragraph: WeChat iLink messages … WeChat runtime is not running.`
  报的就是它：同一段落上游多带着原因，本仓没有。

  **只拼后端明说的 `unavailable_reason`，不做「停用 / 未配置」的回落。**
  上游那一行写的就是裸字段（`!isConnected && provider.unavailable_reason`），
  回落那套 (`getProviderUnavailableReason`) 只喂给按钮的 `title`。
  第一版我把回落也拼进了描述，单场景实测当场多出一行——
  Feishu 是 `configured: false`，本仓给它拼上「未配置」而上游没有。
  状态本身在名字旁边那颗徽标里已经说过一次了（`providerStatusLabel`）。
*/
function providerDescription(view: ChannelProviderView) {
  const { provider } = view;
  const base =
    text.value.descriptions[provider.provider] ?? provider.display_name;
  if (providerConnected(view)) {
    const connection = view.connections.find(
      (candidate) => candidate.status === "connected",
    );
    return connection
      ? `${base} ${text.value.connectedAs(getChannelConnectionLabel(connection))}`
      : base;
  }
  return provider.unavailable_reason
    ? `${base} ${provider.unavailable_reason}`
    : base;
}

function beginSetup(provider: ChannelProvider) {
  editing.value = provider;
  actionError.value = null;
}

function prepareWindow(provider: ChannelProvider): ChannelConnectWindow {
  return provider.auth_mode === "deep_link" ? prepareConnectWindow() : null;
}

async function connectProvider(
  provider: ChannelProvider,
  connectWindow: ChannelConnectWindow = prepareWindow(provider),
) {
  actionError.value = null;
  if (providerNeedsRuntimeConfig(provider)) {
    closeConnectWindow(connectWindow);
    beginSetup(provider);
    return;
  }
  if (!providerSupportsConnect(provider)) {
    closeConnectWindow(connectWindow);
    actionError.value = provider.unavailable_reason || text.value.unavailable;
    return;
  }
  try {
    const response = await channels.connect(provider.provider);
    activeConnectProvider.value = provider.provider;
    if (response.url) openConnectUrl(response.url, connectWindow);
    else closeConnectWindow(connectWindow);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

async function saveRuntimeConfig(
  provider: ChannelProvider,
  values: ChannelRuntimeConfigValues,
) {
  if (channels.isProviderPending(provider.provider)) return;
  const hasActiveConnection = channels.connections.value.some(
    (connection) =>
      connection.provider === provider.provider &&
      (connection.status === "connected" || connection.status === "pending"),
  );
  const connectWindow = hasActiveConnection ? null : prepareWindow(provider);
  actionError.value = null;
  try {
    const next = await channels.configure(provider.provider, values);
    editing.value = null;
    if (!hasActiveConnection) await connectProvider(next, connectWindow);
    else closeConnectWindow(connectWindow);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

async function disconnectConnection(connection: ChannelConnection) {
  actionError.value = null;
  try {
    await channels.disconnectConnection(connection.id);
  } catch (cause) {
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

async function confirmProviderRemoval() {
  const provider = removingProvider.value;
  if (!provider) return;
  actionError.value = null;
  try {
    await channels.disconnectProvider(provider.provider);
    removingProvider.value = null;
  } catch (cause) {
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

function closeConnectDialog() {
  const provider = activeConnectProvider.value;
  if (provider && activeFlow.value?.status === "waiting") {
    channels.cancelConnect(provider);
  }
  activeConnectProvider.value = null;
}

/*
  连接按钮的文案。第三支「重新连接」是本仓此前缺的一档：上游
  channels-settings-page.tsx:284 在 `connection?.status === "revoked"` 时把
  「连接」换成「重新连接」，本仓对已吊销的连接照样写「连接」——用户看不出这次是
  首次接入还是接回一条断掉的。`channels.reconnect` 也因此一直躺在 unused 里。

  判据用 `view.connections`（与上面 addAccount 那一支同源），而不是上游那个
  `connection`（它只看第一条）：本仓一个 provider 可以挂多个账号，
  「还有活着的账号」优先于「有一条被吊销了」。
*/
/**
 * 主操作那颗键的文案。三档都只关于 **binding row**：有活着的行 → 添加账号、
 * 只剩吊销的行 → 重新连接、一行都没有 → 连接。
 */
function connectLabel(view: ChannelProviderView) {
  if (
    view.connections.some(
      (connection) =>
        connection.status === "connected" || connection.status === "pending",
    )
  ) {
    return text.value.addAccount;
  }
  return view.connections.some((connection) => connection.status === "revoked")
    ? text.value.reconnect
    : text.value.connect;
}

/*
  **这颗主操作键要不要渲染。**

  `DEER_FLOW_AUTH_DISABLED=1`（本仓默认的本地跑法）下每条渠道消息都路由到默认用户，
  配好且跑起来的 provider **没有也不需要**任何 binding row，后端直接回
  `connection_status="connected"`（理由原文在 core/channels/state.ts 的文件头）。
  这种形状下这颗键点下去只会走一遍毫无意义的绑定流程，而它旁边的状态图标
  （走 `providerConnected`，会回落到 connection_status）正画着绿勾「已连接」——
  同一行自相矛盾。上游在已连接态**根本不渲染这颗键**
  （`channels-settings-page.tsx:200` 的 `isConnected ? (Modify + Disconnect) : …`）。

  **不能只改文案**：第一版把它换成「添加账号」，台账上那 3 行
  `ariaOnlyVue: button "Connect"` 原样变成 3 行 `button "Add account"`——
  行数一行没少，只是换了个名字。门禁当场拒写，这条判据是它给的。

  有 binding row 时保留：多账号是本仓设置页独有的能力（上游没有这个概念），
  「添加账号」在那种形状下是真操作。
*/
function showConnectAction(view: ChannelProviderView) {
  return view.connections.length > 0 || !providerConnected(view);
}
</script>

<template>
  <SettingsSection
    :title="$i18n.t.value.settings.channels.title"
    :description="$i18n.t.value.settings.channels.description"
  >
    <div class="space-y-3">
      <!--
        渠道整体停用、或一个可见 provider 都没有时,照 React 渲染一句说明,
        而不是把整节藏起来。藏起来的代价是用户在设置里找不到「渠道」这一节,
        以为是自己点错了;React 两个分支用的是同一句 settings.channels.disabled。
      -->
      <p
        v-if="
          !channels.enabled.value &&
          !channels.providerViews.value.length &&
          !channels.error.value &&
          !actionError
        "
        class="text-muted-foreground text-sm"
      >
        {{ $i18n.t.value.settings.channels.disabled }}
      </p>
      <p
        v-if="channels.error.value || actionError"
        role="alert"
        class="text-destructive px-2 text-sm"
      >
        {{ actionError || channels.error.value?.message }}
      </p>

      <!--
        **一张 provider 卡片 = 一个 `ui/item`，不是手写的 article + 两层 flex。**

        上游 `channels-settings-page.tsx:167` 这张卡片整个是
        `<Item variant="outline" className="w-full items-start">` 加
        `ItemMedia / ItemContent / ItemTitle / ItemDescription / ItemActions`
        五个槽位；本仓原来是 `<article>` 套一层 `div.flex` 再手写四个容器，
        **比上游整整深一层**——对照台账 `channels#settings-panel` 上那 13 行
        `depth: … React=2 Vue=3` 报的就是它，每一行可见元素都多背一层。

        `ui/item` 这一族本仓早就移植好了（`ui/item/`，逐字搬自上游），
        ToolSettings / SkillSettings / SubagentSettings 三个设置面板已经在用；
        这里是最后一处还在手写的。顺带把媒体列换成上游的
        `ItemMedia variant="icon"`（带边框的 8×8 底座，图标 `size-5`），
        原来那颗图标是裸的。
      -->
      <Item
        v-for="view in channels.providerViews.value"
        :key="view.provider.provider"
        variant="outline"
        class="w-full items-start"
        :data-testid="`channel-provider-${view.provider.provider}`"
      >
        <ItemMedia variant="icon" class="bg-background">
          <ChannelProviderIcon
            :provider="view.provider.provider"
            class="size-5"
          />
        </ItemMedia>
        <ItemContent class="min-w-0">
          <!--
            状态是一颗**带图标的徽标，挨着渠道名**，不是描述下面一行裸文字。
            上游 `channels-settings-page.tsx:181`：
            `<Badge variant={isConnected ? "default" : "outline"}
             className={cn(!isConnected && "text-muted-foreground")}>`
            里面是 `CheckCircle2Icon`（已连接）或 `AlertCircleIcon`（未连接）加状态文字。

            本仓原来是第三行一个 `text-muted-foreground text-xs` 的裸 span：
            **没有徽标、没有图标，已连接与未连接看起来一模一样**（只有文字不同），
            位置也在描述下面而不是名字旁边。`icon-parity` 的字形档是唯一报出
            `CircleAlert` 的地方——可访问性树里图标不出现，文字两边又一样。
          -->
          <ItemTitle class="w-full">
            <span class="truncate">{{ view.provider.display_name }}</span>
            <Badge
              :variant="providerConnected(view) ? 'default' : 'outline'"
              :class="providerConnected(view) ? '' : 'text-muted-foreground'"
              :data-testid="`channel-status-${view.provider.provider}`"
            >
              <CircleCheck v-if="providerConnected(view)" />
              <CircleAlert v-else />
              {{ providerStatusLabel(view) }}
            </Badge>
          </ItemTitle>
          <ItemDescription class="line-clamp-none">
            {{ providerDescription(view) }}
          </ItemDescription>

          <!--
            **账号列表只在真有 binding row 时才存在。**

            这一整块（「已连接账号」标题 + 每个账号一行）是本仓独有的：上游一个
            provider 只认一条 connection，没有列表这个概念。留着是对的——
            多账号与逐账号断开被 tests/e2e-channels/channels.spec.ts 拿真 Gateway 钉着。

            但本仓原来**无条件渲染**它，于是 7 个 provider 每个都挂一句
            「尚无渠道账号。」：对一个连配都没配的 provider 说「它还没有账号」
            是零信息的噪音，面板被撑到上游的三倍高；更糟的是
            `DEER_FLOW_AUTH_DISABLED=1` 下配好且跑起来的 provider **本来就不该有**
            binding row（每条渠道消息都路由到默认用户，理由原文在
            core/channels/state.ts 的文件头），那时候同一张卡片上边徽标写着
            「已连接」、下边写着「尚无渠道账号」——自相矛盾，与 `showConnectAction`
            要挡的是同一种病。空态那句文案连同 `channels.noAccounts` 一起删掉了。
          -->
          <div v-if="view.connections.length > 0" class="mt-3 w-full space-y-2">
            <h4 class="text-xs font-medium">{{ text.accounts }}</h4>
            <div
              v-for="connection in view.connections"
              :key="connection.id"
              class="bg-muted/40 flex items-center justify-between gap-3 rounded-md px-3 py-2"
              :data-testid="`channel-connection-${connection.id}`"
            >
              <div class="min-w-0">
                <div class="truncate text-xs font-medium">
                  {{ getChannelConnectionLabel(connection) }}
                </div>
                <div class="text-muted-foreground text-xs">
                  {{ statusLabel(connection.status) }}
                </div>
              </div>
              <Button
                v-if="connection.status !== 'revoked'"
                type="button"
                variant="outline"
                size="sm"
                :disabled="channels.isConnectionPending(connection.id)"
                :aria-label="
                  text.disconnectAccount(getChannelConnectionLabel(connection))
                "
                @click="disconnectConnection(connection)"
              >
                <LoaderCircle
                  v-if="channels.isConnectionPending(connection.id)"
                  class="animate-spin"
                />
                <Unplug v-else />
                {{ text.disconnect }}
              </Button>
            </div>
          </div>
        </ItemContent>
        <!--
          上游 `channels-settings-page.tsx:199` 这一排全走 Button：连接键是
          **默认（实心 primary）变体**，modify / disconnect 是
          `variant="outline"`，三颗都是 `size="sm"`，而且**每颗都带一颗图标**
          （`PlugIcon` / `UnplugIcon`，请求在飞的时候换成会转的
          `LoaderCircleIcon`）。

          手写那版：一颗图标都没有（所以「正在连接」除了置灰之外没有任何提示）、
          一条 hover 都没有、连接键用的是**描边**而不是实心（用户看不出这一排里
          哪一颗是主操作）、清配置那颗写死 `text-red-600` 而不是 destructive token
              （2026-09-11 已全仓统一）。

          `removeProviderConfig` 是本仓独有的管理员操作（上游没有这颗键），
          所以它没有可抄的上游形状；这里只把它接进同一套 Button 规格。
          `flex-wrap justify-end` 也是为它加的：上游这一排最多两颗，本仓是三颗。
        -->
        <ItemActions class="ml-auto flex-wrap justify-end">
          <!--
            **这一排的顺序是「修改 → 主操作 → 移除配置」，与上游一致。**
            上游 `channels-settings-page.tsx:200/252` 两个分支都是 Modify 排在前、
            那一档的状态操作（Disconnect / Connect）排在后——右对齐的一排里，
            主操作在最右是通行做法。本仓原来把 Connect 排在 Modify 前面，
            对照台账上 `order: 第 34 个公共节点 React=button "Modify" Vue=button "Connect"`
            报的就是它，键盘 tab 的落点顺序也跟着反了。
          -->
          <Button
            v-if="
              view.provider.configured &&
              providerCanEditRuntimeConfig(view.provider)
            "
            type="button"
            variant="outline"
            size="sm"
            :disabled="channels.isProviderPending(view.provider.provider)"
            @click="beginSetup(view.provider)"
          >
            <!--
              上游那颗 Modify 是带图标的（`channels-settings-page.tsx:211`：
              请求在飞时 `LoaderCircleIcon`，否则 `PlugIcon`）。少这颗图标，
              按钮比上游窄 18px——对照台账上
              `geometry: role:button[Modify] width React=89.5 Vue=71.5 Δ-18`
              量的就是它；而且「正在改配置」除了置灰之外没有任何提示。
            -->
            <LoaderCircle
              v-if="channels.isProviderPending(view.provider.provider)"
              class="animate-spin"
            />
            <Plug v-else />
            {{ text.modify }}
          </Button>
          <Button
            v-if="showConnectAction(view)"
            type="button"
            size="sm"
            :disabled="channels.isProviderPending(view.provider.provider)"
            :title="view.provider.unavailable_reason || undefined"
            @click="connectProvider(view.provider)"
          >
            <LoaderCircle
              v-if="channels.isProviderPending(view.provider.provider)"
              class="animate-spin"
            />
            <Plug v-else />
            {{ connectLabel(view) }}
          </Button>
          <Button
            v-if="isAdmin && view.provider.configured"
            type="button"
            variant="outline"
            size="sm"
            class="text-destructive hover:text-destructive"
            :disabled="channels.isProviderPending(view.provider.provider)"
            :aria-label="`${text.removeProviderConfig}: ${view.provider.display_name}`"
            @click="removingProvider = view.provider"
          >
            <!--
              请求在飞时给一颗会转的图标（与这一排另外两颗同一条纪律），
              但**闲时不挂静态图标**：这颗键在两个应用里都没有可抄的图标语义——
              `Unplug`（上游那颗改名前用的）说的是「断开我的连接」，
              而这个端点删的是整个部署的 provider 运行时配置。
            -->
            <LoaderCircle
              v-if="channels.isProviderPending(view.provider.provider)"
              class="animate-spin"
            />
            {{ text.removeProviderConfig }}
          </Button>
        </ItemActions>
      </Item>
    </div>
  </SettingsSection>

  <ChannelRuntimeConfigDialog
    :provider="editing"
    :open="editing !== null"
    :submitting="editing ? channels.isProviderPending(editing.provider) : false"
    @update:open="!$event && (editing = null)"
    @submit="saveRuntimeConfig"
  />

  <Dialog
    :open="Boolean(activeConnectProvider && activeFlow)"
    @update:open="!$event && closeConnectDialog()"
  >
    <DialogContent
      v-if="activeFlow"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader>
        <DialogTitle>{{ text.connectTitle }}</DialogTitle>
        <DialogDescription data-testid="channel-connect-state">
          {{
            activeFlow.status === "expired"
              ? text.connectionExpired
              : activeFlow.status === "connected"
                ? text.connected
                : text.waitingForConnection
          }}
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-2 text-sm">
        <p v-if="activeFlow.response.instruction">
          {{ activeFlow.response.instruction }}
        </p>
        <p v-if="activeFlow.response.url">{{ text.connectLinkOpened }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="closeConnectDialog">
          {{ activeFlow.status === "waiting" ? text.cancel : text.close }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog
    :open="removingProvider !== null"
    @update:open="!$event && (removingProvider = null)"
  >
    <AlertDialogContent v-if="removingProvider">
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ text.removeProviderTitle(removingProvider.display_name) }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ text.removeProviderDescription }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ text.cancel }}</AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="channels.isProviderPending(removingProvider.provider)"
          @click="confirmProviderRemoval"
        >
          {{ text.removeProviderConfig }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
