/*
  【文件职责】     单次解析 Gateway 非成功响应并保留 status、结构化 body 与原文。
  【架构位置】     L3
  【主要导出】     GatewayResponseError · UnauthorizedError · read/throw helpers
  【依赖关系】     Web Response
  【边界与注意】   body 只能消费一次；旧函数名委托同一实现，不再维持第二套解析器。
*/

/**
 * 401：fetcher 已经开始跳登录了。
 *
 * 单独一个类，是为了让调用方**认得出这一档**——比如模型加载失败的横幅，
 * 在跳转途中再报一句「模型加载失败」是重复且误导的。此前这里抛的是一个匿名
 * `Error("Unauthorized")`，只能靠比对 message 认，那种判据一改文案就失效。
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class GatewayResponseError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly responseText: string;

  constructor(
    message: string,
    status: number,
    body: unknown,
    responseText: string,
  ) {
    super(message);
    this.name = "GatewayResponseError";
    this.status = status;
    this.body = body;
    this.responseText = responseText;
  }
}

function isDisplayableText(value: string) {
  const text = value.trim();
  return (
    Boolean(text) && !/^\s*</.test(text) && !/<\/?[a-z][\s\S]*>/i.test(text)
  );
}

function displayMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null) {
    const detail = Reflect.get(body, "detail");
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (detail !== undefined) {
      try {
        const serialized = JSON.stringify(detail);
        if (
          serialized &&
          serialized !== "null" &&
          serialized !== "{}" &&
          serialized !== "[]"
        ) {
          return serialized;
        }
      } catch {
        // The raw response text below remains the lossless fallback.
      }
    }
  }
  if (typeof body === "string" && isDisplayableText(body)) {
    return body.trim();
  }
  return fallback;
}

export async function readGatewayResponseError(
  response: Response,
  fallback?: string,
): Promise<GatewayResponseError> {
  const fallbackMessage =
    fallback?.trim() || response.statusText?.trim() || "Request failed.";
  const responseText =
    typeof response.text === "function"
      ? await response.text().catch(() => "")
      : typeof response.json === "function"
        ? JSON.stringify(await response.json().catch(() => null))
        : "";
  let body: unknown = null;
  if (responseText) {
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      body = responseText;
    }
  }
  return new GatewayResponseError(
    displayMessage(body, fallbackMessage),
    response.status,
    body,
    responseText,
  );
}

export async function throwGatewayResponseError(
  response: Response,
  fallback?: string,
): Promise<never> {
  throw await readGatewayResponseError(response, fallback);
}

export async function throwGatewayApiError(
  response: Response,
  fallback: string,
): Promise<never> {
  return throwGatewayResponseError(response, fallback);
}

export function isGatewayResponseError(
  error: unknown,
): error is GatewayResponseError {
  return error instanceof GatewayResponseError;
}
