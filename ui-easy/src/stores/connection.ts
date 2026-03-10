// ConnectionStore — Gateway 连接状态管理

import { defineStore } from "pinia";
import { ref } from "vue";
import { GatewayClient } from "../api/gateway-client";
import type { EventFrame, HelloOk } from "../api/types";
import { useSessionStore } from "./session";

export const useConnectionStore = defineStore("connection", () => {
  // 连接状态
  const status = ref<"disconnected" | "connecting" | "connected">("disconnected");
  // 服务器版本
  const serverVersion = ref("");
  // 连接 ID
  const connId = ref("");
  // 错误信息
  const error = ref<string | null>(null);
  // 客户端实例
  let client: GatewayClient | null = null;

  /** 获取客户端实例 */
  function getClient(): GatewayClient | null {
    return client;
  }

  /** 连接到 Gateway */
  function connect(token?: string): void {
    if (client) {
      client.stop();
    }

    error.value = null;

    client = new GatewayClient({
      token,
      onStatusChange: (s) => {
        status.value = s;
      },
      onHello: (hello: HelloOk) => {
        serverVersion.value = hello.server.version;
        connId.value = hello.server.connId;
        error.value = null;
        // 连接成功后自动初始化会话
        const sessionStore = useSessionStore();
        void sessionStore.initOnConnect();
      },
      onEvent: (event: EventFrame) => {
        void handleEvent(event);
      },
      onClose: (info) => {
        if (info.code !== 1000) {
          error.value = `连接关闭 (${info.code}): ${info.reason || "未知原因"}`;
        }
      },
    });

    client.start();
  }

  /** 断开连接 */
  function disconnect(): void {
    if (client) {
      client.stop();
      client = null;
    }
    status.value = "disconnected";
    serverVersion.value = "";
    connId.value = "";
  }

  /** 处理 Gateway 事件分发 */
  async function handleEvent(event: EventFrame): Promise<void> {
    switch (event.event) {
      case "chat": {
        // 延迟导入，避免与 chat.ts 的循环依赖
        const { useChatStore } = await import("./chat");
        const chatStore = useChatStore();
        chatStore.handleChatEvent(event.payload);
        break;
      }
      case "tick":
        // 心跳事件，无需处理
        break;
      default:
        // 其他事件暂不处理
        break;
    }
  }

  return {
    status,
    serverVersion,
    connId,
    error,
    getClient,
    connect,
    disconnect,
  };
});
