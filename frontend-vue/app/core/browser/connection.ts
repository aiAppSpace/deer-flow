/*
  【文件职责】     以唯一 owner 管理 browser WebSocket、pending navigate、重连预算与过期事件隔离。
  【架构位置】     L3
  【主要导出】     BrowserConnectionController · reconnect constants
  【依赖关系】     browser/protocol.ts · 注入的 socket/timer
  【边界与注意】   纯 TypeScript 状态机；Vue composable 只负责把 snapshot 适配成 ref。
*/

import type {
  BrowserInputDisposition,
  BrowserInputEvent,
  BrowserNavigateIntent,
  BrowserStreamStatus,
  BrowserTab,
} from "./protocol";

export const BROWSER_RECONNECT_BASE_DELAY_MS = 800;
export const BROWSER_RECONNECT_MAX_DELAY_MS = 10_000;
export const BROWSER_RECONNECT_MAX_ATTEMPTS = 6;

export interface BrowserSocketLike {
  readyState: number;
  binaryType: BinaryType;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface BrowserConnectionSnapshot {
  status: BrowserStreamStatus;
  reconnectAttempt: number;
  canRetry: boolean;
  liveUrl: string | null;
  title: string;
  tabs: BrowserTab[];
  error: string | null;
  rejectedUrl: string | null;
}

type TimerHandle = unknown;

export interface BrowserConnectionOptions {
  buildUrl: (threadId: string, seedUrl?: string) => string;
  createSocket?: (url: string) => BrowserSocketLike;
  setTimer?: (callback: () => void, delay: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  onState?: (snapshot: BrowserConnectionSnapshot) => void;
  onFrame?: (frame: Blob | ArrayBuffer | string) => void;
  onNavigationRejected?: (
    url: string | undefined,
    message: string | undefined,
  ) => void;
  onReconnectExhausted?: () => void;
}

const INITIAL_SNAPSHOT: BrowserConnectionSnapshot = {
  status: "idle",
  reconnectAttempt: 0,
  canRetry: false,
  liveUrl: null,
  title: "",
  tabs: [],
  error: null,
  rejectedUrl: null,
};

export function normalizeBrowserSeedUrl(
  url: string | null | undefined,
): string {
  return (url ?? "").trim().split("#", 1)[0]?.replace(/\/+$/, "") ?? "";
}

function defaultCreateSocket(url: string): BrowserSocketLike {
  return new WebSocket(url);
}

function browserCloseMessage(code?: number, reason?: string): string {
  const explicit = reason?.trim();
  if (explicit) return explicit;
  switch (code) {
    case 4401:
      return "Live browser authentication expired.";
    case 4403:
      return "Live browser connection origin was rejected.";
    case 4404:
      return "Live browser session is unavailable for this thread.";
    case 4409:
      return "This live browser session already has another viewer.";
    case 4429:
      return "Live browser capacity is full.";
    case 4501:
      return "Live browser runtime is unavailable.";
    default:
      return code
        ? `Live browser connection closed (code ${code}).`
        : "Live browser connection failed.";
  }
}

function parseTabs(value: unknown): BrowserTab[] | null {
  if (!Array.isArray(value)) return null;
  const tabs: BrowserTab[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const index = Reflect.get(item, "index");
    const title = Reflect.get(item, "title");
    const url = Reflect.get(item, "url");
    const active = Reflect.get(item, "active");
    if (
      typeof index === "number" &&
      Number.isInteger(index) &&
      typeof title === "string" &&
      typeof url === "string" &&
      typeof active === "boolean"
    ) {
      tabs.push({ index, title, url, active });
    }
  }
  return tabs;
}

export class BrowserConnectionController {
  private readonly createSocket: (url: string) => BrowserSocketLike;
  private readonly setTimer: (
    callback: () => void,
    delay: number,
  ) => TimerHandle;
  private readonly clearTimer: (handle: TimerHandle) => void;
  private state: BrowserConnectionSnapshot = { ...INITIAL_SNAPSHOT };
  private socket: BrowserSocketLike | null = null;
  private reconnectTimer: TimerHandle | null = null;
  private generation = 0;
  private threadId = "";
  private seedUrl: string | undefined;
  private connectionSeed: string | undefined;
  private pendingNavigate: BrowserNavigateIntent | null = null;
  private enabled = false;
  private disposed = false;

