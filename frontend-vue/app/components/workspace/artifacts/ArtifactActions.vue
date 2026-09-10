<script setup lang="ts">
/*
  【文件职责】     展示 artifact 的编辑、复制、打开、下载和 skill install 动作。
  【架构位置】     L3
  【主要导出】     默认 ArtifactActions 组件
  【依赖关系】     ArtifactPanel
  【边界与注意】   只表达已判定的能力；HTTP、权限、revision 与 stale 仍由父层 owner 处理。
                   名字用通用词典键（common.* / clipboard.* / artifactEditing.*），不是
                   artifact 专有的一套。React 的 ArtifactAction 把 tooltip 原样写进
                   sr-only，而它传的就是这些通用键
                   （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx），
                   所以这里念出来的是 "Copy to clipboard" 而不是 "Copy artifact"。
                   同一个动作在两个应用里必须叫同一个名字，否则一份共用的读屏脚本
                   在其中一边找不到控件。
*/
import { computed } from "vue";
import {
  Copy,
  Download,
  Package,
  Pencil,
  PencilOff,
  RotateCcw,
  Save,
  SquareArrowOutUpRight,
} from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const props = withDefaults(
  defineProps<{
    canEdit: boolean;
    editing: boolean;
    dirty: boolean;
    conflict: boolean;
    streaming: boolean;
    saving: boolean;
    canCopy: boolean;
    copyDisabled: boolean;
    canOpen: boolean;
    canDownload: boolean;
    canInstall: boolean;
    installing: boolean;
    /**
     * 「打开」和「下载」拿到的是**已保存的那一份**。
     *
     * 表格预览是唯一会让人误会的场合：草稿改了几行，预览里也确实是改过的样子，
     * 但这两颗键给的是服务器上那份。上游只在 `isTabular && isDirty` 时把这两颗的
     * tooltip 换成这句提醒（artifact-file-detail.tsx）——别的类型不换，因为
     * 那边预览与草稿本来就长得不一样，看得出来。
     *
     * 给默认值而不是设成必填：`mount()` 的 props 不走严格检查，写成必填也拦不住
     * 漏传，那样只会得到一个「静默 undefined」——不如让默认行为就是不提示。
     */
    savedVersionHint?: boolean;
  }>(),
  { savedVersionHint: false },
);
const { $i18n } = useNuxtApp();
/*
  保存键的名字随状态变（上游把 tooltip 原样写进 sr-only，所以两处是同一句）。
  抽成 computed 是因为模板里要用两次——写两遍迟早分叉。
*/
/** 打开/下载这两颗的 tooltip：见 `savedVersionHint` 那段。 */
function gatewayTooltip(fallback: string): string {
  return props.savedVersionHint
    ? $i18n.t.value.artifactTable.savedVersion
    : fallback;
}

const saveLabel = computed(() =>
  props.streaming
    ? $i18n.t.value.artifactEditing.runInProgress
    : props.conflict
      ? $i18n.t.value.artifactEditing.conflict
      : $i18n.t.value.common.save,
);
const emit = defineEmits<{
  edit: [];
  save: [];
  exit: [];
  discard: [];
  copy: [];
  open: [];
  download: [];
  install: [];
}>();
</script>

