// SessionStore — 会话管理

import { defineStore } from "pinia";
import { ref } from "vue";
import type { SessionItem, SessionsListResult } from "../api/types";
import { useChatStore } from "./chat";
import { useConnectionStore } from "./connection";

export const useSessionStore = defineStore("session", () => {
  // 会话列表
  const sessions = ref<SessionItem[]>([]);
  // 当前选中的会话 key
  const currentKey = ref("");
  // 正在加载
  const loading = ref(false);

  /** 连接成功后初始化会话 */
  async function initOnConnect(): Promise<void> {
    await loadSessions();

    // 如果已有会话列表，选择最新的会话
    const latest = sessions.value[0];
    if (latest) {
      await switchTo(latest.key);
    } else {
      // 没有历史会话，自动创建一个新会话
      await createSession();
    }
  }

  /** 加载会话列表 */
  async function loadSessions(): Promise<void> {
    const conn = useConnectionStore();
    const client = conn.getClient();
    if (!client || !client.connected()) {
      return;
    }

    loading.value = true;
    try {
      const res = await client.request<SessionsListResult>("sessions.list", {
        limit: 50,
        includeDerivedTitles: true,
        includeLastMessage: true,
      });
      // 服务端返回 { ts, count, sessions: [...] } 包装对象
      const list = Array.isArray(res?.sessions) ? res.sessions : [];
      sessions.value = [...list].toSorted((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
      console.error("[session] load failed:", err);
    } finally {
      loading.value = false;
    }
  }

  /** 切换到指定会话 */
  async function switchTo(key: string): Promise<void> {
    currentKey.value = key;
    const chatStore = useChatStore();
    chatStore.clearMessages();
    await chatStore.loadHistory(key);
  }

  /** 新建会话 */
  async function createSession(): Promise<void> {
    const conn = useConnectionStore();
    const client = conn.getClient();
    if (!client || !client.connected()) {
      return;
    }

    // 使用 sessions.reset 创建新会话
    const newKey = `web-${Date.now()}`;
    try {
      await client.request("sessions.reset", {
        key: newKey,
        reason: "new",
      });
      await loadSessions();
      await switchTo(newKey);
    } catch (err) {
      console.error("[session] create failed:", err);
    }
  }

  /** 删除会话 */
  async function deleteSession(key: string): Promise<void> {
    const conn = useConnectionStore();
    const client = conn.getClient();
    if (!client || !client.connected()) {
      return;
    }

    try {
      await client.request("sessions.delete", { key });
      await loadSessions();
      // 如果删除的是当前会话，切换到列表中第一个或创建新的
      if (currentKey.value === key) {
        const next = sessions.value[0];
        if (next) {
          await switchTo(next.key);
        } else {
          await createSession();
        }
      }
    } catch (err) {
      console.error("[session] delete failed:", err);
    }
  }

  /** 重置会话（清空历史） */
  async function resetSession(key: string): Promise<void> {
    const conn = useConnectionStore();
    const client = conn.getClient();
    if (!client || !client.connected()) {
      return;
    }

    try {
      await client.request("sessions.reset", { key, reason: "reset" });
      if (currentKey.value === key) {
        const chatStore = useChatStore();
        chatStore.clearMessages();
      }
    } catch (err) {
      console.error("[session] reset failed:", err);
    }
  }

  return {
    sessions,
    currentKey,
    loading,
    initOnConnect,
    loadSessions,
    switchTo,
    createSession,
    deleteSession,
    resetSession,
  };
});
