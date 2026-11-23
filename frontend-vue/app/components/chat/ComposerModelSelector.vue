<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Check, Star } from "lucide-vue-next";
import {
  Popover,
  PopoverTrigger,
  PopoverPickerContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/composables/useAuthSession";
import { useModelFavorites } from "@/composables/useModelFavorites";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import { projectModelChoices } from "@/core/models/favorites";
import type { Model } from "@/core/models/types";

defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{
    models: readonly Model[];
    selectedModel?: Model;
    disabled?: boolean;
    testId?: string;
  }>(),
  {
    disabled: false,
    testId: "composer-model-selector",
    selectedModel: undefined,
  },
);
const emit = defineEmits<{ select: [model: Model] }>();
const { $i18n } = useNuxtApp();
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
const userId = computed(() =>
  auth.session.value?.tag === "authenticated"
    ? auth.session.value.user.id
    : authDisabled
      ? AUTH_DISABLED_USER.id
      : null,
);
const favorites = useModelFavorites(userId);
const open = ref(false);
const content = ref<InstanceType<typeof PopoverPickerContent> | null>(null);
let focusedControl: { name: string; favorite: boolean } | null = null;
const projection = computed(() =>
  projectModelChoices(props.models, favorites.names.value),
);
const groups = computed(() =>
  [
    {
      label: $i18n.t.value.modelPicker.favorites,
      models: projection.value.favorites,
    },
    {
      label: $i18n.t.value.modelPicker.otherModels,
      models: projection.value.others,
    },
  ].filter((group) => group.models.length),
);
const ordered = computed(() => [
  ...projection.value.favorites,
  ...projection.value.others,
]);
function recordFocus(name: string, favorite: boolean) {
  focusedControl = { name, favorite };
}
function controls() {
  return (
    content.value
      ?.getElement()
      ?.querySelectorAll<HTMLButtonElement>("[data-model-picker-option]") ?? []
  );
}
function focusInitial() {
  const list = Array.from(controls());
  (
    list.find((el) => el.dataset.modelName === props.selectedModel?.name) ??
    list[0]
  )?.focus();
}
watch(open, async (value) => {
  if (value) {
    await nextTick();
    if (open.value) focusInitial();
  }
});
function select(model: Model) {
  if (props.disabled) return;
  emit("select", model);
  open.value = false;
}
async function toggleFavorite(model: Model, event: MouseEvent) {
  if (
    auth.isFetching.value ||
    !favorites.canEdit.value ||
    !props.models.some((item) => item.name === model.name)
  )
    return;
  event.preventDefault();
  const control = { name: model.name, favorite: true };
  focusedControl = control;
  favorites.setFavorite(
    model.name,
    !favorites.names.value.includes(model.name),
  );
  await nextTick();
  if (open.value && focusedControl === control) focusControl(control);
}
function focusControl(control: NonNullable<typeof focusedControl>) {
  const attribute = control.favorite
    ? "data-model-favorite"
    : "data-model-name";
  const root = content.value?.getElement();
  Array.from(root?.querySelectorAll<HTMLButtonElement>(`[${attribute}]`) ?? [])
    .find((button) => button.getAttribute(attribute) === control.name)
    ?.focus();
}
watch(open, (value) => {
  if (!value) focusedControl = null;
});
watch(favorites.names, async () => {
  if (!open.value || !focusedControl) return;
  const control = focusedControl;
  await nextTick();
  if (
    open.value &&
    focusedControl === control &&
    document.activeElement === document.body
  )
    focusControl(control);
});
function onRowKeydown(event: KeyboardEvent, name: string) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const index = ordered.value.findIndex((model) => model.name === name);
  const next =
    ordered.value[
      (Math.max(index, 0) +
        (event.key === "ArrowDown" ? 1 : -1) +
        ordered.value.length) %
        ordered.value.length
    ];
  Array.from(controls())
    .find((el) => el.dataset.modelName === next?.name)
    ?.focus();
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        v-bind="$attrs"
        type="button"
        variant="ghost"
        size="sm"
        :data-testid="testId"
        :disabled="disabled"
        class="max-w-40 min-w-0 px-2.5 shadow-none sm:max-w-56"
      >
        <div class="flex min-w-0 flex-col items-start text-left">
          <span class="flex-1 truncate text-left text-xs">{{
            selectedModel?.display_name
          }}</span>
        </div>
      </Button>
    </PopoverTrigger>
    <PopoverPickerContent
      ref="content"
      :aria-label="$i18n.t.value.modelPicker.title"
      side="top"
      align="end"
      :side-offset="8"
      :collision-padding="8"
      @open-auto-focus="
        $event.preventDefault();
        focusInitial();
      "
    >
      <div class="min-h-0 overflow-x-hidden overflow-y-auto py-0.5">
        <div
          v-if="!ordered.length"
          class="text-muted-foreground py-6 text-center text-sm"
        >
          {{ $i18n.t.value.modelPicker.noModels }}
        </div>
        <section
          v-for="group in groups"
          :key="group.label"
          role="group"
          :aria-label="group.label"
        >
          <h3 class="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            {{ group.label }}
          </h3>
          <ul class="px-1 pb-0.5">
            <li
              v-for="model in group.models"
              :key="model.name"
              class="hover:bg-accent focus-within:bg-accent flex min-h-9 min-w-0 items-stretch rounded-sm"
            >
              <button
                type="button"
                class="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-l-sm px-2 py-1.5 outline-none focus-visible:ring-2"
                :aria-label="`${model.display_name} (${model.name})`"
                :aria-current="
                  model.name === selectedModel?.name ? 'true' : undefined
                "
                data-model-picker-option="true"
                :data-model-name="model.name"
                :data-current-model="
                  model.name === selectedModel?.name ? 'true' : undefined
                "
                @click="select(model)"
                @focus="recordFocus(model.name, false)"
                @keydown="onRowKeydown($event, model.name)"
              >
                <span class="flex min-w-0 flex-1 flex-col text-left"
                  ><span class="truncate text-xs">{{ model.display_name }}</span
                  ><span
                    class="text-muted-foreground truncate text-[10px] leading-4"
                    >{{ model.model }}</span
                  ></span
                >
                <Check
                  v-if="model.name === selectedModel?.name"
                  aria-hidden="true"
                  class="size-4 shrink-0"
                />
              </button>
              <Button
                v-if="userId !== null"
                type="button"
                variant="ghost"
                size="icon"
                class="size-8 shrink-0 rounded-l-none"
                :class="
                  favorites.names.value.includes(model.name)
                    ? 'text-amber-500'
                    : ''
                "
                :aria-label="
                  $i18n.t.value.modelPicker.favoriteModel(
                    model.display_name,
                    model.name,
                  )
                "
                :aria-pressed="favorites.names.value.includes(model.name)"
                :data-model-favorite="model.name"
                :disabled="auth.isFetching.value || !favorites.canEdit.value"
                @click="toggleFavorite(model, $event)"
                @focus="recordFocus(model.name, true)"
                @keydown="onRowKeydown($event, model.name)"
              >
                <Star
                  aria-hidden="true"
                  class="size-4"
                  :class="
                    favorites.names.value.includes(model.name) && 'fill-current'
                  "
                />
              </Button>
            </li>
          </ul>
        </section>
      </div>
      <p
        v-if="favorites.persistence.value === 'memory' && userId !== null"
        role="status"
        class="text-muted-foreground shrink-0 border-t px-3 py-2 text-xs"
      >
        {{ $i18n.t.value.modelPicker.sessionOnly }}
      </p>
    </PopoverPickerContent>
  </Popover>
</template>
