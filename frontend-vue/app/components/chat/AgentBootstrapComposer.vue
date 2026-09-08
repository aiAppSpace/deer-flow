<script setup lang="ts">
/*
  【文件职责】     创建 custom agent 时引导对话用的极简输入框：只有文本框和发送键。
  【架构位置】     L3
  【主要导出】     默认 AgentBootstrapComposer 组件
  【依赖关系】     ComposerSurface · i18n primitives
  【边界与注意】   上游 agents/new/page.tsx 在 agent 还没建出来这一步用的是裸
                   `<PromptInput><PromptInputTextarea/><PromptInputFooter><PromptInputSubmit/>
                   </PromptInputFooter></PromptInput>`——没有附件、语音、润色、模式/模型
                   选择器，`onSubmit` 也只读文本、`files` 恒为空数组。AgentChat.vue 原来在
                   整段引导对话期间都用完整 ChatComposer，于是创建 agent 时 Vue 比 React
                   多出一整排控件。这个组件只补上游这一段最简界面本身，不接手 bootstrap
                   状态机——generation/草稿/goal/compact 都不适用于这里，AgentChat.vue 仍
                   通过 `submitMessage`（也就是它自己的 `send()`）拥有实际发送逻辑。
                   与 ChatComposer 一样不禁用空草稿之外的状态：`disabled` 由调用方传入
                   （对应上游的 `thread.isLoading`），提交前的空文本判断在 `submit()` 里。

                   **聚焦用 onMounted 而不是 `autofocus` 属性**：上游那个
                   `<PromptInputTextarea autoFocus>` 里的 autoFocus 是 React 的 prop，
                   React 在 commit 阶段**imperative 地调 `.focus()`**；而 HTML 的
                   `autofocus` 属性只在文档加载阶段的 autofocus candidates 里被处理，
                   对**加载完成之后才插入**的元素基本不生效——本组件正是这一种（用户在
                   名称步骤点「继续」之后 AgentChat 才挂载）。写成属性会静默地不聚焦。
                   **锁住时用 `readonly` 而不是 `disabled`**，与主输入框同一条理由
                   （wave 178 实测：给正被聚焦的控件置 `disabled`，浏览器当场失焦，
                   摘掉 `disabled` 也不还回来）。顺带一个结果：挂载瞬间若正在流式，
                   此前 `disabled` 为真、`.focus()` 按规范是 no-op，现在能聚上了
                   ——**上游同改，两边仍然同构**。提交的门在 `submit()` 里。
*/
import { onMounted, ref } from "vue";
import { ArrowUp } from "lucide-vue-next";
import ComposerSurface from "@/components/chat/ComposerSurface.vue";
import { Button } from "@/components/ui/button";
import { isImeComposing } from "@/core/input/ime";

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ send: [text: string] }>();
const { $i18n } = useNuxtApp();

const input = ref("");
const textarea = ref<HTMLTextAreaElement | null>(null);
const compositionActive = ref(false);

function submit() {
  const text = input.value.trim();
  if (!text || props.disabled) return;
  input.value = "";
  emit("send", text);
}

function onKeydown(event: KeyboardEvent) {
  if (isImeComposing(event, compositionActive.value)) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}

onMounted(() => textarea.value?.focus());
</script>

<template>
  <form
    class="mx-auto w-full"
    data-testid="agent-bootstrap-composer"
    @submit.prevent="submit"
  >
    <ComposerSurface>
      <div data-slot="input-group-body">
        <textarea
          ref="textarea"
          v-model="input"
          name="message"
          data-slot="input-group-control"
          data-testid="agent-bootstrap-composer-textarea"
          rows="1"
          :placeholder="$i18n.t.value.agents.createPageSubtitle"
          class="field-sizing-content max-h-48 min-h-6! w-full min-w-0 resize-none bg-transparent p-0! text-base leading-6! outline-none focus-visible:ring-0 focus-visible:outline-none md:text-sm"
          :readonly="disabled"
          :aria-disabled="disabled || undefined"
          @keydown="onKeydown"
          @compositionstart="compositionActive = true"
          @compositionend="compositionActive = false"
        />
      </div>
      <div role="group" data-slot="input-group-footer" class="justify-end">
        <!--
          上游 `workspace/agents/new/page.tsx:455` 是**裸的**
          `<PromptInputSubmit disabled={thread.isLoading} />`——不传 className，
          于是它是 `<InputGroupButton variant="default" size="icon-sm">`：
          **`rounded-md` 的圆角方钮**，不是圆的。主输入框与 sidecar 那两颗
          之所以是圆的，是因为它们各自显式传了 `className="rounded-full"`；
          这一颗没有。手写那版画成了 `rounded-full`，于是建 agent 那一屏
          发送键在两个应用里一个是圆的一个是方的。

          另外少 `hover:bg-primary/90`（悬停无反应）、`cursor-pointer`、
          3px 焦点环、`disabled:pointer-events-none` 与 `shadow-none`
          （InputGroupButton 的 base 有它）。
        -->
        <Button
          type="submit"
          size="icon-sm"
          class="shadow-none"
          data-testid="agent-bootstrap-composer-submit"
          :aria-label="$i18n.t.value.primitives.submit"
          :disabled="disabled"
        >
          <ArrowUp class="size-4" />
        </Button>
      </div>
    </ComposerSurface>
  </form>
</template>
