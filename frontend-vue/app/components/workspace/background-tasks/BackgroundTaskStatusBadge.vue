<!--
  【文件职责】     把一个后台任务状态画成带图标的徽章。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/badge · core/background-tasks
  【边界与注意】   六个状态**各有各的图标和颜色**，不是同一颗点换个字。
                   这一排卡片扫过去时，用户是靠颜色和形状分辨的，文字要凑近才看得清。
                   working 那颗会转——它是唯一一个「还在动」的状态。
-->

<script setup lang="ts">
import { computed, type Component } from "vue";
import {
  CircleCheck,
  CircleStop,
  Clock3,
  LoaderCircle,
  MessageCircleQuestion,
  TriangleAlert,
} from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import type { BackgroundTaskStatus } from "@/core/background-tasks";

const props = defineProps<{
  status: BackgroundTaskStatus;
  /** 正在取消：徽章改说「正在取消…」，但图标仍是当前状态的。 */
  cancelling?: boolean;
}>();

const { $i18n } = useNuxtApp();

interface StatusPresentation {
  icon: Component;
  labelKey: keyof typeof $i18n.t.value.backgroundTasks.status;
  className: string;
  spinning: boolean;
}

const PRESENTATION: Record<BackgroundTaskStatus, StatusPresentation> = {
  submitted: {
    icon: Clock3,
    labelKey: "submitted",
    className: "text-blue-700 dark:text-blue-300",
    spinning: false,
  },
  working: {
    icon: LoaderCircle,
    labelKey: "working",
    className: "text-blue-700 dark:text-blue-300",
    spinning: true,
  },
  input_required: {
    icon: MessageCircleQuestion,
    labelKey: "inputRequired",
    className: "text-amber-700 dark:text-amber-300",
    spinning: false,
  },
  completed: {
    icon: CircleCheck,
    labelKey: "completed",
    className: "text-emerald-700 dark:text-emerald-300",
    spinning: false,
  },
  failed: {
    icon: TriangleAlert,
    labelKey: "failed",
    className: "text-destructive",
    spinning: false,
  },
  cancelled: {
    icon: CircleStop,
    labelKey: "cancelled",
    className: "text-muted-foreground",
    spinning: false,
  },
};

const presentation = computed(() => PRESENTATION[props.status]);
const label = computed(() =>
  props.cancelling
    ? $i18n.t.value.backgroundTasks.cancelling
    : $i18n.t.value.backgroundTasks.status[presentation.value.labelKey],
);
</script>

<template>
  <Badge variant="outline" :class="['shrink-0', presentation.className]">
    <component
      :is="presentation.icon"
      :class="['size-3', presentation.spinning && 'animate-spin']"
    />
    {{ label }}
  </Badge>
</template>
