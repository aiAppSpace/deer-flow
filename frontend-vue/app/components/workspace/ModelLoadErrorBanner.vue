<script setup lang="ts">
/*
  【文件职责】     模型列表加载失败时的横幅与一次显式重试。
  【架构位置】     L3 product UI
  【主要导出】     默认 ModelLoadErrorBanner 组件
  【依赖关系】     useModels · ui/alert · ui/button
  【边界与注意】   **以 `enabled: false` 观察这份共享查询，自己不发请求**：
                   真正加载由模型选择器等消费者负责，这里只是把它们的失败集中
                   反馈一次。挂成 enabled 的话，一个只想报错的横幅会自己去拉一遍模型。

                   **错误要记住，不能跟着共享查询一起闪**：另一个观察者重取时，
                   TanStack 会先把这份查询的 error 清掉；不记住的话横幅会在
                   重试期间消失一瞬、失败后又出现。所以只在「不再 fetching」时才清。

                   401 不显示：那条错误已经触发了登录跳转，再报一句「模型加载失败」
                   是重复且误导的。Gateway 整体不可用时也不显示——那由
                   GatewayStatusBanner 说，两条横幅叠在一起只会互相干扰。
*/

import { computed, ref, watch } from "vue";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useModels } from "@/composables/useModels";
import { UnauthorizedError } from "@/core/api/errors";

const props = defineProps<{
  /** Gateway 整体不可用：那一档由 GatewayStatusBanner 负责说。 */
  gatewayUnavailable?: boolean;
}>();

const { $i18n } = useNuxtApp();
const { error, fetching, refetch } = useModels({ enabled: false });

const retrying = ref(false);
/** 记住最近一次可见的错误，直到共享查询真的有了结论。 */
const stickyError = ref<Error | null>(null);
watch(
  [error, fetching],
  ([currentError, isFetching]) => {
    if (currentError) stickyError.value = currentError as Error;
    else if (!isFetching) stickyError.value = null;
  },
  { immediate: true },
);

const visibleError = computed(
  () => (error.value as Error | null) ?? stickyError.value,
);
const visible = computed(() => {
  if (!visibleError.value && !retrying.value) return false;
  if (visibleError.value instanceof UnauthorizedError) return false;
  return props.gatewayUnavailable !== true;
});

async function retry() {
  retrying.value = true;
  try {
    await refetch();
  } finally {
    retrying.value = false;
  }
}
</script>

<template>
  <Alert
    v-if="visible"
    variant="destructive"
    class="border-destructive/20 bg-destructive/10 rounded-none border-x-0 border-t-0 px-4 py-2"
    data-testid="model-load-error-banner"
  >
    <AlertDescription
      class="text-destructive flex w-full items-center justify-between gap-3"
    >
      <span class="min-w-0">{{ $i18n.t.value.workspace.modelLoadFailed }}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="retrying"
        :aria-busy="retrying"
        class="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10 h-7 bg-transparent px-3 text-xs shadow-none dark:bg-transparent"
        @click="retry"
      >
        {{
          retrying
            ? $i18n.t.value.workspace.modelLoadRetrying
            : $i18n.t.value.workspace.modelLoadRetry
        }}
      </Button>
    </AlertDescription>
  </Alert>
</template>
