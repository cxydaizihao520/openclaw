// ChatStore — 聊天状态管理

import { defineStore } from "pinia";
import { ref } from "vue";
import type { ChatMessage, ChatEventPayload, ChatHistoryResult, ContentBlock } from "../api/types";
import { useConnectionStore } from "./connection";
import { useSessionStore } from "./session";

/** 生成唯一 ID（兼容非 HTTPS 和旧版浏览器） */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* 回退 */
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 无声回复检测 */
const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;

function isSilentReply(text: string): boolean {
  return SILENT_REPLY_PATTERN.test(text);
}

/** 从消息对象中提取文本 */
function extractText(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const msg = message as Record<string, unknown>;
  // 尝试从 content 数组中提取
  if (Array.isArray(msg.content)) {
    const texts = (msg.content as ContentBlock[])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!);
    return texts.join("") || null;
  }
  // 尝试从 text 字段提取
  if (typeof msg.text === "string") {
    return msg.text;
  }
  return null;
}

/** 从消息对象中提取思考过程 */
function extractThinking(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const msg = message as Record<string, unknown>;
  if (Array.isArray(msg.content)) {
    const thinkingBlocks = (msg.content as ContentBlock[])
      .filter((b) => b.thinking)
      .map((b) => b.thinking!);
    return thinkingBlocks.join("") || null;
  }
  return null;
}

/** 标准化 AI 回复消息 */
function normalizeAssistantMessage(message: unknown): ChatMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const msg = message as Record<string, unknown>;
  const role = msg.role as string;
  if (role !== "assistant") {
    return null;
  }
  const text = extractText(message);
  const thinking = extractThinking(message);
  if ((!text || isSilentReply(text)) && !thinking) {
    return null;
  }

  const content: ContentBlock[] = Array.isArray(msg.content)
    ? (msg.content as ContentBlock[])
    : [{ type: "text", text: text || "" }];

  if (thinking && !content.some((c) => c.thinking)) {
    content.unshift({ type: "text", thinking });
  }

  return {
    role: "assistant",
    content,
    timestamp: (msg.timestamp as number) || Date.now(),
  };
}

