<template>
  <div class="message-bubble" :class="`message-bubble--${message.role}`">
    <div class="message-avatar" :class="`message-avatar--${message.role}`">
      {{ message.role === 'user' ? '👤' : '🤖' }}
    </div>
    <div class="message-body">
      <!-- 思考过程区域 -->
      <details v-if="thinkingContent && chatStore.showThinking" class="message-thinking">
        <summary class="thinking-summary">思考过程</summary>
        <div class="thinking-content" v-html="thinkingContent"></div>
      </details>
      <!-- 最终回复内容 -->
      <div v-if="renderedContent" class="message-content" v-html="renderedContent"></div>
      <div v-if="message.timestamp" class="message-time">
        {{ formatTime(message.timestamp) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '../api/types'
import { useChatStore } from '../stores/chat'

const props = defineProps<{
  message: ChatMessage
}>()

const chatStore = useChatStore()

// 渲染思考内容
const thinkingContent = computed(() => {
  const blocks = props.message.content || []
  const thinkingBlock = blocks.find((b) => b.thinking)
  if (!thinkingBlock?.thinking) return null
  return escapeHtml(thinkingBlock.thinking).replace(/\n/g, '<br>')
})

// 渲染消息内容（简单 HTML 转义 + 换行处理）
const renderedContent = computed(() => {
  const blocks = props.message.content || []
  return blocks
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => escapeHtml(b.text!).replace(/\n/g, '<br>'))
    .join('')
})

// HTML 转义
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 格式化时间
function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.message-bubble {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  transition: background var(--transition-fast);
}

.message-bubble:hover {
  background: var(--color-bg-hover);
}

.message-bubble--assistant {
  background: var(--color-surface);
}

.message-bubble--user {
  background: var(--color-bg-primary);
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

.message-avatar--user {
  background: var(--color-accent-subtle);
}

.message-avatar--assistant {
  background: rgba(34, 197, 94, 0.08);
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

.message-content :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  background: var(--color-bg-tertiary);
  padding: 1px 5px;
  border-radius: 3px;
}

.message-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
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
</style>
