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
import { Input } from "@/components/ui/input";
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
import { useSubagents } from "@/composables/useSubagents";
import {
  allowedSubagentsToMode,
  modeToAllowedSubagents,
  type OptionalNameListMode,
} from "@/core/subagents";

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

/*
  subagent 访问是三态（全部 / 一个都不给 / 指定几个），与 subagent 自己的
  tools/skills 同构，转换在 core/subagents/optional-name-list.ts。
  **由服务端强制**，这里只是编辑入口。
*/
const { subagents } = useSubagents();
const subagentAccess = ref<OptionalNameListMode>("all");
const selectedSubagents = ref<string[]>([]);

/** 只有启用了的、且没有名字冲突的才选得中——冲突的那条压根没进运行时。 */
const selectableSubagents = computed(() =>
  subagents.value.filter((subagent) => subagent.enabled && !subagent.conflict),
);
/*
  已经勾上、但现在目录里没有的名字（被删了、被禁用了、或者名字冲突了）。
  **仍然显示出来并保持勾选**：静默丢掉的话，用户一保存就把一条自己没动过的
  绑定删掉了，而界面上没有任何地方提过它。
*/
const missingSubagents = computed(() => {
  const selectable = new Set(
    selectableSubagents.value.map((subagent) => subagent.name),
  );
  return selectedSubagents.value.filter((name) => !selectable.has(name));
});

