<template>
  <div class="chat-view">
    <!-- 右上角工具栏 -->
    <div class="chat-toolbar">
      <!-- 刷新消息 -->
      <button
        class="toolbar-btn"
        :class="{ 'toolbar-btn--spinning': isRefreshing }"
        @click="refreshMessages"
        title="刷新消息"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
      </button>
      <!-- 新建对话 -->
      <button
        class="toolbar-btn"
        @click="newSession"
        title="开启新对话"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- 消息列表区域 -->
    <div class="message-list" ref="messageListRef">
      <!-- 加载中 -->
      <div v-if="chatStore.loading" class="chat-loading">
        <div class="loading-spinner"></div>
        <span>加载历史消息...</span>
      </div>

      <!-- 空状态 — 欢迎页 -->
      <div v-else-if="chatStore.messages.length === 0 && !chatStore.streaming" class="welcome-container">
        <div class="welcome-content">
          <h1 class="welcome-title">您好，我是"新点"智能问数</h1>
          <p class="welcome-hint">
            建议您的提问包含
            <strong>时间</strong>、<strong>统计条件</strong> 及 <strong>目标指标</strong>，以便获得最精准的分析结果。
          </p>
        </div>
      </div>

      <!-- 消息列表 -->
      <template v-else>
        <MessageBubble
          v-for="(msg, index) in chatStore.messages"
          :key="index"
          :message="msg"
        />
      </template>

      <!-- 流式输出 -->
      <div v-if="chatStore.streaming !== null" class="message-bubble message-bubble--assistant streaming">
        <div class="message-avatar">🤖</div>
        <div class="message-body">
          <!-- 思考过程区域（流式） -->
          <details v-if="streamingThinkingHtml" class="message-thinking" open>
            <summary class="thinking-summary">思考过程...</summary>
            <div class="thinking-content" v-html="streamingThinkingHtml"></div>
          </details>
          <!-- 文本输出区域（流式） -->
          <div v-if="streamingHtml" class="message-content" v-html="streamingHtml"></div>
          <div class="streaming-cursor">▋</div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="chatStore.lastError" class="chat-error">
        ⚠️ {{ chatStore.lastError }}
      </div>
    </div>

    <!-- 输入栏 -->
    <InputBar />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import { useChatStore } from '../stores/chat'
import { useSessionStore } from '../stores/session'
import MessageBubble from './MessageBubble.vue'
import InputBar from './InputBar.vue'

const chatStore = useChatStore()
const sessionStore = useSessionStore()
const messageListRef = ref<HTMLElement | null>(null)
const isRefreshing = ref(false)

// 流式输出 HTML
const streamingHtml = computed(() => {
  if (!chatStore.streaming) return ''
  return escapeHtml(chatStore.streaming).replace(/\n/g, '<br>')
})

// 流式思考过程 HTML
const streamingThinkingHtml = computed(() => {
  if (!chatStore.streamingThinking) return ''
  return escapeHtml(chatStore.streamingThinking).replace(/\n/g, '<br>')
})

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 自动滚动到底部
function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

// 刷新消息：重新加载当前会话历史
async function refreshMessages() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    const key = sessionStore.currentKey
    if (key) {
      chatStore.clearMessages()
      await chatStore.loadHistory(key)
    }
  } finally {
    // 动画至少持续 600ms，避免闪烁
    setTimeout(() => { isRefreshing.value = false }, 600)
  }
}

// 开启新对话
async function newSession() {
  await sessionStore.createSession()
}

// 监听消息变化自动滚动
watch(() => chatStore.messages.length, scrollToBottom)
watch(() => chatStore.streaming, scrollToBottom)


</script>

<style scoped>
.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-primary);
  position: relative;
}

/* 右上角工具栏 */
.chat-toolbar {
  position: absolute;
  top: 10px;
  right: 14px;
  display: flex;
  gap: 4px;
  z-index: 10;
}

.toolbar-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  opacity: 0.7;
}

.toolbar-btn:hover {
  opacity: 1;
  background: var(--color-bg-hover);
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.toolbar-btn--spinning svg {
  animation: spin 0.7s linear infinite;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* 欢迎页 */
.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-2xl);
}

.welcome-content {
  max-width: 680px;
  width: 100%;
  text-align: center;
}

.welcome-title {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-header-start), var(--color-header-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: var(--space-lg);
  line-height: 1.3;
}

.welcome-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-3xl);
  line-height: 1.6;
}

.welcome-hint strong {
  color: var(--color-accent);
  font-weight: 600;
}



/* 流式消息样式 */
.message-bubble {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
}

.message-bubble--assistant {
  background: var(--color-surface);
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-content {
  font-size: var(--font-size-md);
  line-height: 1.7;
  color: var(--color-text-primary);
  word-break: break-word;
}

.message-thinking {
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  padding: 8px var(--space-md);
  margin-bottom: var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  border-left: 3px solid var(--color-accent-subtle);
}

.thinking-summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text-primary);
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.thinking-summary::before {
  content: '🧠';
  display: inline-block;
}

.thinking-content {
  margin-top: var(--space-xs);
  font-style: italic;
  line-height: 1.6;
}

.streaming-cursor {
  display: inline;
  color: var(--color-accent);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 加载状态 */
.chat-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-2xl);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误提示 */
.chat-error {
  padding: var(--space-md) var(--space-xl);
  background: rgba(239, 68, 68, 0.06);
  color: var(--color-error);
  font-size: var(--font-size-sm);
  border-left: 3px solid var(--color-error);
  margin: var(--space-sm) var(--space-xl);
  border-radius: var(--radius-sm);
}
</style>
