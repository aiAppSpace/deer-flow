<script setup lang="ts">
/*
  【文件职责】     渲染并提交 free-text、choice 与 form human-input 请求。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 HumanInputCard 组件
  【依赖关系】     ui/{badge,button,input,select,textarea} · MessageMarkdown ·
                   core/messages/human-input · ./human-input-card
  【边界与注意】   本文件此前是一份**手搓副本**：裸 `<input class="border-input …">`、
                   裸 `<button class="bg-primary …">`、`text-gray-500` / `text-red-600`
                   这种非语义色（暗色主题下直接不对），一个 primitive 都没用。
                   上游 `frontend/src/components/workspace/messages/human-input-card.tsx`
                   用的是 `ui/{badge,button,input,select,textarea}` 五件套。与 wave 13 的
                   SidebarTrigger、wave 14 的 Reasoning 是同一个模式。

                   **状态是「叠加」不是「替换」。** 上游在 answered / pending / readOnly
                   下仍然把表单、选项和文本框**挂着**（disabled），只是右上角多一枚 Badge、
                   页脚多一行答案；本仓此前一有 `answered` 就把整个卡片体换成一行文字，
                   于是「答过之后还能看见自己答的是哪一项」这件事在 Vue 上做不到。

                   **`readOnly` 是独立的一档，不能并进 `active`。** 上游 `readOnly = !onSubmit`
                   （调用点在 isMock / STATIC_WEBSITE_ONLY 时不传 onSubmit），它既进 `isDisabled`
                   又单独驱动那枚 "Read only" 角标；`active` 只对应「是不是最新那条待答请求」。
                   本仓此前把两者压成一个 `active`，`humanInput.readOnly` 这条词条因此
                   从来没上过屏。MessageList 传 `interactive === false`。

                   **提交成功后清空文本框：靠 watch `answered`，不是靠 emit 的返回值。**
                   上游 `submitResponse` await 得到 `onSubmit` 的结果，非 `false` 才
                   `setText("")`——失败时保留原文供重试。Vue 的 `emit` 拿不到返回值，
                   而改成回调 prop 会让这个组件多出第二条提交路径。观察到的终态是一样的：
                   被接受 → 父级填上 `answered` → 清空；被拒 → `answered` 始终为空 → 保留。

                   **`aria-required` / `aria-invalid` 为假时要「不存在」，不是 `="false"`。**
                   上游写的是 `field.required || undefined`。本仓此前直接绑布尔，
                   于是每个非必填控件都挂着 `aria-required="false"`。文本框那一处例外：
                   上游是 `aria-invalid={Boolean(error)}`，React 会把它渲染成
                   `aria-invalid="false"`，所以这里也照样绑布尔。
*/
import { computed, ref, useId, watch } from "vue";
import {
  CheckCircle2Icon,
  CheckIcon,
  Loader2Icon,
  MessageCircleQuestionMarkIcon,
} from "lucide-vue-next";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildHumanInputFormSubmissionValue,
  buildHumanInputFormSummary,
  buildInitialHumanInputFormValues,
  createHumanInputOptionResponse,
  createHumanInputTextResponse,
  readHumanInputFormValue,
  type HumanInputField,
  type HumanInputFormValue,
  type HumanInputOption,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import { cn } from "@/lib/utils";

import {
  findMissingRequiredFields,
  shouldSubmitHumanInputTextOnKeyDown,
} from "./human-input-card";

const props = defineProps<{
  request: HumanInputRequest;
  answered?: HumanInputResponse;
  active: boolean;
  pending: boolean;
  readOnly?: boolean;
}>();
const { $i18n } = useNuxtApp();
const emit = defineEmits<{
  submit: [response: HumanInputResponse];
}>();

const text = ref("");
const error = ref("");
const compositionActive = ref(false);
const formValues = ref<Record<string, HumanInputFormValue>>(
  buildInitialHumanInputFormValues(props.request.fields ?? []),
);
const invalidFieldNames = ref(new Set<string>());

const titleId = useId();
const textInputId = useId();
const formFieldIdBase = useId();
const formErrorId = `${formFieldIdBase}-error`;
const textErrorId = `${textInputId}-error`;

const isForm = computed(() => props.request.input_mode === "form");
const allowText = computed(
  () =>
    props.request.input_mode === "free_text" ||
    props.request.input_mode === "choice_with_other",
);
const options = computed(() => props.request.options ?? []);
const fields = computed(() => props.request.fields ?? []);
const isDisabled = computed(
  () =>
    !props.active ||
    props.pending ||
    Boolean(props.answered) ||
    props.readOnly === true,
);
const statusLabel = computed(() => {
  if (props.answered) return $i18n.t.value.humanInput.answered;
  if (props.pending) return $i18n.t.value.humanInput.pending;
  if (props.readOnly) return $i18n.t.value.humanInput.readOnly;
  return null;
});

