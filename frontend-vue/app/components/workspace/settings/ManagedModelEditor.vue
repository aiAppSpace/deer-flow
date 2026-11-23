<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue";
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
  modelDraft,
  saveManagedModel,
  testManagedModel,
  type ManagedModel,
} from "@/core/models/management";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{
  model?: ManagedModel;
  saved: () => Promise<void>;
}>();
const emit = defineEmits<{ close: [] }>();
const { $i18n } = useNuxtApp(),
  toast = useWorkspaceToast();
const text = computed(() => $i18n.t.value.settings.models);
const draft = ref(modelDraft(props.model)),
  key = ref(""),
  clearKey = ref(false),
  pending = ref(false),
  result = ref("");
let active = true,
  abort: AbortController | undefined;
onScopeDispose(() => {
  active = false;
  abort?.abort();
  key.value = "";
});
function body() {
  return {
    config: {
      ...draft.value,
      ...(clearKey.value
        ? { api_key: "" }
        : key.value
          ? { api_key: key.value }
          : {}),
    },
    expected_revision: props.model?.revision ?? null,
  };
}
async function submit(test: boolean) {
  if (pending.value) return;
  pending.value = true;
  result.value = "";
  try {
    if (test) {
      abort = new AbortController();
      const response = await testManagedModel(body(), abort.signal);
      if (active) result.value = text.value[response.message];
    } else {
      await saveManagedModel(body());
      if (!active) return;
      await props.saved();
      if (active) {
        toast.success(text.value.saved);
        emit("close");
      }
    }
  } catch (error) {
    if (active)
      result.value = error instanceof Error ? error.message : text.value.failed;
  } finally {
    if (active) pending.value = false;
  }
}
function numeric(event: Event, field: "context_window" | "max_tokens") {
  const value = (event.target as HTMLInputElement).value;
  draft.value[field] = value ? Number(value) : null;
}
</script>

<template>
  <Dialog
    :open="true"
    @update:open="
      (open: boolean) => {
        if (!open && !pending) emit('close');
      }
    "
  >
    <DialogContent
      class="flex h-[90vh] flex-col overflow-hidden max-md:overflow-y-auto"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader class="shrink-0"
        ><DialogTitle>{{ model ? text.edit : text.add }}</DialogTitle
        ><DialogDescription>{{
          text.formDescription
        }}</DialogDescription></DialogHeader
      >
      <form
        class="flex min-h-0 flex-1 flex-col gap-3 max-md:flex-none"
        @submit.prevent="submit(false)"
      >
        <div class="min-h-0 flex-1 overflow-y-auto pr-1">
          <fieldset :disabled="pending" class="space-y-3">
            <p class="text-sm">
              {{ text.provider }}: {{ text.providerOpenAICompatible }}
            </p>
            <label class="block space-y-1"
              ><span>{{ text.name }}</span
              ><Input
                v-model="draft.name"
                required
                pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,99}"
                :disabled="!!model"
            /></label>
            <label class="block space-y-1"
              ><span>{{ text.displayName }}</span
              ><Input v-model="draft.display_name" :maxlength="100"
            /></label>
            <label class="block space-y-1"
              ><span>{{ text.endpoint }}</span
              ><Input
                v-model="draft.base_url"
                type="url"
                required
                placeholder="https://api.example.com/v1"
                @input="result = ''"
            /></label>
            <label class="block space-y-1"
              ><span>{{ text.modelId }}</span
              ><Input
                v-model="draft.model"
                required
                :maxlength="200"
                @input="result = ''"
            /></label>
            <label class="block space-y-1"
              ><span>{{ text.apiKey }}</span
              ><Input
                v-model="key"
                type="password"
                autocomplete="new-password"
                :disabled="clearKey"
                :placeholder="
                  model?.has_api_key ? text.keepKey : text.optionalKey
                "
                @input="result = ''"
            /></label>
            <label v-if="model?.has_api_key" class="flex items-center gap-2"
              ><input
                v-model="clearKey"
                type="checkbox"
                @change="
                  key = '';
                  result = '';
                "
              />{{ text.clearKey }}</label
            >
            <label class="block space-y-1"
              ><span>{{ text.contextWindow }}</span
              ><Input
                type="number"
                :min="1"
                :step="1"
                :model-value="draft.context_window ?? ''"
                @input="numeric($event, 'context_window')"
            /></label>
            <label class="block space-y-1"
              ><span>{{ text.maxTokens }}</span
              ><Input
                type="number"
                :min="1"
                :step="1"
                :model-value="draft.max_tokens ?? ''"
                @input="numeric($event, 'max_tokens')"
            /></label>
            <label class="flex items-center gap-2"
              ><input v-model="draft.supports_vision" type="checkbox" />{{
                text.vision
              }}</label
            >
          </fieldset>
        </div>
        <p v-if="result" role="status" class="text-sm">{{ result }}</p>
        <DialogFooter class="shrink-0"
          ><Button
            type="button"
            variant="outline"
            :disabled="pending"
            @click="emit('close')"
            >{{ text.cancel }}</Button
          ><Button
            type="button"
            variant="outline"
            :disabled="
              pending || !draft.name || !draft.model || !draft.base_url
            "
            @click="submit(true)"
            >{{ text.test }}</Button
          ><Button type="submit" :disabled="pending">{{
            pending ? text.working : text.save
          }}</Button></DialogFooter
        >
      </form>
    </DialogContent>
  </Dialog>
</template>
