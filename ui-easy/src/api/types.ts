// WebSocket 协议类型定义
// 基于 Openclaw Gateway 源码 src/gateway/protocol/schema/ 定义

// === 帧格式 ===

/** 请求帧 — 客户端 → 服务端 */
export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

/** 响应帧 — 服务端 → 客户端 */
export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
}

/** 事件帧 — 服务端主动推送 */
export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
}

/** 错误结构 */
export interface ErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

// === 连接握手 ===

/** connect 方法的参数 */
export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
    instanceId?: string;
  };
  role: string;
  scopes: string[];
  auth?: {
    token?: string;
    password?: string;
  };
  caps?: string[];
  userAgent?: string;
  locale?: string;
}

/** connect 成功后的响应 */
export interface HelloOk {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

// === Chat API ===

/** chat.send 参数 */
export interface ChatSendParams {
  sessionKey: string;
  message: string;
  deliver?: boolean;
  idempotencyKey: string;
  attachments?: ChatAttachment[];
}

/** 聊天附件 */
export interface ChatAttachment {
  type: string;
  mimeType: string;
  content: string;
}

/** chat.history 参数 */
export interface ChatHistoryParams {
  sessionKey: string;
  limit?: number;
}

/** chat.history 响应 */
export interface ChatHistoryResult {
  messages: ChatMessage[];
  thinkingLevel?: string;
}

/** chat.abort 参数 */
export interface ChatAbortParams {
  sessionKey: string;
  runId?: string;
}

/** chat 事件负载 */
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
}

// === 消息格式 ===

/** 聊天消息 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: ContentBlock[];
  timestamp?: number;
}

/** 内容块 */
export interface ContentBlock {
  type: string;
  text?: string;
  /** 模型思考过程（thinking block） */
  thinking?: string;
  source?: unknown;
}

// === Sessions API ===

/** sessions.list 参数 */
export interface SessionsListParams {
  limit?: number;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
}

/** 会话项 */
export interface SessionItem {
  key: string;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  updatedAt?: number | null;
}

/** sessions.list 响应（服务端返回的包装对象） */
export interface SessionsListResult {
  ts: number;
  count: number;
  sessions: SessionItem[];
}

/** sessions.reset 参数 */
export interface SessionsResetParams {
  key: string;
  reason?: "new" | "reset";
}

/** sessions.delete 参数 */
export interface SessionsDeleteParams {
  key: string;
  deleteTranscript?: boolean;
}