function controlId(index: number) {
  return `${formFieldIdBase}-${index}`;
}
function labelId(index: number) {
  return `${controlId(index)}-label`;
}
function fieldValue(name: string) {
  return readHumanInputFormValue(formValues.value, name);
}
function stringFieldValue(name: string) {
  const value = fieldValue(name);
  return typeof value === "string" ? value : "";
}
function selectedFieldValues(name: string) {
  const value = fieldValue(name);
  return Array.isArray(value) ? value : [];
}
function isInvalid(name: string) {
  return invalidFieldNames.value.has(name);
}

function submitResponse(response: HumanInputResponse) {
  if (isDisabled.value) {
    return;
  }
  error.value = "";
  emit("submit", response);
}

function handleOptionClick(option: HumanInputOption) {
  submitResponse(createHumanInputOptionResponse(props.request, option));
}

function handleFormValueChange(name: string, value: HumanInputFormValue) {
  const remaining = new Set(invalidFieldNames.value);
  remaining.delete(name);
  invalidFieldNames.value = remaining;
  // Keep the error node mounted while other fields are still invalid —
  // their aria-describedby must keep pointing at an existing element.
  if (remaining.size === 0) {
    error.value = "";
  }
  formValues.value = { ...formValues.value, [name]: value };
}

function toggleMultiSelect(field: HumanInputField, option: HumanInputOption) {
  const selected = selectedFieldValues(field.name);
  handleFormValueChange(
    field.name,
    selected.includes(option.value)
      ? selected.filter((entry) => entry !== option.value)
      : [...selected, option.value],
  );
}

function handleFormSubmit() {
  const missing = findMissingRequiredFields(fields.value, formValues.value);
  if (missing.length > 0) {
    invalidFieldNames.value = new Set(missing.map((field) => field.name));
    error.value = $i18n.t.value.humanInput.requiredError;
    return;
  }
  /*
    判空看的是**摘要**，不是提交值。提交值永远长成
    `${summary} [values: {…}]`，trim 之后不可能是空串——本仓此前拿它判空,
    于是「所有字段都可选、并且一个都没填」时不再报错，直接把
    " [values: {}]" 提交上去。上游判的是 buildHumanInputFormSummary。
  */
  if (!buildHumanInputFormSummary(props.request, formValues.value).trim()) {
    error.value = $i18n.t.value.humanInput.emptyError;
    return;
  }
  // Per the request-side-only protocol scope, form answers are submitted as
  // a readable v1 text response — no structured response kind is introduced.
  submitResponse(
    createHumanInputTextResponse(
      props.request,
      buildHumanInputFormSubmissionValue(props.request, formValues.value),
    ),
  );
}

function handleTextSubmit() {
  const value = text.value.trim();
  if (!value) {
    error.value = $i18n.t.value.humanInput.emptyError;
    return;
  }
  submitResponse(createHumanInputTextResponse(props.request, value));
}

function handleTextKeyDown(event: KeyboardEvent) {
  /*
    等回复期间输入框是 readonly 而不是 disabled（理由与主输入框同一条：给正被
    聚焦的控件置 disabled 会当场失焦、且不还回来），所以按键照样送到这里，
    提交快捷键得自己挡。
  */
  if (isDisabled.value) return;
  if (shouldSubmitHumanInputTextOnKeyDown(event, compositionActive.value)) {
    event.preventDefault();
    handleTextSubmit();
  }
}

function handleTextInput(value: string) {
  text.value = value;
  if (error.value) {
    error.value = "";
  }
}

watch(
  () => props.answered,
  (answered) => {
    if (answered) {
      text.value = "";
    }
  },
);
</script>

