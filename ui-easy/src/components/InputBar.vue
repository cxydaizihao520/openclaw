<template>
  <div class="input-bar">
    <!-- 输入区域卡片 -->
    <div class="input-card">
      <div class="input-wrapper">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="input-field"
          placeholder="请输入你的问数需求，或点击示例问题"
          rows="1"
          @keydown="handleKeydown"
          @input="autoResize"
        ></textarea>
      </div>
      <div class="input-actions">
        <!-- AI 正在回复时显示停止按钮 -->
        <button
          v-if="chatStore.currentRunId"
          class="btn-stop"
          @click="handleAbort"
          title="停止回复"
        >
          ⏹
        </button>
        <!-- 发送按钮 -->
        <button
          v-else
          class="btn-send"
          :disabled="!canSend"
          @click="handleSend"
          title="发送 (Enter)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
    <!-- 免责提示 -->
    <div class="input-disclaimer">内容由AI生成，仅供参考</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat'
import { useSessionStore } from '../stores/session'

const chatStore = useChatStore()
const sessionStore = useSessionStore()

const inputText = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

// 是否可以发送
const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !chatStore.sending
})

// 发送消息
async function handleSend() {
  if (!canSend.value) return
  const msg = inputText.value
  inputText.value = ''
  // 重置高度
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }
  await chatStore.sendMessage(sessionStore.currentKey, msg)
}

// 中止回复
async function handleAbort() {
  await chatStore.abort(sessionStore.currentKey)
}

// 键盘事件：Enter 发送，Shift+Enter 换行
function handleKeydown(e: KeyboardEvent) {
  if (e.isComposing) return // 过滤输入法组合输入状态
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// 自动调整输入框高度
function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
</script>

<style scoped>
.input-bar {
  padding: 0 var(--space-2xl) var(--space-lg);
  background: var(--color-bg-primary);
}

.input-card {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md) var(--space-lg);
  box-shadow: var(--shadow-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input-card:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 4px 16px rgba(43, 125, 233, 0.12);
}

.input-wrapper {
  flex: 1;
}

.input-field {
  width: 100%;
  resize: none;
  line-height: 1.6;
  max-height: 200px;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
}

.input-field::placeholder {
  color: var(--color-text-muted);
}

.input-actions {
  flex-shrink: 0;
  padding-bottom: 2px;
}

.btn-send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-send:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: scale(1.05);
}

.btn-send:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-stop {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-error);
  color: #fff;
  font-size: var(--font-size-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  animation: pulse-stop 1.5s ease-in-out infinite;
}

.btn-stop:hover {
  opacity: 0.8;
}

@keyframes pulse-stop {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

.input-disclaimer {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-sm);
  user-select: none;
}
</style>
