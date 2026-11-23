<!--
  【文件职责】     以真实原生分栏组件验证 H1/H2/H6。
  【架构位置】     测试夹具
  【主要导出】     /__m0/splitpanes 测试页
  【依赖关系】     消费 ResizablePanels；仅在 M0 测试开关开启时可用
  【边界与注意】   spike，不实现业务面板。
-->

<script setup lang="ts">
import { ref } from "vue";
import { ResizablePanels } from "@/components/ui/resizable";
import { isEnabledRuntimeFlag } from "@/core/auth/decision";

const config = useRuntimeConfig();
if (!isEnabledRuntimeFlag(config.public.m0TestPages)) {
  throw createError({ statusCode: 404 });
}

const panels = [
  { id: "main", minSize: 20 },
  { id: "right-1" },
  { id: "right-2" },
  { id: "right-3" },
];
const sizes = ref([55, 15, 15, 15]);
const resizeCount = ref(0);
const resizedCount = ref(0);

function collapseRightPanels() {
  sizes.value = [100, 0, 0, 0];
}

function restoreRightPanels() {
  sizes.value = [55, 15, 15, 15];
}
</script>

<template>
  <main class="bg-background text-foreground h-screen p-6">
    <div class="mb-4 flex items-center gap-3">
      <button
        data-collapse
        class="rounded border px-3 py-1"
        @click="collapseRightPanels"
      >
        Collapse
      </button>
      <button
        data-restore
        class="rounded border px-3 py-1"
        @click="restoreRightPanels"
      >
        Restore
      </button>
      <output data-resize-count>{{ resizeCount }}</output>
      <output data-resized-count>{{ resizedCount }}</output>
    </div>
    <ResizablePanels
      data-pane-group
      class="h-[420px]"
      :panels="panels"
      :sizes="sizes"
      owner-key="m0-resizable"
      @resize="resizeCount += 1"
      @resized="resizedCount += 1"
    >
      <template #main
        ><div data-pane="main" class="h-full p-4">Main</div></template
      >
      <template
        v-for="(panel, index) in panels.slice(1)"
        :key="panel.id"
        #[panel.id]
      >
        <div :data-pane="panel.id" class="h-full p-4">
          Right {{ index + 1 }}
        </div>
      </template>
    </ResizablePanels>
  </main>
</template>
