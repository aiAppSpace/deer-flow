/*
  【文件职责】     把 React 同源的 base settings/thread model store 暴露为 Vue 响应式状态。
  【架构位置】     L3 Vue 状态适配
  【主要导出】     useThreadSettings
  【依赖关系】     core/settings/local · store
  【边界与注意】   scope 使用实际或预创建的 thread id，与 React 共用模型覆盖键。
*/

import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import {
  applyThreadModelOverride,
  type LocalSettings,
} from "@/core/settings/local";
import {
  getBaseSettingsSnapshot,
  getThreadModelSnapshot,
  subscribe,
  resolveThreadContext,
  updateThreadSettings,
  type LocalSettingsSetter,
} from "@/core/settings/store";

/** Reactive Vue adapter for React-equivalent base settings + thread model. */
export function useThreadSettings(scopeInput: MaybeRefOrGetter<string>) {
  const scope = computed(() => toValue(scopeInput));
  const settings = ref<LocalSettings>(getBaseSettingsSnapshot());

  function refresh() {
    settings.value = applyThreadModelOverride(
      getBaseSettingsSnapshot(),
      getThreadModelSnapshot(scope.value),
    );
  }

  const unsubscribe = subscribe(refresh);
  watch(scope, refresh, { immediate: true });
  onScopeDispose(unsubscribe);

  const update: LocalSettingsSetter = (key, value) => {
    updateThreadSettings(scope.value, key, value);
  };

  const resolve = (context: Partial<LocalSettings["context"]>) => {
    resolveThreadContext(scope.value, context);
  };

  return { settings, update, resolve };
}
