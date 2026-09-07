<script setup lang="ts">
/*
  【文件职责】     用真实 /api/models capability 编辑 Agent 模型与生成参数。
  【架构位置】     L3 Agent settings component
  【主要导出】     默认 AgentSettingsDialog
  【依赖关系】     agents/settings · agents/types · models/types · ui/dialog · ui/select · i18n
  【边界与注意】   pending 时锁定冲突操作；失败不关闭；unsupported capability 由 exact payload 清空。
*/
import { computed, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_AGENT_MODEL_VALUE,
  buildAgentSettingsUpdatePayload,
  resolveAgentSettingsModel,
  type AgentReasoningSelection,
  type AgentThinkingSelection,
} from "@/core/agents/settings";
import type { Agent, UpdateAgentRequest } from "@/core/agents/types";
import type { Model } from "@/core/models/types";

const props = defineProps<{
  agent: Agent;
  models: readonly Model[];
  modelsLoading?: boolean;
  modelError?: string;
  pending?: boolean;
  submitError?: string;
}>();
const emit = defineEmits<{
  cancel: [];
  save: [request: UpdateAgentRequest];
}>();
const { $i18n } = useNuxtApp();
const model = ref(DEFAULT_AGENT_MODEL_VALUE);
// Vue deliberately casts v-model values from number inputs to numbers in the
// browser, while reset starts from serialized API strings.
const temperature = ref<string | number>("");
const maxTokens = ref<string | number>("");
const thinking = ref<AgentThinkingSelection>("inherit");
const reasoningEffort = ref<AgentReasoningSelection>("inherit");
const validationError = ref("");

function reset(agent: Agent) {
  model.value = agent.model ?? DEFAULT_AGENT_MODEL_VALUE;
  temperature.value = agent.model_settings?.temperature?.toString() ?? "";
  maxTokens.value = agent.model_settings?.max_tokens?.toString() ?? "";
  thinking.value =
    agent.thinking_enabled == null
      ? "inherit"
      : agent.thinking_enabled
        ? "on"
        : "off";
  reasoningEffort.value = agent.reasoning_effort ?? "inherit";
  validationError.value = "";
}
watch(() => props.agent, reset, { immediate: true });

const selectedModel = computed(() =>
  resolveAgentSettingsModel(props.models, model.value),
);
const unknownCurrentModel = computed(
  () =>
    props.agent.model !== null &&
    !props.models.some((item) => item.name === props.agent.model),
);
const supportsThinking = computed(
  () => selectedModel.value?.supports_thinking === true,
);
const supportsReasoning = computed(
  () => selectedModel.value?.supports_reasoning_effort === true,
);

function save() {
  validationError.value = "";
  const result = buildAgentSettingsUpdatePayload(props.models, {
    model: model.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    thinking: thinking.value,
    reasoningEffort: reasoningEffort.value,
  });
  if (!result.ok) {
    validationError.value =
      result.error === "temperature"
        ? $i18n.t.value.agents.settingsInvalidTemperature
        : result.error === "max_tokens"
          ? $i18n.t.value.agents.settingsInvalidMaxTokens
          : $i18n.t.value.agents.settingsInvalidModel;
    return;
  }
  emit("save", result.request);
}
</script>