  constructor(private readonly options: BrowserConnectionOptions) {
    this.createSocket = options.createSocket ?? defaultCreateSocket;
    this.setTimer =
      options.setTimer ??
      ((callback, delay) => globalThis.setTimeout(callback, delay));
    this.clearTimer =
      options.clearTimer ??
      ((handle) => globalThis.clearTimeout(Number(handle)));
  }

  get snapshot(): BrowserConnectionSnapshot {
    return this.state;
  }

  start(threadId: string, seedUrl?: string): void {
    if (this.disposed) return;
    this.generation += 1;
    this.stopTransport();
    this.threadId = threadId;
    this.seedUrl = seedUrl?.trim() || undefined;
    this.connectionSeed = this.seedUrl;
    this.pendingNavigate = null;
    this.enabled = Boolean(threadId);
    this.state = {
      ...INITIAL_SNAPSHOT,
      status: this.enabled ? "connecting" : "idle",
    };
    this.emitState();
    if (this.enabled) this.openSocket(this.generation);
  }

  stop(): void {
    if (this.disposed) return;
    this.generation += 1;
    this.enabled = false;
    this.threadId = "";
    this.seedUrl = undefined;
    this.connectionSeed = undefined;
    this.pendingNavigate = null;
    this.stopTransport();
    this.state = { ...INITIAL_SNAPSHOT };
    this.emitState();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  retry(): void {
    if (
      this.disposed ||
      !this.enabled ||
      !this.threadId ||
      this.state.status !== "error"
    ) {
      return;
    }
    this.generation += 1;
    this.stopTransport();
    this.state = {
      ...this.state,
      status: "connecting",
      reconnectAttempt: 0,
      canRetry: false,
      error: null,
      rejectedUrl: null,
    };
    this.emitState();
    this.openSocket(this.generation);
  }

  clearError(): void {
    if (this.state.error === null && this.state.rejectedUrl === null) return;
    this.publish({ error: null, rejectedUrl: null });
  }

  updateSeed(seedUrl?: string): void {
    const target = seedUrl?.trim() || undefined;
    this.seedUrl = target;
    if (!this.enabled || !target) return;
    const baseline = this.state.liveUrl ?? this.connectionSeed;
    if (normalizeBrowserSeedUrl(target) === normalizeBrowserSeedUrl(baseline)) {
      return;
    }
    this.sendInput({ type: "navigate", url: target });
  }

  sendInput(event: BrowserInputEvent): BrowserInputDisposition {
    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event));
        return "sent";
      } catch {
        if (event.type === "navigate") this.pendingNavigate = event;
        this.handleDisconnect(socket, this.generation);
        return event.type === "navigate" ? "queued" : "unavailable";
      }
    }
    if (
      event.type === "navigate" &&
      this.enabled &&
      this.state.status !== "error" &&
      this.state.status !== "idle"
    ) {
      this.pendingNavigate = event;
      return "queued";
    }
    return "unavailable";
  }

  private openSocket(generation: number): void {
    if (!this.isCurrent(generation)) return;
    this.connectionSeed = this.seedUrl;
    let socket: BrowserSocketLike;
    try {
      socket = this.createSocket(
        this.options.buildUrl(this.threadId, this.seedUrl),
      );
    } catch (cause) {
      this.handleCreationFailure(
        generation,
        cause instanceof Error ? cause.message : undefined,
      );
      return;
    }
    socket.binaryType = "blob";
    this.socket = socket;
    socket.onopen = () => {
      if (!this.isSocketCurrent(socket, generation)) return;
      this.publish({
        status: "open",
        reconnectAttempt: 0,
        canRetry: false,
        error: null,
        rejectedUrl: null,
      });
      const pending = this.pendingNavigate;
      if (!pending) return;
      this.pendingNavigate = null;
      if (
        normalizeBrowserSeedUrl(pending.url) ===
        normalizeBrowserSeedUrl(this.connectionSeed)
      ) {
        return;
      }
      try {
        socket.send(JSON.stringify(pending));
      } catch {
        this.pendingNavigate = pending;
        this.handleDisconnect(socket, generation);
      }
    };
    socket.onmessage = (event) => {
      if (!this.isSocketCurrent(socket, generation)) return;
      this.handleMessage(event.data);
    };
    socket.onerror = () => {
      this.handleDisconnect(socket, generation);
    };
    socket.onclose = (event) => {
      this.handleDisconnect(socket, generation, event.code, event.reason);
    };
  }

  private handleMessage(data: unknown): void {
    if (data instanceof Blob || data instanceof ArrayBuffer) {
      this.options.onFrame?.(data);
      return;
    }
    if (typeof data !== "string") return;
    let payload: unknown;
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return;
    }
    if (typeof payload !== "object" || payload === null) return;
    const type = Reflect.get(payload, "type");
    if (type === "frame") {
      const frame = Reflect.get(payload, "data");
      if (typeof frame === "string" && frame) this.options.onFrame?.(frame);
      return;
    }
    if (type === "url") {
      const url = Reflect.get(payload, "url");
      if (typeof url === "string" && url) this.publish({ liveUrl: url });
      return;
    }
    if (type === "tabs") {
      const tabs = parseTabs(Reflect.get(payload, "tabs"));
      if (tabs !== null) {
        this.publish({
          tabs,
          title: tabs.find((tab) => tab.active)?.title ?? "",
        });
      }
      return;
    }
    if (type === "nav_rejected") {
      const url = Reflect.get(payload, "url");
      const message = Reflect.get(payload, "message");
      this.options.onNavigationRejected?.(
        typeof url === "string" ? url : undefined,
        typeof message === "string" ? message : undefined,
      );
      this.publish({
        error:
          typeof message === "string" && message.trim()
            ? message.replace(/^Error:\s*/i, "")
            : "Navigation rejected.",
        rejectedUrl: typeof url === "string" ? url : null,
      });
      return;
    }
    if (type === "error") {
      const message = Reflect.get(payload, "message");
      this.publish({
        error:
          typeof message === "string" && message.trim()
            ? message.trim()
            : "Live browser protocol error.",
      });
    }
  }

  private handleCreationFailure(generation: number, reason?: string): void {
    if (!this.isCurrent(generation)) return;
    this.scheduleReconnect(generation, undefined, reason);
  }

  private handleDisconnect(
    socket: BrowserSocketLike,
    generation: number,
    code?: number,
    reason?: string,
  ): void {
    if (!this.isSocketCurrent(socket, generation)) return;
    this.socket = null;
    this.detachSocket(socket);
    try {
      socket.close();
    } catch {
      // The transport is already unusable; the reconnect state owns recovery.
    }
    this.scheduleReconnect(generation, code, reason);
  }

  private scheduleReconnect(
    generation: number,
    code?: number,
    reason?: string,
  ): void {
    if (!this.isCurrent(generation) || this.reconnectTimer !== null) return;
    const attempt = this.state.reconnectAttempt;
    if (attempt >= BROWSER_RECONNECT_MAX_ATTEMPTS) {
      this.pendingNavigate = null;
      this.publish({
        status: "error",
        canRetry: true,
        error: browserCloseMessage(code, reason),
      });
      this.options.onReconnectExhausted?.();
      return;
    }
    const nextAttempt = attempt + 1;
    const delay = Math.min(
      BROWSER_RECONNECT_BASE_DELAY_MS * 2 ** attempt,
      BROWSER_RECONNECT_MAX_DELAY_MS,
    );
    this.publish({
      status: "reconnecting",
      reconnectAttempt: nextAttempt,
      canRetry: false,
    });
    this.reconnectTimer = this.setTimer(() => {
      this.reconnectTimer = null;
      if (!this.isCurrent(generation)) return;
      this.publish({ status: "connecting" });
      this.openSocket(generation);
    }, delay);
  }

  private stopTransport(): void {
    if (this.reconnectTimer !== null) {
      this.clearTimer(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      this.detachSocket(socket);
      try {
        socket.close();
      } catch {
        // Closing is best effort; generation invalidation blocks stale events.
      }
    }
  }

  private detachSocket(socket: BrowserSocketLike): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && this.enabled && generation === this.generation;
  }

  private isSocketCurrent(
    socket: BrowserSocketLike,
    generation: number,
  ): boolean {
    return this.isCurrent(generation) && this.socket === socket;
  }

  private publish(patch: Partial<BrowserConnectionSnapshot>): void {
    this.state = { ...this.state, ...patch };
    this.emitState();
  }

  private emitState(): void {
    this.options.onState?.({ ...this.state, tabs: [...this.state.tabs] });
  }
}
