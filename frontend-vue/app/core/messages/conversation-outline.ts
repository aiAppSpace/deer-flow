/*
  【文件职责】     把一条会话切成「章节」，用来做长会话的跳转目录。
  【架构位置】     L3 纯函数
  【主要导出】     CONVERSATION_OUTLINE_MIN_TURNS · CONVERSATION_CHAPTER_TITLE_MAX_LENGTH ·
                   ConversationChapter · buildConversationChapters
  【依赖关系】     ./utils(extractTextFromMessage, stripUploadedFilesTag, MessageGroup)
  【边界与注意】   **一章 = 一次用户提问**。助手回复不单独成章：目录是给「我刚才问的
                   那个问题在哪」用的，把回复也切进去只会让条目翻倍而定位更难。

                   标题按**字符**截断而不是按码元（`Array.from` 而不是 `slice`）：
                   中文和 emoji 在 UTF-16 里占两个码元，按码元切会把一个字切成两半，
                   显示出来是一个乱码方块。

                   只有附件、没有文字的那一轮要有个说法（调用方传 fallbackTitle）——
                   否则目录里出现一条没有名字的空条目，点它才知道是什么。
*/

import {
  extractTextFromMessage,
  stripUploadedFilesTag,
  type MessageGroup,
} from "./utils";

/** 少于这么多轮就不显示目录：三五句话的会话滚一下就到了。 */
export const CONVERSATION_OUTLINE_MIN_TURNS = 5;
export const CONVERSATION_CHAPTER_TITLE_MAX_LENGTH = 48;

export interface ConversationChapter {
  id: string;
  groupIndex: number;
  title: string;
}

function normalizeChapterTitle(content: string, fallbackTitle: string): string {
  const normalized = stripUploadedFilesTag(content).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallbackTitle;
  }
  const characters = [...normalized];
  if (characters.length <= CONVERSATION_CHAPTER_TITLE_MAX_LENGTH) {
    return normalized;
  }
  return `${characters
    .slice(0, CONVERSATION_CHAPTER_TITLE_MAX_LENGTH)
    .join("")}…`;
}

export function buildConversationChapters(
  groups: readonly MessageGroup[],
  fallbackTitle: string,
): ConversationChapter[] {
  const chapters: ConversationChapter[] = [];
  groups.forEach((group, groupIndex) => {
    if (group.type !== "human") return;
    const message = group.messages[0];
    chapters.push({
      /*
        id 要在这条会话里唯一且稳定：优先用组 id，再退到消息 id，
        最后才用位置。用位置当兜底而不是首选，是因为插入一轮之后
        位置全变，正在高亮的那一章会跳到别处。
      */
      id: group.id ?? message?.id ?? `human-turn:${groupIndex}`,
      groupIndex,
      title: normalizeChapterTitle(
        message ? extractTextFromMessage(message) : "",
        fallbackTitle,
      ),
    });
  });
  return chapters;
}
