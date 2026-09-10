/*
  【文件职责】     在 Worker 线程里跑分隔符文件解析。
  【架构位置】     L3 worker 入口
  【主要导出】     无（Worker 模块）
  【依赖关系】     ./delimited-preview · ./delimited-preview-types
  【边界与注意】   **异常一律转成 error 响应**，不要让它变成未捕获错误：
                   Worker 里的未捕获错误在调用方那边只表现为「一直没有回音」，
                   而超时兜底要等满 5 秒，用户看到的是干等。
*/
import { parseDelimitedPreview } from "./delimited-preview";
import type {
  DelimitedPreviewInput,
  DelimitedPreviewResponse,
} from "./delimited-preview-types";

self.onmessage = (event: MessageEvent<DelimitedPreviewInput>) => {
  let response: DelimitedPreviewResponse;
  try {
    response = { result: parseDelimitedPreview(event.data) };
  } catch {
    response = { error: "Unable to reliably preview this delimited file" };
  }
  self.postMessage(response);
};
