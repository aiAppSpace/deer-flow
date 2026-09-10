/*
  【文件职责】     分隔符文件（CSV/TSV）预览的边界常量与消息形状。
  【架构位置】     L3 领域类型
  【主要导出】     DELIMITED_INPUT_LIMIT · DELIMITED_RECORD_LIMIT ·
                   DELIMITED_COLUMN_LIMIT · DELIMITED_TIMEOUT_MS ·
                   DelimitedPreviewInput · DelimitedPreviewResult · DelimitedPreviewResponse
  【依赖关系】     无
  【边界与注意】   四个上限都是**保护**，不是产品参数：
                   - 输入 1 MiB：再大就不是「预览」了，整份读进内存会卡住这一帧；
                   - 记录 202：面板一页 200 行，多取 2 行才知道「还有更多」；
                   - 列 50：横向再多也看不过来，且列数直接决定 DOM 宽度；
                   - 超时 5 秒：病态输入（超宽引号记录）能让解析器长时间不返回，
                     Worker 卡住时主线程要能放弃它。
                   数值与上游一致，改之前先想清楚哪一条保护会失效。
*/

export const DELIMITED_INPUT_LIMIT = 1_048_576;
export const DELIMITED_RECORD_LIMIT = 202;
export const DELIMITED_COLUMN_LIMIT = 50;
export const DELIMITED_TIMEOUT_MS = 5_000;

export interface DelimitedPreviewInput {
  content: string;
  delimiter: "," | "\t";
  /** 内容本身已被上游截断——末尾那条记录可能是残的。 */
  truncated: boolean;
}

export interface DelimitedPreviewResult {
  rows: string[][];
  columnCount: number;
  /** 还有没显示完的内容（被记录数上限截断，或输入本身就是截断的）。 */
  limited: boolean;
  /** 各行列数不一致——多半是文件本身有问题，UI 要提示。 */
  unevenRows: boolean;
}

export type DelimitedPreviewResponse =
  { result: DelimitedPreviewResult } | { error: string };
