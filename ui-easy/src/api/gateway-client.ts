// GatewayClient — WebSocket 客户端
// 实现 Openclaw Gateway 协议 v3 的浏览器端通信

import type {
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ConnectParams,
  HelloOk,
  ErrorShape,
} from "./types";

/** 生成唯一 ID（兼容非 HTTPS 和旧版浏览器） */
function generateUUID(): string {
  // 优先使用 crypto.randomUUID（需安全上下文）
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // 非安全上下文下会抛异常，回退
    }
  }
  // 回退方案：手写 UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 请求等待项 */
interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}

/** GatewayClient 配置选项 */
export interface GatewayClientOptions {
  /** Gateway Token（可选） */
  token?: string;
  /** 事件回调 */
  onEvent?: (event: EventFrame) => void;
  /** 连接成功回调 */
  onHello?: (hello: HelloOk) => void;
  /** 连接关闭回调 */
  onClose?: (info: { code: number; reason: string }) => void;
  /** 连接状态变化回调 */
  onStatusChange?: (status: "disconnected" | "connecting" | "connected") => void;
}

/**
 * Openclaw Gateway 浏览器端 WebSocket 客户端
 *
 * 协议流程：
 * 1. 建立 WebSocket 连接
 * 2. 收到 connect.challenge 事件（含 nonce）
 * 3. 发送 connect 请求（含 auth/client 信息）
 * 4. 收到 hello-ok 响应
 * 5. 开始正常通信
 */
export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private connectSent = false;
  private lastSeq: number | null = null;
  private backoffMs = 800;
  private closed = false;
  private reconnectTimer: number | null = null;
  private _connected = false;
  private opts: GatewayClientOptions;

  constructor(opts: GatewayClientOptions) {
    this.opts = opts;
  }

  /** 启动连接 */
  start(): void {
    this.closed = false;
    this.connect();
  }

  /** 断开连接 */
  stop(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "client stop");
      this.ws = null;
    }
    this._connected = false;
    this.opts.onStatusChange?.("disconnected");
    this.flushPending(new Error("client stopped"));
  }

  /** 当前连接状态 */
  connected(): boolean {
    return this._connected;
  }

  /** 发送请求并等待响应 */
  request<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("not connected"));
        return;
      }
      const id = generateUUID();
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      const frame: RequestFrame = { type: "req", id, method, params };
      this.ws.send(JSON.stringify(frame));
    });
  }

  /** 建立 WebSocket 连接 */
  private connect(): void {
    if (this.closed) {
      return;
    }

    this.opts.onStatusChange?.("connecting");
    this.connectSent = false;

    // 同源连接：使用 /ws 路径（开发模式由 Vite 代理到 Gateway）
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      // 等待 connect.challenge 事件
    });

    ws.addEventListener("message", (event) => {
      this.handleMessage(event.data as string);
    });

    ws.addEventListener("close", (event) => {
      this._connected = false;
      this.opts.onStatusChange?.("disconnected");
      this.opts.onClose?.({ code: event.code, reason: event.reason });
      this.flushPending(new Error(`websocket closed: ${event.code}`));
      if (!this.closed) {
        this.scheduleReconnect();
      }
    });

    ws.addEventListener("error", () => {
      // onclose 会在 onerror 之后触发，在那里处理重连
    });
  }

  /** 处理 connect.challenge 并发送 connect 请求 */
  private sendConnect(): void {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;

    const params: ConnectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "webchat-ui",
        version: "1.0.0",
        platform: navigator.platform ?? "web",
        mode: "webchat",
      },
      role: "operator",
      scopes: ["operator.admin"],
      auth: this.opts.token ? { token: this.opts.token } : undefined,
      caps: ["tool-events"],
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    this.request<HelloOk>("connect", params)
      .then((hello) => {
        this._connected = true;
        this.backoffMs = 800;
        this.opts.onStatusChange?.("connected");
        this.opts.onHello?.(hello);
      })
      .catch((err) => {
        console.error("[gateway] connect failed:", err);
        this.ws?.close(4008, "connect failed");
      });
  }

  /** 解析收到的消息 */
  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };

    // 事件帧
    if (frame.type === "event") {
      const evt = parsed as EventFrame;
      // 处理连接挑战
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this.sendConnect();
        }
        return;
      }
      // 序号检测
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          console.warn(`[gateway] seq gap: expected ${this.lastSeq + 1}, got ${seq}`);
        }
        this.lastSeq = seq;
      }
      // 触发事件回调
      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error("[gateway] event handler error:", err);
      }
      return;
    }

    // 响应帧
    if (frame.type === "res") {
      const res = parsed as ResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) {
        return;
      }
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        const error: ErrorShape = res.error ?? {
          code: "UNKNOWN",
          message: "request failed",
        };
        pending.reject(new Error(error.message));
      }
    }
  }

  /** 断线重连（指数退避） */
  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoffMs);
    // 指数退避，最大 30 秒
    this.backoffMs = Math.min(this.backoffMs * 1.5, 30000);
  }

  /** 清理所有等待中的请求 */
  private flushPending(err: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(err);
    }
    this.pending.clear();
  }
}