<template>
  <Dialog :open="true" @update:open="!$event && !pending && emit('cancel')">
    <!--
      **不覆盖 `DialogContent` 的宽度**（wave 137）。两边这颗 primitive 的基类都是
      `sm:max-w-lg`（512px），而本仓在这一处单独写了 `sm:max-w-md`（448px）——
      上游那一处什么都没传。wave 137 第一次给这个对话框做对照，几何档当场报出
      `width React=512 Vue=448 Δ-64`。没有任何理由让这一个对话框比别处窄一档，
      去掉覆盖、回到共用的默认值（「primitive 的默认值」正是天生看不见的第⑤类）。
    -->
    <DialogContent
      :close-label="$i18n.t.value.primitives.close"
      @escape-key-down="pending && $event.preventDefault()"
      @pointer-down-outside="$event.preventDefault()"
    >
      <form novalidate class="grid gap-4" @submit.prevent="save">
        <DialogHeader>
          <!--
            **不要在这里再写一次 `text-lg`**（wave 139）。`DialogTitle` 这颗 primitive
            的基类就是 `text-lg leading-none font-semibold`；在调用点重复传 `text-lg`，
            `cn`/tailwind-merge 会把它当成同一组的后来者，**连带把 `leading-none` 顶掉**
            ——Tailwind v4 的 `text-lg` 自带 line-height。实测标题因此从 18px 变成 28px
            （`lh=28.0001px`，上游那颗是 `lh=18px`），对话框整体高出 10px。

            **这处差异此前被误判过**：wave 137 把对话框那 3.9px 高度差记成
            「可访问名那处布局差异的投影」，wave 138 把可访问名整个改完之后**它一点没变**
            ——探针逐层量下来才找到真正的出处（线索 284）。
          -->
          <DialogTitle>
            {{ $i18n.t.value.agents.settingsTitle }} · {{ agent.name }}
          </DialogTitle>
          <DialogDescription>
            {{ $i18n.t.value.agents.settingsDescription }}
          </DialogDescription>
        </DialogHeader>

        <p
          v-if="modelsLoading"
          role="status"
          class="text-muted-foreground text-sm"
        >
          {{ $i18n.t.value.agents.settingsModelsLoading }}
        </p>
        <p v-if="modelError" role="alert" class="text-sm text-red-600">
          {{ modelError }}
        </p>

        <div class="space-y-1 text-sm">
          <span id="agent-settings-model-label" class="block">
            {{ $i18n.t.value.agents.settingsModel }}
          </span>
          <Select v-model="model" :disabled="pending || modelsLoading">
            <SelectTrigger
              class="w-full"
              data-testid="agent-settings-model"
              aria-labelledby="agent-settings-model-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="DEFAULT_AGENT_MODEL_VALUE">
                {{ $i18n.t.value.agents.settingsModelDefault }}
              </SelectItem>
              <SelectItem
                v-if="unknownCurrentModel"
                :value="agent.model!"
                disabled
              >
                {{ agent.model }} ·
                {{ $i18n.t.value.agents.settingsModelUnavailable }}
              </SelectItem>
              <SelectItem
                v-for="item in models"
                :key="item.name"
                :value="item.name"
              >
                {{ item.display_name || item.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!--
          **提示文字不能包在 `<label>` 里**（wave 138）。这两个数字输入原来是
          「`<label>` 整个包住输入框」的隐式关联，而温度那条提示 `<span>` 也在
          `<label>` 内部——于是读屏器把它念成控件名字的一部分：对照台账量到的是
          `spinbutton "Temperature 0 = deterministic, higher = more creative (0–2)."`。
          名字应该只是「温度」，提示是**描述**（`aria-describedby`）。

          改成与同一个对话框里那三个 Select 一样的写法（`id` + `aria-labelledby`），
          这份文件内部也就只剩一种命名方式了。
        -->
        <div class="block text-sm">
          <span id="agent-settings-temperature-label" class="block">
            {{ $i18n.t.value.agents.settingsTemperature }}
          </span>
          <input
            v-model="temperature"
            data-testid="agent-settings-temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
            :disabled="pending"
            aria-labelledby="agent-settings-temperature-label"
            aria-describedby="agent-settings-temperature-hint"
          />
          <!--
            `<p>` 不是 `<span>`：上游那条提示是
            `<p className="text-muted-foreground text-xs">`（同上文件），
            在可访问性树里是一个 `paragraph` 节点；`<span>` 不产生节点，
            于是它和下一段的标签文字在树里粘成同一段
            （对照台账量到 `ariaOnlyVue: - text: 0 = deterministic… Max output tokens`）。
          -->
          <p
            id="agent-settings-temperature-hint"
            class="text-muted-foreground mt-1 text-xs"
          >
            {{ $i18n.t.value.agents.settingsTemperatureHint }}
          </p>
        </div>
        <div class="block text-sm">
          <span id="agent-settings-max-tokens-label" class="block">
            {{ $i18n.t.value.agents.settingsMaxTokens }}
          </span>
          <input
            v-model="maxTokens"
            data-testid="agent-settings-max-tokens"
            type="number"
            min="1"
            max="200000"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
            :placeholder="$i18n.t.value.agents.settingsMaxTokensPlaceholder"
            :disabled="pending"
            aria-labelledby="agent-settings-max-tokens-label"
          />
        </div>

        <div v-if="supportsThinking" class="space-y-1 text-sm">
          <span id="agent-settings-thinking-label" class="block">
            {{ $i18n.t.value.agents.settingsThinking }}
          </span>
          <Select v-model="thinking" :disabled="pending">
            <SelectTrigger
              class="w-full"
              data-testid="agent-settings-thinking"
              aria-labelledby="agent-settings-thinking-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">
                {{ $i18n.t.value.agents.settingsInherit }}
              </SelectItem>
              <SelectItem value="on">
                {{ $i18n.t.value.agents.settingsThinkingOn }}
              </SelectItem>
              <SelectItem value="off">
                {{ $i18n.t.value.agents.settingsThinkingOff }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="supportsReasoning" class="space-y-1 text-sm">
          <span id="agent-settings-reasoning-label" class="block">
            {{ $i18n.t.value.agents.settingsReasoningEffort }}
          </span>
          <Select v-model="reasoningEffort" :disabled="pending">
            <SelectTrigger
              class="w-full"
              data-testid="agent-settings-reasoning"
              aria-labelledby="agent-settings-reasoning-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">
                {{ $i18n.t.value.agents.settingsInherit }}
              </SelectItem>
              <SelectItem value="low">
                {{ $i18n.t.value.agents.settingsReasoningLow }}
              </SelectItem>
              <SelectItem value="medium">
                {{ $i18n.t.value.agents.settingsReasoningMedium }}
              </SelectItem>
              <SelectItem value="high">
                {{ $i18n.t.value.agents.settingsReasoningHigh }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p
          v-if="validationError || submitError"
          role="alert"
          class="text-sm text-red-600"
        >
          {{ validationError || submitError }}
        </p>
        <DialogFooter>
          <Button variant="outline" :disabled="pending" @click="emit('cancel')">
            {{ $i18n.t.value.agents.settingsCancel }}
          </Button>
          <Button
            data-testid="agent-settings-save"
            type="submit"
            :disabled="pending || modelsLoading || Boolean(modelError)"
          >
            {{
              pending
                ? $i18n.t.value.agents.settingsSaving
                : $i18n.t.value.agents.settingsSave
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
