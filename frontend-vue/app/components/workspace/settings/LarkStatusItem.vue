<!--
  【文件职责】     Lark 集成状态网格里的一格：名称、就绪徽标与说明。
  【架构位置】     L3 workspace settings
  【主要导出】     默认 LarkStatusItem 组件
  【依赖关系】     ui/badge · lucide-vue-next · i18n
  【边界与注意】   逐行对照 React integrations-settings-page.tsx 里的 StatusItem。
                   四格（技能包 / Gateway CLI / 授权 / sandbox runtime）共用同一格，
                   包括 sandbox runtime——它此前少了徽标，于是四格里只有它读不出
                   Ready/Pending。
                   说明用 div 而不是 p：React 的这一格全是 div，读屏器把整片网格
                   念成一段连续文本；换成 p 会把它切成四段 paragraph。
-->

<script setup lang="ts">
import { CheckCircle2, XCircle } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";

defineProps<{ label: string; ok: boolean; value: string }>();

const { $i18n } = useNuxtApp();
</script>

<template>
  <div class="rounded-lg border p-3">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="text-sm font-medium">{{ label }}</div>
      <Badge :variant="ok ? 'secondary' : 'outline'">
        <CheckCircle2 v-if="ok" class="size-3" />
        <XCircle v-else class="size-3" />
        {{
          ok
            ? $i18n.t.value.settings.integrations.ready
            : $i18n.t.value.settings.integrations.pending
        }}
      </Badge>
    </div>
    <!--
      **`break-words`在这里对尺寸是空转的**：按 css-text-3，
      `overflow-wrap: break-word` 新增的换行机会不计入 min-content，
      这一格因此仍然缩不到它装着的那个字面量以下（实测
      `…(LARK_CLI_INIT_IMAGE)` 是 162.6px）——而上面那句 scope 说明让开之后，
      **顶着状态网格、进而顶着整块面板的就是它**。`anywhere` 才计入，
      也正是这颗类原本想要的行为。
    -->
    <div class="text-muted-foreground text-sm wrap-anywhere">{{ value }}</div>
  </div>
</template>