<template>
  <section
    :aria-labelledby="titleId"
    class="border-border bg-card/70 text-card-foreground rounded-lg border p-4 shadow-xs"
    data-testid="human-input-card"
  >
    <div class="flex items-start gap-3">
      <div
        class="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
      >
        <MessageCircleQuestionMarkIcon class="size-4" />
      </div>
      <div class="min-w-0 flex-1 space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0 space-y-1">
            <h2 :id="titleId" class="text-sm leading-5 font-medium">
              {{ request.title ?? $i18n.t.value.toolCalls.needYourHelp }}
            </h2>
            <div
              v-if="request.context"
              class="text-muted-foreground text-sm leading-6"
            >
              <MessageMarkdown :content="request.context" />
            </div>
          </div>
          <Badge
            v-if="statusLabel"
            :class="
              cn(
                'h-6 rounded-md px-2',
                pending && 'gap-1.5',
                answered && 'border-primary/20 bg-primary/10 text-primary',
              )
            "
            :variant="answered ? 'outline' : 'secondary'"
          >
            <Loader2Icon v-if="pending" class="size-3 animate-spin" />
            <CheckCircle2Icon v-if="answered" class="size-3" />
            {{ statusLabel }}
          </Badge>
        </div>

        <div class="text-foreground text-sm leading-6">
          <MessageMarkdown :content="request.question" />
        </div>

        <form
          v-if="isForm"
          class="space-y-4"
          @submit.prevent="handleFormSubmit"
        >
          <template v-for="(field, index) in fields" :key="field.name">
            <!--
              原生复选框：读屏器要的是真正的 checkbox role 与 checked 状态，
              不是一颗 aria-pressed 的按钮。不加 HTML `required`——原生约束校验
              会抢在自定义提交逻辑之前拦下表单。标签只出现一次：控件包在
              label 里，上面不再另起一行字段名。
            -->
            <label
              v-if="field.type === 'checkbox'"
              class="flex w-fit cursor-pointer items-center gap-2 text-sm leading-5"
              :for="controlId(index)"
            >
              <input
                :id="controlId(index)"
                :checked="fieldValue(field.name) === true"
                class="accent-primary size-4"
                :disabled="isDisabled"
                type="checkbox"
                :aria-required="field.required || undefined"
                :aria-invalid="isInvalid(field.name) || undefined"
                :aria-describedby="
                  isInvalid(field.name) ? formErrorId : undefined
                "
                @change="
                  handleFormValueChange(
                    field.name,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              {{ field.label }}
              <template v-if="field.required">
                <span class="text-destructive" aria-hidden="true">*</span>
                <span class="sr-only">{{
                  $i18n.t.value.humanInput.requiredA11yLabel
                }}</span>
              </template>
            </label>

            <div v-else class="space-y-1.5">
              <label
                :id="labelId(index)"
                class="text-sm leading-5 font-medium"
                :for="controlId(index)"
              >
                {{ field.label }}
                <template v-if="field.required">
                  <span class="text-destructive ml-0.5" aria-hidden="true"
                    >*</span
                  >
                  <span class="sr-only">{{
                    $i18n.t.value.humanInput.requiredA11yLabel
                  }}</span>
                </template>
              </label>

              <Textarea
                v-if="field.type === 'textarea'"
                :id="controlId(index)"
                class="min-h-20 resize-y text-sm"
                :readonly="isDisabled"
                :aria-disabled="isDisabled || undefined"
                :placeholder="field.placeholder"
                :model-value="stringFieldValue(field.name)"
                :aria-required="field.required || undefined"
                :aria-invalid="isInvalid(field.name) || undefined"
                :aria-describedby="
                  isInvalid(field.name) ? formErrorId : undefined
                "
                @update:model-value="handleFormValueChange(field.name, $event)"
              />

              <Select
                v-else-if="field.type === 'select'"
                :disabled="isDisabled"
                :model-value="stringFieldValue(field.name)"
                @update:model-value="
                  handleFormValueChange(field.name, $event as string)
                "
              >
                <SelectTrigger
                  :id="controlId(index)"
                  class="w-full"
                  :aria-labelledby="labelId(index)"
                  :aria-required="field.required || undefined"
                  :aria-invalid="isInvalid(field.name) || undefined"
                  :aria-describedby="
                    isInvalid(field.name) ? formErrorId : undefined
                  "
                >
                  <SelectValue
                    :placeholder="
                      field.placeholder ??
                      $i18n.t.value.humanInput.selectPlaceholder
                    "
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in field.options ?? []"
                    :key="option.id"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <div
                v-else-if="field.type === 'multi_select'"
                :id="controlId(index)"
                class="flex flex-wrap gap-2"
                role="group"
                :aria-labelledby="labelId(index)"
                :aria-describedby="
                  isInvalid(field.name) ? formErrorId : undefined
                "
              >
                <Button
                  v-for="option in field.options ?? []"
                  :key="option.id"
                  :class="
                    cn(
                      'h-8 w-fit rounded-md px-2.5 text-left leading-5 whitespace-normal',
                      selectedFieldValues(field.name).includes(option.value) &&
                        'border-primary/40 bg-primary/10',
                    )
                  "
                  :aria-pressed="
                    selectedFieldValues(field.name).includes(option.value)
                  "
                  :disabled="isDisabled"
                  type="button"
                  variant="outline"
                  @click="toggleMultiSelect(field, option)"
                >
                  <span
                    :class="
                      cn(
                        'border-border flex size-3.5 shrink-0 items-center justify-center rounded-sm border',
                        selectedFieldValues(field.name).includes(
                          option.value,
                        ) &&
                          'border-primary bg-primary text-primary-foreground',
                      )
                    "
                    aria-hidden="true"
                  >
                    <CheckIcon
                      v-if="
                        selectedFieldValues(field.name).includes(option.value)
                      "
                      class="size-2.5"
                    />
                  </span>
                  {{ option.label }}
                </Button>
              </div>

              <Input
                v-else
                :id="controlId(index)"
                class="text-sm"
                :disabled="isDisabled"
                :placeholder="field.placeholder"
                :type="
                  field.type === 'number'
                    ? 'number'
                    : field.type === 'date'
                      ? 'date'
                      : 'text'
                "
                :model-value="stringFieldValue(field.name)"
                :aria-required="field.required || undefined"
                :aria-invalid="isInvalid(field.name) || undefined"
                :aria-describedby="
                  isInvalid(field.name) ? formErrorId : undefined
                "
                @update:model-value="handleFormValueChange(field.name, $event)"
              />
            </div>
          </template>

          <div
            class="flex min-h-9 flex-wrap items-center justify-between gap-2"
          >
            <p
              v-if="error"
              :id="formErrorId"
              class="text-destructive text-sm"
              role="alert"
            >
              {{ error }}
            </p>
            <p
              v-else-if="answered"
              class="text-muted-foreground text-sm"
              aria-live="polite"
            >
              {{ $i18n.t.value.humanInput.answeredValue(answered.value) }}
            </p>
            <span v-else />
            <Button
              class="min-w-24"
              :disabled="isDisabled"
              type="submit"
              variant="secondary"
            >
              <Loader2Icon v-if="pending" class="size-4 animate-spin" />
              {{ $i18n.t.value.humanInput.submit }}
            </Button>
          </div>
        </form>

        <div v-if="!isForm && options.length > 0" class="grid gap-2">
          <Button
            v-for="option in options"
            :key="option.id"
            class="min-h-11 w-full justify-start rounded-md px-3 py-2 text-left leading-5 whitespace-normal"
            :disabled="isDisabled"
            type="button"
            variant="outline"
            @click="handleOptionClick(option)"
          >
            <span class="min-w-0 wrap-break-word whitespace-pre-wrap">
              {{ option.label }}
            </span>
          </Button>
        </div>

        <form
          v-if="allowText"
          class="space-y-2"
          @submit.prevent="handleTextSubmit"
        >
          <label class="sr-only" :for="textInputId">{{
            $i18n.t.value.humanInput.otherLabel
          }}</label>
          <Textarea
            :id="textInputId"
            :aria-invalid="Boolean(error)"
            :aria-describedby="error ? textErrorId : undefined"
            class="min-h-20 resize-y text-sm"
            :readonly="isDisabled"
            :aria-disabled="isDisabled || undefined"
            :placeholder="$i18n.t.value.humanInput.otherPlaceholder"
            :model-value="text"
            @update:model-value="handleTextInput"
            @compositionend="compositionActive = false"
            @compositionstart="compositionActive = true"
            @keydown="handleTextKeyDown"
          />
          <div
            class="flex min-h-9 flex-wrap items-center justify-between gap-2"
          >
            <p v-if="error" :id="textErrorId" class="text-destructive text-sm">
              {{ error }}
            </p>
            <p
              v-else-if="answered"
              class="text-muted-foreground text-sm"
              aria-live="polite"
            >
              {{ $i18n.t.value.humanInput.answeredValue(answered.value) }}
            </p>
            <span v-else />
            <Button
              class="min-w-24"
              :disabled="isDisabled"
              type="submit"
              variant="secondary"
            >
              <Loader2Icon v-if="pending" class="size-4 animate-spin" />
              {{ $i18n.t.value.humanInput.submit }}
            </Button>
          </div>
        </form>

        <p
          v-if="!allowText && !isForm && answered"
          class="text-muted-foreground text-sm"
          aria-live="polite"
        >
          {{ $i18n.t.value.humanInput.answeredValue(answered.value) }}
        </p>
      </div>
    </div>
  </section>
</template>
