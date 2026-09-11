<script setup lang="ts">
/*
  【文件职责】     采集一个 channel provider 的运行时凭据，提交给调用方。
  【架构位置】     L3 product UI
  【主要导出】     默认 ChannelRuntimeConfigDialog 组件
  【依赖关系】     ui/dialog · ui/button · channels types
  【边界与注意】   对照 frontend/src/components/workspace/channels/channel-runtime-config-dialog.tsx。

                   侧栏与设置页都要开这个表单，所以它是**一个共享组件**而不是各写一份：
                   凭据字段的种子、密文遮挡与提交语义只有一处，改一次两处都改到。

                   values 由本组件自己持有，每次打开时从 provider.credential_values 重新播种，
                   与 React 的 useEffect 同义。让调用方持有会多出一条「谁负责清空」的约定，
                   而那正是上一版把 editing/values 两个 ref 摆在设置页里时踩到的地方。

                   密文字段用 -webkit-text-security 遮挡而不是 type="password"：后端回的是
                   掩码占位串，浏览器与密码管理器不该把它当成一次真实的登录输入，
                   data-lpignore / data-1p-ignore / data-bwignore 是同一个目的。
*/

import { LoaderCircle } from "lucide-vue-next";
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
import type {
  ChannelProvider,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";

const props = defineProps<{
  provider: ChannelProvider | null;
  open: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  submit: [provider: ChannelProvider, values: ChannelRuntimeConfigValues];
}>();

const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels);

const values = ref<ChannelRuntimeConfigValues>({});
const fields = computed(() => props.provider?.credential_fields ?? []);
const isEditing = computed(() => props.provider?.configured ?? false);

watch(
  () => [props.open, props.provider] as const,
  ([open, provider]) => {
    if (!open || !provider) {
      values.value = {};
      return;
    }
    const seeded = provider.credential_values ?? {};
    values.value = Object.fromEntries(
      (provider.credential_fields ?? []).map((field) => [
        field.name,
        seeded[field.name] ?? "",
      ]),
    );
  },
  { immediate: true },
);

function onSubmit() {
  if (props.provider) emit("submit", props.provider, { ...values.value });
}

function fieldId(field: { name: string }) {
  return `channel-${props.provider?.provider}-${field.name}`;
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      v-if="provider"
      :close-label="$i18n.t.value.primitives.close"
    >
      <form class="space-y-4" @submit.prevent="onSubmit">
        <DialogHeader>
          <DialogTitle>
            {{
              isEditing
                ? text.setupEditTitle(provider.display_name)
                : text.setupTitle(provider.display_name)
            }}
          </DialogTitle>
          <DialogDescription>{{ text.setupDescription }}</DialogDescription>
        </DialogHeader>

        <div class="space-y-3">
          <div v-for="field in fields" :key="field.name" class="space-y-1.5">
            <label
              :for="fieldId(field)"
              class="text-sm leading-none font-medium"
            >
              {{ field.label }}
            </label>
            <!--
              走 `ui/input`（上游同一处也是 `<Input>`，
              `channel-runtime-config-dialog.tsx:113`）。这里原来是**把 primitive
              的整串基类抄进 `class`**——今天看起来一样，但 `Input.vue` 一改就悄悄分叉，
              而且抄的那一份已经漏了 `aria-invalid:` 与 `placeholder:` / `selection:`
              那几段。
            -->
            <Input
              :id="fieldId(field)"
              v-model="values[field.name]"
              type="text"
              :required="field.required"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              :data-1p-ignore="field.type === 'password' ? 'true' : undefined"
              :data-bwignore="field.type === 'password' ? 'true' : undefined"
              :data-form-type="field.type === 'password' ? 'other' : undefined"
              :data-lpignore="field.type === 'password' ? 'true' : undefined"
              :class="field.type === 'password' ? 'channel-secret-input' : ''"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="submitting"
            @click="emit('update:open', false)"
          >
            {{ $i18n.t.value.common.cancel }}
          </Button>
          <Button type="submit" :disabled="submitting">
            <LoaderCircle v-if="submitting" class="animate-spin" />
            {{ isEditing ? text.saveChanges : text.saveAndConnect }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.channel-secret-input {
  -webkit-text-security: disc;
}
</style>
