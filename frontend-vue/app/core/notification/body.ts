/*
  【文件职责】     裁剪浏览器通知的正文：过长就截断，空文本给兜底。
  【架构位置】     L3 通知策略（纯函数，不碰 Notification API）
  【主要导出】     NOTIFICATION_BODY_LIMIT · notificationBody
  【依赖关系】     无
  【边界与注意】   上游 `chat-page.tsx:152` 与 `agents/[agent_name]/chats/[thread_id]/page.tsx:134`
                   各写了一份同样的三行：取最后一条消息的文本、超 200 就
                   `substring(0, 200) + "..."`、没文本就用 "Conversation finished"。
                   两份都在组件里，本仓收成一处。

                   **按码点截，不按 UTF-16 码元。** 上游的 `substring(0, 200)` 会从
                   代理对中间切开，留下一个孤立代理——通知里显示成 `�`。
                   emoji 和多数 CJK 扩展区字符都是代理对，这不是边角情况。
                   代价是同一段文本两边可能差一两个字符，而对照取样面不取通知正文
                   （它是宿主 API，不进 DOM），所以这处不会进台账。
*/

/** 与上游同一个数字：`textContent.length > 200`。这里的单位是码点。 */
export const NOTIFICATION_BODY_LIMIT = 200;

/** 上游截断后接的就是三个点，不是 `…`。 */
const ELLIPSIS = "...";

/**
 * @param text 最后一条消息的文本；空串表示没取到。
 * @param fallback 没取到文本时显示什么（上游写死 "Conversation finished"，本仓走 i18n）。
 */
export function notificationBody(
  text: string | null | undefined,
  fallback: string,
  limit = NOTIFICATION_BODY_LIMIT,
): string {
  if (!text) return fallback;
  // Array.from 按码点拆，代理对算一个。
  const codePoints = Array.from(text);
  if (codePoints.length <= limit) return text;
  return codePoints.slice(0, limit).join("") + ELLIPSIS;
}