function toggleSubagent(name: string, checked: boolean) {
  selectedSubagents.value = checked
    ? [...selectedSubagents.value, name]
    : selectedSubagents.value.filter((item) => item !== name);
}

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
  subagentAccess.value = allowedSubagentsToMode(agent.allowed_subagents);
  selectedSubagents.value = agent.allowed_subagents ?? [];
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
  emit("save", {
    ...result.request,
    allowed_subagents: modeToAllowedSubagents(
      subagentAccess.value,
      selectedSubagents.value,
    ),
  });
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
      <form novalidate class="space-y-4 py-1" @submit.prevent="save">
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

        <div class="space-y-1.5">
          <span id="agent-settings-model-label" class="text-sm font-medium">
            {{ $i18n.t.value.agents.settingsModel }}
          </span>
          <!--
            **清单还在取的时候不要把这颗选择器禁掉**（只认 `pending`，也就是正在保存）。

            两个原因。一是信息：这颗选择器**任何时候都有东西可显示**——agent 当前的
            模型（不在清单里时走上面那条 disabled 项）或者「用全局默认」；灰掉它等于
            把「这个 agent 现在跑在哪个模型上」一起藏了，而那正是打开这个对话框要看的。
            清单在取这件事上面那条 `role="status"` 已经说了。

            二是焦点：对话框打开时把焦点交给第一个可聚焦的后代。这颗禁掉之后**焦点落到
            温度那个数字输入框上**——一个 spinbutton，方向键会当场改掉温度值。
            对照台账 `agents-feature-disabled#gallery` 上那行
            `focus: React=button Vue=input[number]` 报的就是它。
          -->
          <Select v-model="model" :disabled="pending">
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
        <!--
          **这两个数字输入原来是手写的 `<input class="border-input … px-3 py-2">`。**
          仓里有 `ui/input`（与上游 `ui/input.tsx` 同源），手写那一版丢掉的是
          焦点环（`focus-visible:ring-[3px]`）、无效态（`aria-invalid:`）、
          禁用态的样式、深色主题的 token 与 `h-9` 的统一高度——**同一个对话框里
          另外三颗 Select 用的都是 primitive 的高度**，只有这两个不是。
          对照台账上 `[role=dialog] height Δ-6.2 / y Δ3.1`（对话框居中，高度差一半
          就是纵向偏移）量的就是这一片盒模型差。

          温度那颗**还缺一个 placeholder**：上游写的是 `t.agents.settingsInherit`
          （「继承」）——空着的时候用户看不出这是「跟随全局」还是「还没填」。
        -->
        <div class="space-y-1.5">
          <span
            id="agent-settings-temperature-label"
            class="text-sm font-medium"
          >
            {{ $i18n.t.value.agents.settingsTemperature }}
          </span>
          <Input
            v-model="temperature"
            data-testid="agent-settings-temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            :placeholder="$i18n.t.value.agents.settingsInherit"
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
            class="text-muted-foreground text-xs"
          >
            {{ $i18n.t.value.agents.settingsTemperatureHint }}
          </p>
        </div>
        <div class="space-y-1.5">
          <span
            id="agent-settings-max-tokens-label"
            class="text-sm font-medium"
          >
            {{ $i18n.t.value.agents.settingsMaxTokens }}
          </span>
          <Input
            v-model="maxTokens"
            data-testid="agent-settings-max-tokens"
            type="number"
            min="1"
            max="200000"
            step="1"
            :placeholder="$i18n.t.value.agents.settingsMaxTokensPlaceholder"
            :disabled="pending"
            aria-labelledby="agent-settings-max-tokens-label"
          />
        </div>

        <div v-if="supportsThinking" class="space-y-1.5">
          <span id="agent-settings-thinking-label" class="text-sm font-medium">
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

        <div v-if="supportsReasoning" class="space-y-1.5">
          <span id="agent-settings-reasoning-label" class="text-sm font-medium">
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

        <!--
          subagent 访问绑定，与上游 agent-settings-dialog.tsx 同一块。
          勾选框用原生 `<input type="checkbox">`——上游同样是原生的，
          本仓也没有 Checkbox primitive，为这一处新造一个不划算。
        -->
        <div class="space-y-2 border-t pt-4">
          <div>
            <p class="text-sm font-medium">
              {{ $i18n.t.value.settings.subagents.bindingTitle }}
            </p>
            <p class="text-muted-foreground text-xs">
              {{ $i18n.t.value.settings.subagents.bindingDescription }}
            </p>
          </div>
          <!--
            提交中整块锁住，与这一屏其余控件一致：请求已经在飞，这时候改的值
            不会进入这一次保存，而界面上看不出这件事。
          -->
          <Select v-model="subagentAccess" :disabled="pending">
            <SelectTrigger
              class="w-full"
              :aria-label="$i18n.t.value.settings.subagents.bindingTitle"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {{ $i18n.t.value.settings.subagents.allAllowed }}
              </SelectItem>
              <SelectItem value="none">
                {{ $i18n.t.value.settings.subagents.noneAllowed }}
              </SelectItem>
              <SelectItem value="selected">
                {{ $i18n.t.value.settings.subagents.selectedAllowed }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div
            v-if="subagentAccess === 'selected'"
            class="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3"
            data-testid="subagent-access-list"
          >
            <label
              v-for="item in selectableSubagents"
              :key="item.name"
              class="flex items-start gap-2 text-sm"
            >
              <input
                type="checkbox"
                class="mt-0.5 size-4"
                :disabled="pending"
                :checked="selectedSubagents.includes(item.name)"
                @change="
                  toggleSubagent(
                    item.name,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              <span>
                <span class="font-medium">{{
                  item.display_name ?? item.name
                }}</span>
                <span class="text-muted-foreground block text-xs">{{
                  item.description
                }}</span>
              </span>
            </label>
            <!--
              已经绑上、但目录里已经没有的名字：仍然显示且保持勾选，取消勾选才移除。
              静默丢掉的话，用户一保存就删掉了一条自己没动过的绑定。
            -->
            <label
              v-for="name in missingSubagents"
              :key="name"
              class="text-muted-foreground flex items-start gap-2 text-sm"
            >
              <input
                type="checkbox"
                class="mt-0.5 size-4"
                checked
                :disabled="pending"
                @change="toggleSubagent(name, false)"
              />
              <span>
                <span class="font-medium">{{ name }}</span>
                <span class="block text-xs">{{
                  $i18n.t.value.settings.subagents.missing
                }}</span>
              </span>
            </label>
          </div>
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
