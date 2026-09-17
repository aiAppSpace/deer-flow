<script setup lang="ts">
/*
  【文件职责】     渲染「关于 DeerFlow」那份 markdown。
  【架构位置】     L3
  【主要导出】     默认 AboutSettings 组件
  【依赖关系】     about-content · MessageMarkdown · markdown 元素样式镜像
  【边界与注意】   上游这一页只有一行：`<SafeStreamdown>{aboutMarkdown}</SafeStreamdown>`
                   （about-settings-page.tsx:8）。本仓原来是一段手写的 `<article>`，
                   三个标题三段话，与上游那份带清单、链接、图片与引用块的正文**完全
                   是两份内容**——实测差 75 行。

                   插件链取 Streamdown 的**内建默认**（`defaultRemarkPlugins` /
                   `defaultRehypePlugins`），不是消息路径那一档：上游这里没有传
                   `streamdownPlugins`，走的就是内建默认（gfm + code meta，
                   rehype-raw + sanitize + harden），**没有** math。
*/
import { computed } from "vue";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import {
  defaultRehypePlugins,
  defaultRemarkPlugins,
} from "@/core/markdown/plugins";

import { buildAboutMarkdown } from "./about-content";

const markdown = computed(() => buildAboutMarkdown());
</script>

<template>
  <!--
    **`wrap-anywhere`**：这一页的标题是 `text-2xl` 的单个长词——
    「🙌 Acknowledgments」就是这一屏最宽的东西，而 360px 下设置面板的内容列
    只有约 200px。CI 的 Linux 字体下它把整块面板顶出格子 4px（`panelSlack` −3），
    而 macOS 上还剩 41px 余量——**一个只在某个平台成立的缺陷，和没有缺陷长得
    一模一样**。用 `break-words` 没用：按 css-text-3，`overflow-wrap: break-word`
    新增的换行机会不计入 min-content；`anywhere` 才计入，而且它只在一个词实在
    放不下时才断开。两边同改。
  -->
  <MessageMarkdown
    class="wrap-anywhere"
    :content="markdown"
    :components="richContentComponents"
    :remark-plugins="defaultRemarkPlugins"
    :rehype-plugins="defaultRehypePlugins"
  />
</template>
