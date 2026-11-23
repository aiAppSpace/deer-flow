<script setup lang="ts">
import {
  Copy,
  ExternalLink,
  PlugZap,
  RefreshCw,
  XCircle,
} from "lucide-vue-next";
import LarkStatusItem from "@/components/workspace/settings/LarkStatusItem.vue";
import SettingsSection from "@/components/workspace/settings/SettingsSection.vue";
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
import { useLarkIntegrationFlow } from "@/composables/useLarkIntegrationFlow";
import { cn } from "@/lib/utils";
const {
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
  connect,
  continueConfiguration,
  switchApp,
  reRegister,
  copyLink,
  manualComplete,
} = useLarkIntegrationFlow();
</script>
<template>
  <SettingsSection
    :title="copy.settings.integrations.title"
    :description="copy.settings.integrations.description"
  >
    <Card class="max-w-full min-w-0 wrap-anywhere">
      <CardHeader
        class="px-4 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)] sm:px-6 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div
          class="flex min-w-0 items-center gap-3 @max-[12rem]:flex-col @max-[12rem]:items-start"
        >
          <div class="bg-primary/10 text-primary shrink-0 rounded-lg p-2">
            <PlugZap class="size-5" />
          </div>
          <div class="min-w-0">
            <CardTitle>{{ larkCopy.title }}</CardTitle>
            <CardDescription>{{ larkCopy.description }}</CardDescription>
          </div>
        </div>
        <CardAction
          class="col-start-1 row-span-1 row-start-2 justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end"
        >
          <Button
            class="h-auto min-h-8 max-w-full py-1 whitespace-normal"
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
      <CardContent class="max-w-full min-w-0 space-y-4 px-2 sm:px-6">
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
            class="grid max-w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3"
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
            class="max-w-full min-w-0 rounded-lg border p-3"
          >
            <div class="space-y-1">
              <div class="text-sm font-medium">
                {{ larkCopy.permissionTitle }}
              </div>
              <p class="text-muted-foreground text-sm">
                {{ larkCopy.permissionDescription }}
              </p>
            </div>
            <div class="mt-3 flex min-w-0 flex-wrap gap-2">
              <Button
                v-for="domain in permissionDomains"
                :key="domain.id"
                class="h-auto min-h-8 max-w-full py-1 whitespace-normal"
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

              <p class="text-muted-foreground text-xs wrap-anywhere">
                {{ larkCopy.customScopeDescription }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              class="h-auto min-h-9 max-w-full py-2 whitespace-normal"
              :disabled="installDisabled"
              @click="install"
            >
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
              class="h-auto min-h-9 max-w-full py-2 whitespace-normal"
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
              class="h-auto min-h-9 max-w-full py-2 whitespace-normal"
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
            class="space-y-3 rounded-lg border p-2 sm:p-3"
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
            <div
              class="flex flex-wrap gap-2 max-[361px]:flex-col max-[361px]:items-stretch"
            >
              <Button
                class="h-auto max-w-full min-w-0 whitespace-normal max-[361px]:w-full"
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

              <Button
                size="sm"
                variant="outline"
                class="h-auto min-h-8 max-w-full min-w-0 py-1 whitespace-normal max-[361px]:w-full"
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