<template>
  <!--
    上游 `ArtifactAction`（ai-elements/artifact.tsx:109）三件事本仓此前都差着：

    ① **每一颗都包 `<Tooltip>`**。本仓只有安装那颗挂了原生 `title`，
       其余七颗纯图标键**鼠标 hover 什么都不出**——aria-label 只解决读屏器，
       不解决看得见的那半边。文件头原来写着「用 aria-label 代替上游的 tooltip
       机制」，那句只对了一半。
    ② 图标是 `size-4` = **16px**，本仓八颗全写着 15px。
    ③ 三颗画的是**别的字形**：编辑 `Edit3`(=PenLine) 而上游 `PencilIcon`(=Pencil)；
       退出编辑 `X` 而上游 `PencilOffIcon`（带斜线的铅笔，"停止编辑"，
       跟"关闭"不是一个意思）；新窗口打开 `ExternalLink` 而上游
       `SquareArrowOutUpRightIcon`。

    tooltip 的文案与 aria-label 同源（上游 `label || tooltip` 写进 sr-only、
    tooltip 显示同一句），只有安装那颗是两句：名字 `common.install`，
    说明 `toolCalls.skillInstallTooltip`。

    ④ 八颗全是**手写 `<button>` 自己画外观**（`hover:bg-accent flex size-8
       items-center justify-center rounded-md`），少了 Button primitive 的四样：
       **`disabled:opacity-50` / `disabled:pointer-events-none`**——保存与复制
       在禁用时和能点长得一模一样；**`focus-visible` 的 3px 焦点环**——键盘
       用户看不出焦点在哪；`hover:text-foreground`——上游 hover 时图标变深；
       以及 `text-muted-foreground` 这个静息色。改成走 Button，
       props 与上游 `ArtifactAction` 逐条相同（`variant="ghost"` `size="sm"`
       `className="text-muted-foreground hover:text-foreground size-8 p-0"`）。
  -->
  <Tooltip v-if="canEdit && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.edit"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        @click="emit('edit')"
      >
        <Pencil :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ $i18n.t.value.common.edit }}</TooltipContent>
  </Tooltip>
  <template v-if="editing">
    <!--
      保存键**禁用时要说得出为什么**。上游 artifact-file-detail.tsx:493 把 tooltip
      在三句之间切（跑起来了 / 冲突 / 保存），而 ArtifactAction 把 tooltip 原样写进
      sr-only——也就是说上游这颗按钮的**可访问名**会跟着状态变。本仓此前恒为
      "Save"：按钮灰着、读屏器只念得出「保存」，用户无从知道为什么点不动。
    -->
    <Tooltip>
      <TooltipTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="saveLabel"
          class="text-muted-foreground hover:text-foreground size-8 p-0"
          :disabled="streaming || saving || !dirty || conflict"
          @click="emit('save')"
        >
          <Save :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ saveLabel }}</TooltipContent>
    </Tooltip>
    <!-- 放弃在编辑态**恒显**，不看 dirty：React 的三颗（保存/退出/放弃）是一组。 -->
    <Tooltip>
      <TooltipTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="$i18n.t.value.artifactEditing.discard"
          class="text-muted-foreground hover:text-foreground size-8 p-0"
          @click="emit('discard')"
        >
          <RotateCcw :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{
        $i18n.t.value.artifactEditing.discard
      }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="$i18n.t.value.artifactEditing.exit"
          class="text-muted-foreground hover:text-foreground size-8 p-0"
          @click="emit('exit')"
        >
          <PencilOff :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ $i18n.t.value.artifactEditing.exit }}</TooltipContent>
    </Tooltip>
  </template>
  <!--
    这四颗的**顺序**照上游 artifact-file-detail.tsx 的渲染序：
    安装(:533) → 在新窗口打开(:546) → 复制(:561) → 下载(:584)。
    wave 72 探针实测（artifact-stream-state 场景）本仓是「复制 → 打开 → 下载」，
    上游是「打开 → 复制 → 下载」，安装还被排到了最后。
    **对照台账看不见顺序**：aria 快照去缩进后是按多重集比的（八类差异之④）。
  -->
  <!--
    安装键的名字与说明是**两句话**：上游 artifact-file-detail.tsx:532 传
    `label={t.common.install}` 与 `tooltip={t.toolCalls.skillInstallTooltip}`，
    前者进 sr-only（可访问名），后者进浮层（这颗按钮会做什么）。
  -->
  <Tooltip v-if="canInstall && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.install"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        :disabled="installing"
        @click="emit('install')"
      >
        <Package :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      $i18n.t.value.toolCalls.skillInstallTooltip
    }}</TooltipContent>
  </Tooltip>
  <Tooltip v-if="canOpen && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.openInNewWindow"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        @click="emit('open')"
      >
        <SquareArrowOutUpRight :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      gatewayTooltip($i18n.t.value.common.openInNewWindow)
    }}</TooltipContent>
  </Tooltip>
  <!--
    复制在截断或空内容时是**禁用**，不是消失——React 渲染它并传 disabled
    （artifact-file-detail.tsx 的 `disabled={!content || truncated}`）。控件时有时无，
    读屏器每次都要重新数一遍这排按钮。编辑态下这几颗则整体不渲染（React 的 `!isEditing`）。
  -->
  <Tooltip v-if="canCopy && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :disabled="copyDisabled"
        :aria-label="$i18n.t.value.clipboard.copyToClipboard"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        @click="emit('copy')"
      >
        <Copy :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      $i18n.t.value.clipboard.copyToClipboard
    }}</TooltipContent>
  </Tooltip>
  <Tooltip v-if="canDownload && !editing">
    <TooltipTrigger>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :aria-label="$i18n.t.value.common.download"
        class="text-muted-foreground hover:text-foreground size-8 p-0"
        @click="emit('download')"
      >
        <Download :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{
      gatewayTooltip($i18n.t.value.common.download)
    }}</TooltipContent>
  </Tooltip>
</template>
