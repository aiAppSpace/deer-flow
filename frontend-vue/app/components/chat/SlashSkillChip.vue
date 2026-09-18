<!--
  【文件职责】     `/skill` 激活的那颗胶囊：输入区里可移除，会话流里只读。
  【架构位置】     L3
  【主要导出】     默认 SlashSkillChip 组件
  【依赖关系】     lucide-vue-next 的 X · cn
  【边界与注意】   **一份视觉，两个调用点**——与上游 `slash-skill-chip.tsx` 的存在
                   理由逐字相同：输入区那颗要能移除，会话流那颗只读，两处必须同形，
                   分成两份写迟早会各自漂走。

                   **2026-09-18 第四十四轮补的，之前本仓两处都没有**：
                   - 输入区画的是一个纯 `<span class="bg-secondary … rounded px-2 py-1">`
                     ——**没有移除入口**。选中一个斜杠技能之后，鼠标用户没有任何
                     办法把它取消掉（上游点那颗 X 就回到普通输入），只能把整段文字删掉；
                     颜色也不是上游的 `primary` 那一档。
                   - 会话流里**一个字都没画**：`resolveSlashSkillDisplay` 早就实现了
                     并且有单测，但**没有任何组件调用它**，于是一条 `/data-analysis 做点事`
                     的提问在本仓显示成整行裸文本，上游显示成「胶囊 + 剩下的话」。

                   **为什么台账一直是 0**：这两处都只在「选中了斜杠技能」之后才存在，
                   而在这一轮之前**没有任何对照终态停在那个状态上**——`ChatComposer.vue`
                   自己的注释里写着「取样发生在无 chip 的稳定态」，那句话就是这块盲区
                   的自白。这一轮给 `sidebar` 补了 `#slash-selected` 终态，它从此进台账。

                   **发现它的不是台账，是键盘**：按 Tab 走一圈时上游多出一颗
                   `button "Remove /data-analysis"`，本仓那一位是空的。

                   `CHIP_BASE_CLASS` 是**照抄上游的串**（slash-skill-chip.tsx:10），
                   连同 `font-mono`、`shadow-xs` 与 `leading-none`。改它之前先问上游改没改。

                   可访问名走 `primitives.removeSlashSkill`：上游那一句
                   `Remove /${name}` **写死英文、不进它自己的词典**，所以两种语言
                   同一串（同 `close` / `toggleSidebar` 的判据，见 primitives 那段注释）。
-->

<script setup lang="ts">
import { X } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    name: string;
    class?: string;
    /** 传了才画成可移除的按钮；不传就是会话流里的只读胶囊。 */
    removable?: boolean;
  }>(),
  { class: undefined, removable: false },
);

const emit = defineEmits<{ remove: [] }>();

/** 逐字照抄上游 slash-skill-chip.tsx:10 的 CHIP_BASE_CLASS。 */
const CHIP_BASE_CLASS =
  "border-primary/20 bg-primary/10 text-primary inline-flex h-6 shrink-0 items-center rounded-md border px-1.5 font-mono text-xs leading-none font-medium shadow-xs";
</script>

<template>
  <button
    v-if="props.removable"
    type="button"
    :aria-label="$i18n.t.value.primitives.removeSlashSkill(props.name)"
    :class="
      cn(
        CHIP_BASE_CLASS,
        'hover:bg-primary/20 cursor-pointer gap-1 transition-colors',
        props.class,
      )
    "
    @click="emit('remove')"
  >
    <span class="min-w-0 truncate">/{{ props.name }}</span>
    <X class="text-primary/70 size-2.5 shrink-0" />
  </button>
  <span v-else :class="cn(CHIP_BASE_CLASS, 'max-w-full', props.class)">
    /{{ props.name }}
  </span>
</template>