export const useChatStore = defineStore("chat", () => {
  // 消息列表
  const messages = ref<ChatMessage[]>([]);
  // 正在加载历史
  const loading = ref(false);
  // 正在发送消息
  const sending = ref(false);
  // 流式输出缓冲
  const streaming = ref<string | null>(null);
  // 流式思考缓冲
  const streamingThinking = ref<string | null>(null);
  // 当前运行 ID
  const currentRunId = ref<string | null>(null);
  // 最后一次错误
  const lastError = ref<string | null>(null);

  // 思考过程显示状态（持久化）
  const showThinking = ref(localStorage.getItem("openclaw_show_thinking") !== "false");

  function toggleThinking() {
    showThinking.value = !showThinking.value;
    localStorage.setItem("openclaw_show_thinking", String(showThinking.value));
  }

  /** 加载历史消息 */
  async function loadHistory(sessionKey: string): Promise<void> {
    const conn = useConnectionStore();
    const client = conn.getClient();
    if (!client || !client.connected()) {
      return;
    }

    loading.value = true;
    lastError.value = null;

    try {
      const res = await client.request<ChatHistoryResult>("chat.history", {
        sessionKey,
        limit: 200,
      });
      const msgs = Array.isArray(res.messages) ? res.messages : [];
      // 过滤无声回复
      messages.value = msgs.filter((m) => {
        const text = extractText(m);
        return !text || !isSilentReply(text);
      });
      // 清除流式状态
      streaming.value = null;
      streamingThinking.value = null;
      currentRunId.value = null;
    } catch (err) {
      lastError.value = String(err);
    } finally {
      loading.value = false;
    }
  }

  /** 发送消息 */
  async function sendMessage(sessionKey: string, message: string): Promise<void> {
    const conn = useConnectionStore();
    const client = conn.getClient();
    if (!client || !client.connected()) {
      return;
    }

    const msg = message.trim();
    if (!msg) {
      return;
    }

    const now = Date.now();
    const runId = generateUUID();

    // 立即添加用户消息到列表
    messages.value = [
      ...messages.value,
      {
        role: "user",
        content: [{ type: "text", text: msg }],
        timestamp: now,
      },
    ];

    sending.value = true;
    lastError.value = null;
    currentRunId.value = runId;
    streaming.value = "";
    streamingThinking.value = "";

    try {
      await client.request("chat.send", {
        sessionKey,
        message: msg,
        deliver: false,
        idempotencyKey: runId,
      });
    } catch (err) {
      currentRunId.value = null;
      streaming.value = null;
      streamingThinking.value = null;
      lastError.value = String(err);
      // 添加错误消息
      messages.value = [
        ...messages.value,
        {
          role: "assistant",
          content: [{ type: "text", text: "错误: " + String(err) }],
          timestamp: Date.now(),
        },
      ];
    } finally {
      sending.value = false;
    }
  }

  /** 中止当前回复 */
  async function abort(sessionKey: string): Promise<void> {
    const conn = useConnectionStore();
    const client = conn.getClient();
    if (!client || !client.connected()) {
      return;
    }

    try {
      await client.request("chat.abort", {
        sessionKey,
        runId: currentRunId.value || undefined,
      });
    } catch (err) {
      console.error("[chat] abort failed:", err);
    }
  }

  /** 处理来自 Gateway 的 chat 事件 */
  function handleChatEvent(payload: unknown): void {
    if (!payload) {
      return;
    }
    const event = payload as ChatEventPayload;

    switch (event.state) {
      case "delta": {
        // 流式输出：提取累积文本
        const text = extractText(event.message);
        if (typeof text === "string" && !isSilentReply(text)) {
          const current = streaming.value ?? "";
          if (!current || text.length >= current.length) {
            streaming.value = text;
          }
        }

        // 提取累积思考过程
        const thinking = extractThinking(event.message);
        if (typeof thinking === "string") {
          const currentThinking = streamingThinking.value ?? "";
          if (!currentThinking || thinking.length >= currentThinking.length) {
            streamingThinking.value = thinking;
          }
        }
        break;
      }

      case "final": {
        // 回复完成
        const finalMessage = normalizeAssistantMessage(event.message);
        if (finalMessage) {
          messages.value = [...messages.value, finalMessage];
        } else if (
          (streaming.value?.trim() && !isSilentReply(streaming.value)) ||
          streamingThinking.value
        ) {
          // 如果没有正式消息但有流式内容，用流式内容创建消息
          const contentBlocks: ContentBlock[] = [];
          if (streamingThinking.value) {
            contentBlocks.push({ type: "text", thinking: streamingThinking.value });
          }
          if (streaming.value?.trim() && !isSilentReply(streaming.value)) {
            contentBlocks.push({ type: "text", text: streaming.value });
          }
          messages.value = [
            ...messages.value,
            {
              role: "assistant",
              content: contentBlocks,
              timestamp: Date.now(),
            },
          ];
        }
        streaming.value = null;
        streamingThinking.value = null;
        currentRunId.value = null;

        // 刷新会话列表
        const sessionStore = useSessionStore();
        void sessionStore.loadSessions();
        break;
      }

      case "aborted": {
        // 用户中止
        if (
          (streaming.value?.trim() && !isSilentReply(streaming.value)) ||
          streamingThinking.value
        ) {
          const contentBlocks: ContentBlock[] = [];
          if (streamingThinking.value) {
            contentBlocks.push({ type: "text", thinking: streamingThinking.value });
          }
          if (streaming.value?.trim() && !isSilentReply(streaming.value)) {
            contentBlocks.push({ type: "text", text: streaming.value });
          }
          messages.value = [
            ...messages.value,
            {
              role: "assistant",
              content: contentBlocks,
              timestamp: Date.now(),
            },
          ];
        }
        streaming.value = null;
        streamingThinking.value = null;
        currentRunId.value = null;
        break;
      }

      case "error": {
        // 出错
        streaming.value = null;
        streamingThinking.value = null;
        currentRunId.value = null;
        lastError.value = event.errorMessage ?? "聊天出错";
        break;
      }
    }
  }

  /** 清空消息 */
  function clearMessages(): void {
    messages.value = [];
    streaming.value = null;
    streamingThinking.value = null;
    currentRunId.value = null;
    lastError.value = null;
  }

  return {
    messages,
    loading,
    sending,
    streaming,
    streamingThinking,
    currentRunId,
    lastError,
    showThinking,
    toggleThinking,
    loadHistory,
    sendMessage,
    abort,
    handleChatEvent,
    clearMessages,
  };
});
